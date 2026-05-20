import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export const postingRoleNames = ["System Admin", "Finance Admin", "Approver"] as const;
export const reviewRoleNames = [
  "System Admin",
  "Finance Admin",
  "Approver",
  "Reviewer"
] as const;

export async function userHasAnyRole({
  adminClient,
  organizationId,
  roleNames,
  userId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
  roleNames: readonly string[];
  userId: string;
}) {
  const result = await adminClient
    .from("user_roles")
    .select("roles!inner(role_name)")
    .eq("user_id", userId)
    .eq("active_status", "active")
    .eq("roles.organization_id", organizationId)
    .eq("roles.active_status", "active")
    .returns<Array<{ roles: { role_name: string } | Array<{ role_name: string }> }>>();

  if (result.error) {
    throw new Error(result.error.message);
  }

  const allowedRoles = new Set(roleNames);
  return (result.data ?? []).some((row) => {
    const role = Array.isArray(row.roles) ? row.roles[0] : row.roles;
    return role ? allowedRoles.has(role.role_name) : false;
  });
}
