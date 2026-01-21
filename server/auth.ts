import type { Request, Response, NextFunction } from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

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
  user: { id: string; email: string | null };
};

export const requireUser = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!token) {
    res.status(401).json({ error: "Missing auth token" });
    return;
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
      return;
    }
    res.status(401).json({ error: "Invalid auth token", detail: error?.message ?? null });
    return;
  }

  (req as AuthedRequest).user = {
    id: data.user.id,
    email: data.user.email ?? null,
  };

  next();
};
