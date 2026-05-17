import Link from "next/link";

import { createImportTemplate } from "@/app/imports/templates/actions";
import { AppShell } from "@/components/app-shell";
import { TemplateBuilderForm } from "@/components/template-builder-form";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { inspectSourceFileForTemplate } from "@/lib/templates/file-inspection";
import { SUPPORTED_IMPORT_TYPE_CODES } from "@/lib/uploads/config";

export default async function NewImportTemplatePage({
  searchParams
}: {
  searchParams: Promise<{ importTypeCode?: string; sourceFileId?: string }>;
}) {
  const { importTypeCode, sourceFileId } = await searchParams;
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
  const data = await loadTemplateBuilderData({
    adminClient,
    organizationId: appUser.organization_id
  });
  const preview = sourceFileId
    ? await inspectSourceFileForTemplate({
        adminClient,
        organizationId: appUser.organization_id,
        sourceFileId
      })
    : null;

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Import Templates</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Create Import Template
            </h1>
          </div>
          <Link
            className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            href="/imports/templates"
          >
            Back to templates
          </Link>
        </div>

        <TemplateBuilderForm
          accountStructures={data.accountStructures}
          action={createImportTemplate}
          defaultImportTypeId={
            data.importTypes.find(
              (importType) => importType.import_type_code === importTypeCode
            )?.import_type_id
          }
          importTypes={data.importTypes}
          mode="create"
          preview={preview}
          sourceFiles={data.sourceFiles}
        />
      </section>
    </AppShell>
  );
}

async function loadTemplateBuilderData({
  adminClient,
  organizationId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  organizationId: string;
}) {
  const [importTypesResult, sourceFilesResult, accountStructuresResult] =
    await Promise.all([
      adminClient
        .from("import_types")
        .select("import_type_id, import_type_code, import_type_name")
        .eq("organization_id", organizationId)
        .eq("active_status", "active")
        .in("import_type_code", [...SUPPORTED_IMPORT_TYPE_CODES])
        .order("import_type_name", { ascending: true }),
      adminClient
        .from("source_files")
        .select("source_file_id, original_file_name, uploaded_at")
        .eq("organization_id", organizationId)
        .eq("active_status", "active")
        .order("uploaded_at", { ascending: false })
        .limit(50),
      adminClient
        .from("account_structures")
        .select("account_structure_id, structure_name, version_number")
        .eq("organization_id", organizationId)
        .eq("active_status", "active")
        .order("structure_name", { ascending: true })
    ]);

  return {
    importTypes: importTypesResult.data ?? [],
    sourceFiles: sourceFilesResult.data ?? [],
    accountStructures: accountStructuresResult.data ?? []
  };
}
