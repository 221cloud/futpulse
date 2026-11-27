export interface FutPulseUser {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
}
const API_BASE_URL = import.meta.env.VITE_FUTPULSE_API_URL?.replace(/\/$/, "") ?? "";
async function request<T>(path: string, body?: Record<string, string>): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/${path}`, {
    method: body ? "POST" : "GET",
    credentials: "include",
    headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "auth_request_failed");
  return result;
}
export async function getCurrentUser(): Promise<FutPulseUser | null> {
  const result = await request<{ user: FutPulseUser | null }>("me");
  return result.user;
}
export async function registerAccount(displayName: string, email: string, password: string): Promise<void> {
  await request("register", { displayName, email, password });
}
export async function loginAccount(email: string, password: string): Promise<FutPulseUser> {
  const result = await request<{ user: FutPulseUser }>("login", { email, password });
  return result.user;
}
export async function logoutAccount(): Promise<void> {
  await request("logout", {});
}
export async function requestPasswordReset(email: string): Promise<void> {
  await request("forgot-password", { email });
}
export async function resetAccountPassword(token: string, password: string): Promise<void> {
  await request("reset-password", { token, password });
}
