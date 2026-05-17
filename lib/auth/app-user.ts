import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";

type AppUserRecord = {
  user_id: string;
  organization_id: string;
  email: string;
  display_name: string | null;
};

type OrganizationRecord = {
  organization_id: string;
  organization_name: string;
};

export async function ensureAppUserForAuthUser(
  adminClient: SupabaseClient,
  authUser: User
) {
  const email = authUser.email ?? `${authUser.id}@unknown.local`;

  const existingUser = await adminClient
    .from("app_users")
    .select("user_id, organization_id, email, display_name")
    .eq("auth_user_id", authUser.id)
    .maybeSingle<AppUserRecord>();

  if (existingUser.error) {
    throw new Error(existingUser.error.message);
  }

  if (existingUser.data) {
    return existingUser.data;
  }

  const organization = await adminClient
    .from("organizations")
    .select("organization_id, organization_name")
    .eq("active_status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<OrganizationRecord>();

  if (organization.error) {
    throw new Error(organization.error.message);
  }

  if (!organization.data) {
    throw new Error("No active organization exists for upload attribution.");
  }

  const existingEmailUser = await adminClient
    .from("app_users")
    .select("user_id, organization_id, email, display_name")
    .eq("organization_id", organization.data.organization_id)
    .eq("email", email)
    .maybeSingle<AppUserRecord>();

  if (existingEmailUser.error) {
    throw new Error(existingEmailUser.error.message);
  }

  if (existingEmailUser.data) {
    const linkedUser = await adminClient
      .from("app_users")
      .update({
        auth_user_id: authUser.id,
        last_login_at: new Date().toISOString()
      })
      .eq("user_id", existingEmailUser.data.user_id)
      .select("user_id, organization_id, email, display_name")
      .single<AppUserRecord>();

    if (linkedUser.error) {
      throw new Error(linkedUser.error.message);
    }

    return linkedUser.data;
  }

  const insertedUser = await adminClient
    .from("app_users")
    .insert({
      organization_id: organization.data.organization_id,
      auth_user_id: authUser.id,
      email,
      display_name: email,
      active_status: "active"
    })
    .select("user_id, organization_id, email, display_name")
    .single<AppUserRecord>();

  if (insertedUser.error) {
    throw new Error(insertedUser.error.message);
  }

  return insertedUser.data;
}
