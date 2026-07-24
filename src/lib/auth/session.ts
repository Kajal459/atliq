// Deliberately simple: v1 access decision is one shared "admin" role for all four
// users (Dhaval, Bhavin, Karan, Jay) - no per-user accounts, no differentiated
// permissions. A single shared password gates the whole dashboard.

export const SESSION_COOKIE_NAME = "atliq_session";

/** The cookie's value is just the session secret itself. Anyone who knows the
 * shared admin password gets a cookie equal to this value; middleware checks
 * for an exact match. Good enough for an internal 4-person tool, not a
 * general-purpose auth system. */
export function expectedSessionValue(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set. Add it to .env.local (see .env.example).");
  }
  return secret;
}

export function checkPassword(candidate: string): boolean {
  const real = process.env.ADMIN_PASSWORD;
  if (!real) {
    throw new Error("ADMIN_PASSWORD is not set. Add it to .env.local (see .env.example).");
  }
  return candidate === real;
}
