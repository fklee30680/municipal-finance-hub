import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { getReferenceImportConfig } from "@/lib/imports/reference-imports";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatFileSize } from "@/lib/uploads/config";

type ImportBatchRow = {
  import_batch_id: string;
  batch_status: string;
  created_at: string;
  template_version_id: string | null;
  rows_accepted: number;
  rows_rejected: number;
  warning_count: number;
  source_files:
    | {
        source_file_id: string;
        original_file_name: string;
        byte_size: number | null;
        uploaded_at: string;
      }
    | Array<{
        source_file_id: string;
        original_file_name: string;
        byte_size: number | null;
        uploaded_at: string;
      }>
    | null;
};

export default async function ReferenceImportTypePage({
  params
}: {
  params: Promise<{ referenceType: string }>;
}) {
  const { referenceType } = await params;
  const config = getReferenceImportConfig(referenceType);

  if (!config) {
    notFound();
  }

  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
  const importType = await adminClient
    .from("import_types")
    .select("import_type_id, import_type_name")
    .eq("organization_id", appUser.organization_id)
    .eq("import_type_code", config.importTypeCode)
    .maybeSingle<{ import_type_id: string; import_type_name: string }>();

  if (importType.error || !importType.data) {
    notFound();
  }

  const [batchesResult, activeCount, latestTemplate] = await Promise.all([
    adminClient
      .from("import_batches")
      .select(
        `
        import_batch_id,
        batch_status,
        created_at,
        template_version_id,
        rows_accepted,
        rows_rejected,
        warning_count,
        source_files (
          source_file_id,
          original_file_name,
          byte_size,
          uploaded_at
        )
      `
      )
      .eq("organization_id", appUser.organization_id)
      .eq("import_type_id", importType.data.import_type_id)
      .order("created_at", { ascending: false })
      .limit(25)
      .returns<ImportBatchRow[]>(),
    loadActiveReferenceCount({
      adminClient,
      organizationId: appUser.organization_id,
      targetTable: config.targetTable
    }),
    adminClient
      .from("import_templates")
      .select("template_name, updated_at")
      .eq("organization_id", appUser.organization_id)
      .eq("import_type_id", importType.data.import_type_id)
      .eq("active_status", "active")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ template_name: string; updated_at: string }>()
  ]);
  const batches = batchesResult.data ?? [];

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Reference Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {config.name}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {config.description} This lane imports one file or one selected
              Excel sheet into the {config.targetTable} reference table.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/imports/reference"
            >
              All Reference Imports
            </Link>
            <Link
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
              href={`/imports/new?importTypeCode=${config.importTypeCode}`}
            >
              New {config.name}
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Reference rows</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-foreground">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Active {config.pluralName.toLowerCase()}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {latestTemplate.data
                  ? `${latestTemplate.data.template_name} updated ${formatDate(latestTemplate.data.updated_at)}`
                  : "No template created yet"}
              </p>
              <Link
                className="text-sm font-medium text-primary hover:underline"
                href={`/imports/templates/new?importTypeCode=${config.importTypeCode}`}
              >
                Create template
              </Link>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Workflow</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                Upload, configure template, preview bad rows, then commit
                accepted mappings. Rejected rows stay out.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{config.pluralName} import history</CardTitle>
          </CardHeader>
          <CardContent>
            {batchesResult.error ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Import history could not be loaded: {batchesResult.error.message}
              </p>
            ) : null}
            {!batchesResult.error && batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No {config.pluralName.toLowerCase()} imports have been uploaded yet.
              </p>
            ) : null}
            {batches.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">File</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                      <th className="py-3 pr-4 font-medium">Uploaded</th>
                      <th className="py-3 pr-4 font-medium">File size</th>
                      <th className="py-3 pr-4 font-medium">Accepted</th>
                      <th className="py-3 pr-4 font-medium">Rejected</th>
                      <th className="py-3 pr-4 font-medium">Template</th>
                      <th className="py-3 font-medium">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => {
                      const sourceFile = getRelatedRecord(batch.source_files);

                      return (
                        <tr className="border-b border-border align-top" key={batch.import_batch_id}>
                          <td className="py-3 pr-4 font-medium text-foreground">
                            {sourceFile?.original_file_name ?? "Unknown file"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">{batch.batch_status}</td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {formatDate(sourceFile?.uploaded_at ?? batch.created_at)}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {formatFileSize(sourceFile?.byte_size)}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">{batch.rows_accepted}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{batch.rows_rejected}</td>
                          <td className="py-3 pr-4">
                            {sourceFile?.source_file_id ? (
                              <Link
                                className="text-sm font-medium text-primary hover:underline"
                                href={`/imports/templates/new?sourceFileId=${sourceFile.source_file_id}&importTypeCode=${config.importTypeCode}`}
                              >
                                Configure
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">Unavailable</span>
                            )}
                          </td>
                          <td className="py-3">
                            {batch.template_version_id ? (
                              <Link
                                className="text-sm font-medium text-primary hover:underline"
                                href={`/imports/${batch.import_batch_id}/mapping-preview`}
                              >
                                Review import
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">Template needed</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

async function loadActiveReferenceCount({
  adminClient,
  organizationId,
  targetTable
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  organizationId: string;
  targetTable: "funds" | "objects" | "acfr_mappings" | "departments" | "functions";
}) {
  const result = await adminClient
    .from(targetTable)
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("active_status", "active");

  return result.count ?? 0;
}

function getRelatedRecord<T>(value: T | T[] | null) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium"
  }).format(new Date(value));
}
