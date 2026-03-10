import { supabase } from "@/integrations/supabase/client";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:3001";
const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const IS_FUNCTIONS_BASE = API_BASE.includes("/functions/v1");

const parseResponse = async (response: Response) => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Request failed");
  }

  return response.json();
};

export const apiFetch = async (path: string, options: RequestInit = {}) => {
  const { data } = await supabase.auth.getSession();
  let token = data.session?.access_token;
  if (!token && SUPABASE_PROJECT_ID) {
    try {
      const stored = localStorage.getItem(`sb-${SUPABASE_PROJECT_ID}-auth-token`);
      if (stored) {
        const parsed = JSON.parse(stored) as { access_token?: string };
        token = parsed.access_token;
      }
    } catch {
      // Ignore malformed storage entries.
    }
  }
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  const shouldPrefixApi = API_BASE.includes("/functions/v1") && path.startsWith("/crm");
  const normalizedPath = shouldPrefixApi ? `/api${path}` : path;

  const response = await fetch(`${API_BASE}${normalizedPath}`, {
    ...options,
    headers,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));

  return parseResponse(response);
};

export const resolveLoginIdentifier = async (identifier: string) => {
  const path = IS_FUNCTIONS_BASE ? "/login-identifier" : "/api/auth/login-identifier";
  const headers = new Headers({ "Content-Type": "application/json" });

  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ identifier }),
  });

  return parseResponse(response) as Promise<{ email: string }>;
};
