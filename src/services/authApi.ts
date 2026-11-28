export interface FutPulseUser {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  avatarData?: string | null;
  bio?: string;
  profilePublic?: boolean;
  isAdmin?: boolean;
  createdAt?: number;
}
const API_BASE_URL = import.meta.env.VITE_FUTPULSE_API_URL?.replace(/\/$/, "") ?? "";
async function request<T>(path: string, body?: Record<string, string | boolean | number | null>): Promise<T> {
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
  followerCount: number;
  followingCount: number;
  postCount: number;
  likesReceived: number;
  commentsReceived: number;
  interactionsReceived: number;
  isFollowing: boolean;
}
export async function followUser(userId: string): Promise<{ isFollowing: boolean; followerCount: number; followingCount: number }> {
  return request("follow", { userId });
}
export async function unfollowUser(userId: string): Promise<{ isFollowing: boolean; followerCount: number; followingCount: number }> {
  return request("unfollow", { userId });
}
export async function getPublicProfile(userId: string): Promise<FutPulsePublicProfile> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/public/${encodeURIComponent(userId)}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" }
  });
  const result = await response.json().catch(() => ({})) as { profile?: FutPulsePublicProfile; error?: string };
  if (!response.ok || !result.profile) throw new Error(result.error ?? "profile_not_found");
  return result.profile;
}

export type FutPulsePostCategory = "opinion" | "analysis" | "news";
export interface FutPulsePost {
  id: string;
  authorId: string;
  content: string;
  category: FutPulsePostCategory;
  matchLabel: string | null;
  createdAt: number;
  authorName: string;
  authorAvatar: string | null;
  likeCount: number;
  likedByMe: boolean;
}
export interface FutPulseCommunityMember {
  id: string;
  displayName: string;
  avatarData: string | null;
  bio: string;
  followerCount: number;
  postCount: number;
  isFollowing: boolean;
}
export async function getCommunityMembers(): Promise<FutPulseCommunityMember[]> {
  const result = await request<{ members: FutPulseCommunityMember[] }>("community/members");
  return result.members ?? [];
}
export async function getPublicCommunityPosts(): Promise<FutPulsePost[]> {
  const result = await request<{ posts: FutPulsePost[] }>("posts/community");
  return result.posts ?? [];
}
export async function getCommunityFeed(): Promise<FutPulsePost[]> {
  const result = await request<{ posts: FutPulsePost[] }>("posts/feed");
  return result.posts;
}
export async function getMyPosts(): Promise<FutPulsePost[]> {
  const result = await request<{ posts: FutPulsePost[] }>("posts/mine");
  return result.posts;
}
export async function getUserPosts(userId: string): Promise<FutPulsePost[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/posts/user/${encodeURIComponent(userId)}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" }
  });
  const result = await response.json().catch(() => ({})) as { posts?: FutPulsePost[]; error?: string };
  if (!response.ok) throw new Error(result.error ?? "posts_unavailable");
  return result.posts ?? [];
}
export async function createCommunityPost(content: string, category: FutPulsePostCategory, matchLabel = ""): Promise<FutPulsePost> {
  const result = await request<{ post: FutPulsePost }>("posts", { content, category, matchLabel });
  return result.post;
}

export async function likeCommunityPost(postId: string): Promise<{ likeCount: number; likedByMe: boolean }> {
  return request("posts/like", { postId });
}
export async function unlikeCommunityPost(postId: string): Promise<{ likeCount: number; likedByMe: boolean }> {
  return request("posts/unlike", { postId });
}

export interface FutPulseComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  createdAt: number;
  authorName: string;
  authorAvatar: string | null;
}

export async function getCommunityPostComments(postId: string): Promise<FutPulseComment[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/posts/comments/${encodeURIComponent(postId)}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" }
  });
  const result = await response.json().catch(() => ({})) as { comments?: FutPulseComment[]; error?: string };
  if (!response.ok) throw new Error(result.error ?? "comments_unavailable");
  return result.comments ?? [];
}

export async function createCommunityComment(postId: string, content: string): Promise<FutPulseComment> {
  const result = await request<{ comment: FutPulseComment }>("posts/comments", { postId, content });
  return result.comment;
}

export async function deleteCommunityComment(commentId: string): Promise<void> {
  await request("posts/comments/delete", { commentId });
}

export type FutPulseNotificationType = "follow" | "like" | "comment";
export interface FutPulseNotification {
  id: string;
  type: FutPulseNotificationType;
  postId: string | null;
  commentId: string | null;
  createdAt: number;
  readAt: number | null;
  actorId: string;
  actorName: string;
  actorAvatar: string | null;
}

export async function getNotifications(): Promise<{ notifications: FutPulseNotification[]; unreadCount: number }> {
  return request<{ notifications: FutPulseNotification[]; unreadCount: number }>("notifications");
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await request("notifications/read", { notificationId });
}

