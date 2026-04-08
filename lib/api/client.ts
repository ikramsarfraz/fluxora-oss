/**
 * API client for FastAPI backend.
 * Base URL from NEXT_PUBLIC_API_URL (empty when the UI and API share an origin and `/api` is proxied).
 * Session cookies are sent on same-origin requests when using `credentials: "include"`.
 */
const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

async function request<T>(
  path: string,
  options?: RequestInit & { params?: Record<string, string> }
): Promise<T> {
  const { params, ...init } = options ?? {};
  const url = params
    ? `${BASE}${path}?${new URLSearchParams(params).toString()}`
    : `${BASE}${path}`;
  let res: Response;
  const isDeleteNoBody = init?.method === "DELETE" && init?.body === undefined;
  const headers: Record<string, string> = {
    ...(isDeleteNoBody ? {} : { "Content-Type": "application/json" }),
    ...(init?.headers as Record<string, string> | undefined),
  };
  try {
    res = await fetch(url, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    const baseUrl = BASE || (typeof window !== "undefined" ? window.location.origin : "");
    throw new Error(
      `Cannot reach the API at ${baseUrl}. Make sure the backend is running (e.g. run: uvicorn api.main:app --reload from docs/legacy-app).`
    );
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(Array.isArray(err.detail) ? err.detail.map((e: { msg: string }) => e.msg).join(", ") : err.detail ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function uploadRequest<T>(path: string, formData: FormData): Promise<T> {
  const url = `${BASE}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      body: formData,
      credentials: "include",
    });
  } catch {
    const baseUrl = BASE || (typeof window !== "undefined" ? window.location.origin : "");
    throw new Error(`Cannot reach the API at ${baseUrl}. Is the backend running?`);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const msg = Array.isArray(err.detail) ? err.detail.map((e: { msg?: string }) => e.msg ?? String(e)).join(", ") : (err.detail ?? res.statusText);
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return res.json();
}

export const api = {
  get: <T>(path: string, params?: Record<string, string>) =>
    request<T>(path, { method: "GET", params }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  upload: <T>(path: string, formData: FormData) => uploadRequest<T>(path, formData),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: (path: string) => request<void>(path, { method: "DELETE" }),
};
