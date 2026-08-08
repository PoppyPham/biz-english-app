// Super-admin identity. Used for UI gating only — real enforcement is via the
// Supabase `admins` table + is_admin() in RLS policies (see supabase/admin.sql).
// These ids are not secret (they ship in the client bundle); RLS is the gate.

export const ADMIN_USER_IDS = [
  "d05d7f2f-b7f9-49fa-b64f-eba5162e08bf", // production (psb.jct@gmail.com)
  "26028d15-d589-477b-9840-d2af7bdf94e1", // local dev (psb.jct@gmail.com)
]

export function isAdmin(
  user: { id?: string | null } | null | undefined
): boolean {
  return !!user?.id && ADMIN_USER_IDS.includes(user.id)
}
