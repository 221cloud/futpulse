export interface FutPulseUser {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  avatarData?: string | null;
  bio?: string;
  profilePublic?: boolean;
  createdAt?: number;
}
const API_BASE_URL = import.meta.env.VITE_FUTPULSE_API_URL?.replace(/\/$/, "") ?? "";
async function request<T>(path: string, body?: Record<string, string | boolean>): Promise<T> {
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
export async function registerAccount(displayName: string, email: string, password: string): Promise<FutPulseUser> {
  const result = await request<{ user: FutPulseUser }>("register", { displayName, email, password });
  return result.user;
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
export async function updateAccountProfile(displayName: string, avatarData: string, bio: string, profilePublic: boolean): Promise<FutPulseUser> {
  const result = await request<{ user: FutPulseUser }>("profile", { displayName, avatarData, bio, profilePublic });
  return result.user;
}
export interface FutPulsePublicProfile {
  id: string;
  displayName: string;
  avatarData: string | null;
  bio: string;
  createdAt: number;
}
export async function getPublicProfile(userId: string): Promise<FutPulsePublicProfile> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/public/${encodeURIComponent(userId)}`, {
    method: "GET",
    headers: { Accept: "application/json" }
  });
  const result = await response.json().catch(() => ({})) as { profile?: FutPulsePublicProfile; error?: string };
  if (!response.ok || !result.profile) throw new Error(result.error ?? "profile_not_found");
  return result.profile;
}
