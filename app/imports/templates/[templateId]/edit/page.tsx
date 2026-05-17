import Link from "next/link";
import { notFound } from "next/navigation";

import { createImportTemplateVersion } from "@/app/imports/templates/actions";
import { AppShell } from "@/components/app-shell";
import { TemplateBuilderForm } from "@/components/template-builder-form";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { inspectSourceFileForTemplate } from "@/lib/templates/file-inspection";
import { SUPPORTED_IMPORT_TYPE_CODES } from "@/lib/uploads/config";

type TemplateRow = {
  import_template_id: string;
  template_name: string;
  template_description: string | null;
  import_type_id: string;
};

export default async function EditImportTemplatePage({
  params,
  searchParams
}: {
  params: Promise<{ templateId: string }>;
  searchParams: Promise<{ sourceFileId?: string }>;
}) {
  const { templateId } = await params;
  const { sourceFileId } = await searchParams;
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);

  const templateResult = await adminClient
    .from("import_templates")
    .select("import_template_id, template_name, template_description, import_type_id")
    .eq("organization_id", appUser.organization_id)
    .eq("import_template_id", templateId)
    .maybeSingle<TemplateRow>();

  if (templateResult.error || !templateResult.data) {
    notFound();
  }

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
              Create New Template Version
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Editing a template creates a new version. Prior versions are
              retained.
            </p>
          </div>
          <Link
            className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            href={`/imports/templates/${templateId}`}
          >
            Back to template
          </Link>
        </div>

        <TemplateBuilderForm
          accountStructures={data.accountStructures}
          action={createImportTemplateVersion}
          defaultImportTypeId={templateResult.data.import_type_id}
          defaultTemplateDescription={
            templateResult.data.template_description ?? undefined
          }
          defaultTemplateName={templateResult.data.template_name}
          importTypes={data.importTypes}
          mode="edit"
          preview={preview}
          sourceFiles={data.sourceFiles}
          templateId={templateResult.data.import_template_id}
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
