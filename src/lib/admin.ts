import { getSessionUser, SessionUser } from "./auth";

// Admin gate: session user whose email is listed in ADMIN_EMAILS (comma-separated).
// When ADMIN_EMAILS is unset, admin access is allowed only outside production
// so local dev/demo keeps working; production fails closed.
export async function requireAdmin(): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const list = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (list.length === 0) {
    return process.env.NODE_ENV === "production" ? null : user;
  }
  return user.email && list.includes(user.email.toLowerCase()) ? user : null;
}