export async function markAllNotificationsRead(): Promise<void> {
  await request("notifications/read-all", {});
}

export interface FutPulseStats {
  followers: number;
  following: number;
  posts: number;
  likesReceived: number;
  commentsReceived: number;
  interactionsReceived: number;
  interactionsLast30Days: number;
}

export async function getMyStats(): Promise<FutPulseStats> {
  const result = await request<{ stats: FutPulseStats }>("stats");
  return result.stats;
}

export type FutPulseReportReason = "spam" | "harassment" | "hate_speech" | "false_information" | "inappropriate_content" | "other";
export interface FutPulseModerationReport {
  id: string;
  postId: string;
  reporterId: string;
  reason: FutPulseReportReason;
  description: string | null;
  status: "pending" | "reviewed" | "dismissed";
  createdAt: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
  postContent: string;
  postAuthorId: string;
  postAuthorName: string;
  reporterName: string;
}
export async function reportCommunityPost(postId: string, reason: FutPulseReportReason, description = ""): Promise<void> {
  await request("posts/report", { postId, reason, description });
}
export async function getAdminReports(): Promise<FutPulseModerationReport[]> {
  const result = await request<{ reports: FutPulseModerationReport[] }>("admin/reports");
  return result.reports ?? [];
}
export async function reviewAdminReport(reportId: string, action: "dismiss" | "delete_post"): Promise<void> {
  await request("admin/reports/review", { reportId, action });
}

export type ManualFixtureStatus = "scheduled" | "live" | "finished" | "postponed" | "cancelled";
export interface FutPulseManualFixture {
  id: string;
  competitionName: string;
  season: string;
  roundLabel: string | null;
  kickoffAt: string;
  homeTeamName: string;
  awayTeamName: string;
  venue: string | null;
  status: ManualFixtureStatus;
  homeScore: number | null;
  awayScore: number | null;
  createdAt: number;
  updatedAt: number;
}
export async function getAdminManualFixtures(): Promise<FutPulseManualFixture[]> {
  const result = await request<{ fixtures: FutPulseManualFixture[] }>("admin/manual-fixtures");
  return result.fixtures ?? [];
}
export async function createAdminManualFixture(input: {
  competitionName: string; season: string; roundLabel: string; kickoffAt: string;
  homeTeamName: string; awayTeamName: string; venue: string;
}): Promise<void> {
  await request("admin/manual-fixtures", input);
}
export async function updateAdminManualFixture(input: {
  fixtureId: string; status: ManualFixtureStatus; homeScore: string; awayScore: string;
}): Promise<void> {
  await request("admin/manual-fixtures/update", input);
}

export type ManualFixtureEventType = "goal" | "own_goal" | "penalty_scored" | "penalty_missed" | "yellow_card" | "red_card" | "substitution" | "var";
export interface FutPulseManualFixtureEvent {
  id: string;
  fixtureId: string;
  teamSide: "home" | "away";
  eventType: ManualFixtureEventType;
  minute: number;
  addedTime: number | null;
  playerName: string;
  relatedPlayerName: string | null;
  detail: string | null;
  createdAt: number;
}
export async function getAdminManualFixtureEvents(fixtureId: string): Promise<FutPulseManualFixtureEvent[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/auth/admin/manual-fixtures/events?fixtureId=${encodeURIComponent(fixtureId)}`, {
    credentials: "include", headers: { Accept: "application/json" }
  });
  const result = await response.json().catch(() => ({})) as { events?: FutPulseManualFixtureEvent[]; error?: string };
  if (!response.ok) throw new Error(result.error ?? "manual_fixture_events_unavailable");
  return result.events ?? [];
}
export async function createAdminManualFixtureEvent(input: {
  fixtureId: string; teamSide: "home" | "away"; eventType: ManualFixtureEventType;
  minute: number; addedTime: number | null; playerName: string; relatedPlayerName: string; detail: string;
}): Promise<FutPulseManualFixtureEvent> {
  const result = await request<{ event: FutPulseManualFixtureEvent }>("admin/manual-fixtures/events", input);
  return result.event;
}
export async function deleteAdminManualFixtureEvent(eventId: string): Promise<void> {
  await request("admin/manual-fixtures/events/delete", { eventId });
}

export interface FutPulseAdminStats {
  users: number;
  publicProfiles: number;
  posts: number;
  likes: number;
  comments: number;
  follows: number;
  newUsersLast30Days: number;
  postsLast30Days: number;
  interactionsLast30Days: number;
}

export async function getAdminStatus(): Promise<{ isAdmin: boolean; bootstrapAvailable: boolean }> {
  return request("admin/status");
}

export async function bootstrapAdmin(token: string): Promise<void> {
  await request("admin/bootstrap", { token });
}

export async function getAdminStats(): Promise<FutPulseAdminStats> {
  const result = await request<{ stats: FutPulseAdminStats }>("admin/stats");
  return result.stats;
}
