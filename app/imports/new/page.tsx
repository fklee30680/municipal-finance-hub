import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ImportUploadForm } from "@/components/import-upload-form";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPPORTED_IMPORT_TYPE_CODES } from "@/lib/uploads/config";

export default async function NewImportPage() {
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);

  const importTypesResult = await adminClient
    .from("import_types")
    .select("import_type_id, import_type_code, import_type_name")
    .eq("organization_id", appUser.organization_id)
    .eq("active_status", "active")
    .in("import_type_code", [...SUPPORTED_IMPORT_TYPE_CODES])
    .order("import_type_name", { ascending: true });

  const importTypes = importTypesResult.data ?? [];

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Upload Source File
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              This step stores the raw source file and creates an import batch.
              Parsing, template mapping, validation, and posting happen in later
              steps.
            </p>
          </div>
          <Link
            className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            href="/imports"
          >
            Back to imports
          </Link>
        </div>

        {importTypesResult.error ? (
          <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Import types could not be loaded: {importTypesResult.error.message}
          </p>
        ) : null}

        <ImportUploadForm importTypes={importTypes} />
      </section>
    </AppShell>
  );
}
