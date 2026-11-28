interface D1Result<T = Record<string, unknown>> { success: boolean; meta?: { changes?: number }; results?: T[]; }
interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}
interface D1Database {
  prepare(query: string): D1Statement;
}
export interface AuthEnv {
  DB?: D1Database;
  APP_ORIGIN?: string;
  API_ORIGIN?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
}
const jsonHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };
function reply(data: unknown, status = 200, origin?: string, cookie?: string): Response {
  const headers = new Headers(jsonHeaders);
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
  }
  headers.set("vary", "Origin");
  if (cookie) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(data), { status, headers });
}
function randomToken(bytes = 32): string {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function digest(value: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((part) => part.toString(16).padStart(2, "0")).join("");
}
async function hashPassword(password: string, salt: string): Promise<string> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: new TextEncoder().encode(salt), iterations: 100000 }, material, 256);
  return Array.from(new Uint8Array(bits)).map((part) => part.toString(16).padStart(2, "0")).join("");
}
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}
function cookie(value: string, maxAge: number): string {
  return `futpulse_session=${value}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAge}`;
}
function clearCookie(): string {
  return "futpulse_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0";
}
async function sendEmail(env: AuthEnv, to: string, subject: string, html: string): Promise<boolean> {
  if (!env.RESEND_API_KEY || !env.RESEND_FROM) {
    console.error("Resend: configuration manquante");
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ from: env.RESEND_FROM, to: [to], subject, html })
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Resend erreur:", response.status, error);
  }

  return response.ok;
}
function emailHtml(title: string, message: string, link: string): string {
  const safeLink = link.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#17212b"><h2>${title}</h2><p>${message}</p><p><a href="${safeLink}" style="display:inline-block;padding:12px 18px;background:#24c878;color:#062315;text-decoration:none;border-radius:6px">Continuer</a></p><p>Si tu n'es pas à l'origine de cette demande, ignore cet e-mail.</p></div>`;
}
async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json() as Record<string, unknown>;
    return body && typeof body === "object" ? body : null;
  } catch { return null; }
}
function normalizedEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}
async function currentUser(request: Request, db: D1Database): Promise<{ id: string; email: string; display_name: string; email_verified_at: number | null; avatar_data: string | null; bio: string; profile_public: number; created_at: number } | null> {
  const raw = request.headers.get("Cookie")?.match(/(?:^|;\s*)futpulse_session=([^;]+)/)?.[1];
  if (!raw) return null;
  const tokenHash = await digest(raw);
  const now = Math.floor(Date.now() / 1000);
  return db.prepare("SELECT users.id, users.email, users.display_name, users.email_verified_at, users.avatar_data, users.bio, users.profile_public, users.created_at FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?").bind(tokenHash, now).first();
}
export async function handleAuth(request: Request, env: AuthEnv, origin?: string): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/v1/auth/")) return null;
  if (!env.DB) return reply({ error: "auth_database_not_configured" }, 503, origin);
  const db = env.DB;
  const route = url.pathname.slice("/api/v1/auth/".length);
  const now = Math.floor(Date.now() / 1000);
  if (request.method === "GET" && route === "verify") {
    const raw = url.searchParams.get("token") ?? "";
    if (!raw) return reply({ error: "invalid_or_expired_token" }, 400, origin);
    const tokenHash = await digest(raw);
    const record = await db.prepare("SELECT id, user_id FROM email_verification_tokens WHERE token_hash = ? AND expires_at > ?").bind(tokenHash, now).first<{ id: string; user_id: string }>();
    if (!record) return reply({ error: "invalid_or_expired_token" }, 400, origin);
    await db.prepare("UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?").bind(now, now, record.user_id).run();
    await db.prepare("DELETE FROM email_verification_tokens WHERE user_id = ?").bind(record.user_id).run();
    return reply({ status: "email_verified" }, 200, origin);
  }
  if (request.method === "GET" && route === "me") {
    const user = await currentUser(request, db);
    return reply({ user: user ? { id: user.id, email: user.email, displayName: user.display_name, emailVerified: Boolean(user.email_verified_at), avatarData: user.avatar_data ?? null, bio: user.bio ?? "", profilePublic: Boolean(user.profile_public), createdAt: user.created_at } : null }, 200, origin);
  }
  if (request.method === "GET" && (route === "posts/feed" || route === "posts/mine" || route.startsWith("posts/user/"))) {
    const viewer = await currentUser(request, db);
    if (!viewer) return reply({ error: "not_authenticated" }, 401, origin);
    const userId = route.startsWith("posts/user/") ? route.slice("posts/user/".length) : viewer.id;
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return reply({ error: "profile_not_found" }, 404, origin);
    const target = await db.prepare("SELECT id, profile_public FROM users WHERE id = ?").bind(userId).first<{ id: string; profile_public: number }>();
    if (!target || (target.id !== viewer.id && !target.profile_public)) return reply({ error: "profile_not_found" }, 404, origin);
    let query = "SELECT p.id, p.author_id AS authorId, p.content, p.category, p.match_label AS matchLabel, p.created_at AS createdAt, u.display_name AS authorName, u.avatar_data AS authorAvatar, (SELECT COUNT(*) FROM community_post_likes l WHERE l.post_id = p.id) AS likeCount, EXISTS (SELECT 1 FROM community_post_likes l WHERE l.post_id = p.id AND l.user_id = ?) AS likedByMe FROM community_posts p JOIN users u ON u.id = p.author_id WHERE p.author_id = ? ORDER BY p.created_at DESC LIMIT 50";
    if (route === "posts/feed") {
      query = "SELECT p.id, p.author_id AS authorId, p.content, p.category, p.match_label AS matchLabel, p.created_at AS createdAt, u.display_name AS authorName, u.avatar_data AS authorAvatar, (SELECT COUNT(*) FROM community_post_likes l WHERE l.post_id = p.id) AS likeCount, EXISTS (SELECT 1 FROM community_post_likes l WHERE l.post_id = p.id AND l.user_id = ?) AS likedByMe FROM community_posts p JOIN users u ON u.id = p.author_id WHERE (p.author_id = ? OR (u.profile_public = 1 AND EXISTS (SELECT 1 FROM user_follows f WHERE f.follower_id = ? AND f.followed_id = p.author_id))) ORDER BY p.created_at DESC LIMIT 50";
    }
    const statement = route === "posts/feed" ? db.prepare(query).bind(viewer.id, viewer.id, viewer.id) : db.prepare(query).bind(viewer.id, userId);
    const result = await statement.all<{ id: string; authorId: string; content: string; category: string; matchLabel: string | null; createdAt: number; authorName: string; authorAvatar: string | null; likeCount: number; likedByMe: number }>();
    return reply({ posts: result.results ?? [] }, 200, origin);
  }
  if (request.method === "GET" && route.startsWith("public/")) {
    const userId = route.slice("public/".length);
    if (!/^[0-9a-f-]{36}$/i.test(userId)) return reply({ error: "profile_not_found" }, 404, origin);
    const profile = await db.prepare("SELECT id, display_name, avatar_data, bio, created_at FROM users WHERE id = ? AND profile_public = 1").bind(userId).first<{ id: string; display_name: string; avatar_data: string | null; bio: string | null; created_at: number }>();
    if (!profile) return reply({ error: "profile_not_found" }, 404, origin);
    const [followers, following, viewer] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS count FROM user_follows WHERE followed_id = ?").bind(userId).first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) AS count FROM user_follows WHERE follower_id = ?").bind(userId).first<{ count: number }>(),
      currentUser(request, db)
    ]);
    let isFollowing = false;
    if (viewer && viewer.id !== userId) {
      const relation = await db.prepare("SELECT follower_id FROM user_follows WHERE follower_id = ? AND followed_id = ?").bind(viewer.id, userId).first<{ follower_id: string }>();
      isFollowing = Boolean(relation);
    }
    return reply({ profile: { id: profile.id, displayName: profile.display_name, avatarData: profile.avatar_data ?? null, bio: profile.bio ?? "", createdAt: profile.created_at, followerCount: followers?.count ?? 0, followingCount: following?.count ?? 0, isFollowing } }, 200, origin);
  }
  if (request.method !== "POST") return reply({ error: "method_not_allowed" }, 405, origin);
  const body = await readBody(request);
  if (!body) return reply({ error: "invalid_json" }, 400, origin);

  if (route === "posts") {
    const user = await currentUser(request, db);
    if (!user) return reply({ error: "not_authenticated" }, 401, origin);
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const category = typeof body.category === "string" ? body.category : "";
    const matchLabel = typeof body.matchLabel === "string" ? body.matchLabel.trim() : "";
    if (!content || content.length > 500) return reply({ error: "invalid_post_content" }, 400, origin);
    if (!["opinion", "analysis", "news"].includes(category)) return reply({ error: "invalid_post_category" }, 400, origin);
    if (matchLabel.length > 100) return reply({ error: "invalid_match_label" }, 400, origin);
    const id = crypto.randomUUID();
    await db.prepare("INSERT INTO community_posts (id, author_id, content, category, match_label, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, user.id, content, category, matchLabel || null, now, now).run();
    return reply({ post: { id, authorId: user.id, content, category, matchLabel: matchLabel || null, createdAt: now, authorName: user.display_name, authorAvatar: user.avatar_data ?? null } }, 201, origin);
  }

  if (route === "posts/like" || route === "posts/unlike") {
    const viewer = await currentUser(request, db);
    if (!viewer) return reply({ error: "not_authenticated" }, 401, origin);
    const postId = typeof body.postId === "string" ? body.postId : "";
    if (!/^[0-9a-f-]{36}$/i.test(postId)) return reply({ error: "post_not_found" }, 404, origin);
    const post = await db.prepare("SELECT p.id, p.author_id FROM community_posts p JOIN users u ON u.id = p.author_id WHERE p.id = ? AND (p.author_id = ? OR u.profile_public = 1)").bind(postId, viewer.id).first<{ id: string; author_id: string }>();
    if (!post) return reply({ error: "post_not_found" }, 404, origin);
    if (route === "posts/like") {
      await db.prepare("INSERT OR IGNORE INTO community_post_likes (post_id, user_id, created_at) VALUES (?, ?, ?)").bind(postId, viewer.id, now).run();
    } else {
      await db.prepare("DELETE FROM community_post_likes WHERE post_id = ? AND user_id = ?").bind(postId, viewer.id).run();
    }
    const [count, relation] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS count FROM community_post_likes WHERE post_id = ?").bind(postId).first<{ count: number }>(),
      db.prepare("SELECT post_id FROM community_post_likes WHERE post_id = ? AND user_id = ?").bind(postId, viewer.id).first<{ post_id: string }>()
    ]);
    return reply({ likeCount: count?.count ?? 0, likedByMe: Boolean(relation) }, 200, origin);
  }

  if (route === "follow" || route === "unfollow") {
    const viewer = await currentUser(request, db);
    if (!viewer) return reply({ error: "not_authenticated" }, 401, origin);
    const targetId = typeof body.userId === "string" ? body.userId : "";
    if (!/^[0-9a-f-]{36}$/i.test(targetId)) return reply({ error: "profile_not_found" }, 404, origin);
    if (viewer.id === targetId) return reply({ error: "cannot_follow_self" }, 400, origin);
    if (route === "follow") {
      const target = await db.prepare("SELECT id FROM users WHERE id = ? AND profile_public = 1").bind(targetId).first<{ id: string }>();
      if (!target) return reply({ error: "profile_not_found" }, 404, origin);
      await db.prepare("INSERT OR IGNORE INTO user_follows (follower_id, followed_id, created_at) VALUES (?, ?, ?)").bind(viewer.id, targetId, now).run();
    } else {
      await db.prepare("DELETE FROM user_follows WHERE follower_id = ? AND followed_id = ?").bind(viewer.id, targetId).run();
    }
    const [followers, following, relation] = await Promise.all([
      db.prepare("SELECT COUNT(*) AS count FROM user_follows WHERE followed_id = ?").bind(targetId).first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) AS count FROM user_follows WHERE follower_id = ?").bind(targetId).first<{ count: number }>(),
      db.prepare("SELECT follower_id FROM user_follows WHERE follower_id = ? AND followed_id = ?").bind(viewer.id, targetId).first<{ follower_id: string }>()
    ]);
    return reply({ isFollowing: Boolean(relation), followerCount: followers?.count ?? 0, followingCount: following?.count ?? 0 }, 200, origin);
  }

  if (route === "register") {
    const email = normalizedEmail(body.email);
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return reply({ error: "invalid_email" }, 400, origin);
    if (displayName.length < 2 || displayName.length > 70) return reply({ error: "invalid_display_name" }, 400, origin);
    if (password.length < 10 || password.length > 128) return reply({ error: "password_must_be_10_to_128_characters" }, 400, origin);
    const existing = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
    if (existing) return reply({ error: "account_already_exists" }, 409, origin);
    const id = crypto.randomUUID();
    const salt = randomToken(16);
    const passwordHash = await hashPassword(password, salt);
    await db.prepare("INSERT INTO users (id,email,display_name,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(id,email,displayName,passwordHash,salt,now,now).run();
    const sessionToken = randomToken();
    const sessionExpires = now + 60 * 60 * 24 * 30;
    await db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),id,await digest(sessionToken),sessionExpires,now).run();
    return reply({ user: { id, email, displayName, emailVerified: false, avatarData: null, bio: "", profilePublic: false, createdAt: now } }, 201, origin, cookie(sessionToken,60*60*24*30));
  }

  if (route === "profile") {
    const user = await currentUser(request, db);
    if (!user) return reply({ error: "not_authenticated" }, 401, origin);
    const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
    const avatarData = typeof body.avatarData === "string" ? body.avatarData : "";
    const bio = typeof body.bio === "string" ? body.bio.trim() : "";
    const profilePublic = body.profilePublic === true;
    if (displayName.length < 2 || displayName.length > 70) return reply({ error: "invalid_display_name" }, 400, origin);
    if (bio.length > 280) return reply({ error: "bio_too_long" }, 400, origin);
    if (avatarData && (!/^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/.test(avatarData) || avatarData.length > 200000)) {
      return reply({ error: avatarData.length > 200000 ? "avatar_too_large" : "invalid_avatar" }, 400, origin);
    }
    await db.prepare("UPDATE users SET display_name = ?, avatar_data = ?, bio = ?, profile_public = ?, updated_at = ? WHERE id = ?").bind(displayName, avatarData || null, bio, profilePublic ? 1 : 0, now, user.id).run();
    if (!profilePublic) await db.prepare("DELETE FROM user_follows WHERE followed_id = ?").bind(user.id).run();
    const updated = await currentUser(request, db);
    return reply({ user: updated ? { id: updated.id, email: updated.email, displayName: updated.display_name, emailVerified: Boolean(updated.email_verified_at), avatarData: updated.avatar_data ?? null, bio: updated.bio ?? "", profilePublic: Boolean(updated.profile_public), createdAt: updated.created_at } : null }, 200, origin);
  }

  if (route === "login") {
    const email = normalizedEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    const user = await db.prepare("SELECT id,email,display_name,password_hash,password_salt,email_verified_at,avatar_data,bio,profile_public,created_at FROM users WHERE email = ?").bind(email).first<{ id: string; email: string; display_name: string; password_hash: string; password_salt: string; email_verified_at: number | null; avatar_data: string | null; bio: string | null; profile_public: number; created_at: number }>();
    const candidateHash = user ? await hashPassword(password, user.password_salt) : "";
    if (!user || !constantTimeEqual(candidateHash, user.password_hash)) {
      return reply({ error: "invalid_credentials" }, 401, origin);
    }
    const token = randomToken();
    const expires = now + 60 * 60 * 24 * 30;
    await db.prepare("INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),user.id,await digest(token),expires,now).run();
    return reply({ user: { id: user.id, email: user.email, displayName: user.display_name, emailVerified: Boolean(user.email_verified_at), avatarData: user.avatar_data ?? null, bio: user.bio ?? "", profilePublic: Boolean(user.profile_public), createdAt: user.created_at } }, 200, origin, cookie(token,60*60*24*30));
  }

  if (route === "logout") {
    const raw = request.headers.get("Cookie")?.match(/(?:^|;\s*)futpulse_session=([^;]+)/)?.[1];
    if (raw) await db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await digest(raw)).run();
    return reply({ status: "signed_out" }, 200, origin, clearCookie());
  }

  if (route === "forgot-password") {
    const email = normalizedEmail(body.email);
    if (!env.RESEND_API_KEY || !env.RESEND_FROM || !env.APP_ORIGIN) return reply({ error: "password_reset_email_unavailable" }, 503, origin);
    const user = await db.prepare("SELECT id FROM users WHERE email = ?").bind(email).first<{ id: string }>();
    if (user) {
      const token = randomToken();
      await db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").bind(user.id).run();
      await db.prepare("INSERT INTO password_reset_tokens (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),user.id,await digest(token),now+3600,now).run();
      const link = `${env.APP_ORIGIN.replace(/\/$/, "")}/?resetToken=${encodeURIComponent(token)}`;
      const sent = await sendEmail(env,email,"Réinitialisation du mot de passe - FutPulse",emailHtml("Réinitialiser ton mot de passe", "Ce lien est valable pendant une heure.",link));
      if (!sent) return reply({ error: "reset_email_not_sent" }, 502, origin);
    }
    return reply({ status: "if_account_exists_email_sent" }, 200, origin);
  }

  if (route === "reset-password") {
    const token = typeof body.token === "string" ? body.token : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (password.length < 10 || password.length > 128) return reply({ error: "password_must_be_10_to_128_characters" }, 400, origin);
    const tokenHash = await digest(token);
    const record = await db.prepare("SELECT id,user_id FROM password_reset_tokens WHERE token_hash = ? AND expires_at > ?").bind(tokenHash,now).first<{ id: string; user_id: string }>();
    if (!record) return reply({ error: "invalid_or_expired_token" }, 400, origin);
    const salt = randomToken(16);
    const passwordHash = await hashPassword(password,salt);
    await db.prepare("UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?").bind(passwordHash,salt,now,record.user_id).run();
    await db.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").bind(record.user_id).run();
    await db.prepare("DELETE FROM sessions WHERE user_id = ?").bind(record.user_id).run();
    return reply({ status: "password_reset" }, 200, origin);
  }

  return reply({ error: "not_found" }, 404, origin);
}
