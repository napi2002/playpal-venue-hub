import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { pool } from "./db";

dotenv.config({ path: new URL("./.env", import.meta.url).pathname });

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

export type AuthedRequest = Request & {
  user: { id: string; email: string | null; role: string | null };
};

const fetchUserRole = async (authId: string) => {
  const { rows } = await pool.query<{ role: string }>(
    "select role from public.users where auth_id = $1",
    [authId],
  );
  return rows[0]?.role ?? null;
};

const authenticateRequest = async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    res.status(401).json({ error: "Missing auth token" });
    return null;
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    let issuer: string | null = null;
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf-8"));
      issuer = payload?.iss || null;
    } catch {
      issuer = null;
    }
    if (issuer && !issuer.startsWith(`${supabaseUrl}/auth`)) {
      res.status(401).json({ error: "Token issuer mismatch. Please re-login." });
      return null;
    }
    res.status(401).json({ error: "Invalid auth token", detail: error?.message ?? null });
    return null;
  }

  const role = await fetchUserRole(data.user.id);
  if (!role) {
    res.status(403).json({ error: "User not provisioned" });
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email ?? null,
    role,
  };
};

export const requireUser = async (req: Request, res: Response, next: NextFunction) => {
  const user = await authenticateRequest(req, res);
  if (!user) return;
  (req as AuthedRequest).user = user;
  next();
};

export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const user = await authenticateRequest(req, res);
  if (!user) return;
  if (user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  (req as AuthedRequest).user = user;

  next();
};
