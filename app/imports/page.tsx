import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatFileSize } from "@/lib/uploads/config";

type ImportBatchRow = {
  import_batch_id: string;
  fiscal_year: number | null;
  period: number | null;
  batch_status: string;
  warning_count: number;
  created_at: string;
  metadata: {
    duplicate_source_file_id?: string | null;
  } | null;
  import_types:
    | {
        import_type_name: string;
        import_type_code: string;
      }
    | Array<{
        import_type_name: string;
        import_type_code: string;
      }>
    | null;
  source_files:
    | {
        source_file_id: string;
        original_file_name: string;
        content_type: string | null;
        byte_size: number | null;
        uploaded_at: string;
        metadata: {
          uploaded_by_email?: string | null;
          duplicate_detected?: boolean;
        } | null;
      }
    | Array<{
        source_file_id: string;
        original_file_name: string;
        content_type: string | null;
        byte_size: number | null;
        uploaded_at: string;
        metadata: {
          uploaded_by_email?: string | null;
          duplicate_detected?: boolean;
        } | null;
      }>
    | null;
};

export default async function ImportsPage() {
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);

  const batchesResult = await adminClient
    .from("import_batches")
    .select(
      `
      import_batch_id,
      fiscal_year,
      period,
      batch_status,
      warning_count,
      created_at,
      metadata,
      import_types (
        import_type_name,
        import_type_code
      ),
      source_files (
        source_file_id,
        original_file_name,
        content_type,
        byte_size,
        uploaded_at,
        metadata
      )
    `
    )
    .eq("organization_id", appUser.organization_id)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<ImportBatchRow[]>();

  const batches = batchesResult.data ?? [];

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Imports
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Uploaded files are preserved as raw source files and linked to
              draft import batches. Files are not parsed, validated, posted, or
              used in dashboards and reports yet.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/imports/templates"
            >
              Import Templates
            </Link>
            <Link
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
              href="/imports/new"
            >
              New Upload
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Upload history</CardTitle>
          </CardHeader>
          <CardContent>
            {batchesResult.error ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Upload history could not be loaded: {batchesResult.error.message}
              </p>
            ) : null}

            {!batchesResult.error && batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No files have been uploaded yet.
              </p>
            ) : null}

            {batches.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">File name</th>
                      <th className="py-3 pr-4 font-medium">Import type</th>
                      <th className="py-3 pr-4 font-medium">Fiscal year</th>
                      <th className="py-3 pr-4 font-medium">Period</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                      <th className="py-3 pr-4 font-medium">Uploaded by</th>
                      <th className="py-3 pr-4 font-medium">Uploaded at</th>
                      <th className="py-3 pr-4 font-medium">File size</th>
                      <th className="py-3 font-medium">Duplicate warning</th>
                      <th className="py-3 font-medium">Template</th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((batch) => {
                      const sourceFile = getRelatedRecord(batch.source_files);
                      const importType = getRelatedRecord(batch.import_types);
                      const duplicateDetected =
                        Boolean(batch.metadata?.duplicate_source_file_id) ||
                        Boolean(sourceFile?.metadata?.duplicate_detected) ||
                        batch.warning_count > 0;

                      return (
                        <tr
                          className="border-b border-border align-top"
                          key={batch.import_batch_id}
                        >
                          <td className="py-3 pr-4 font-medium text-foreground">
                            {sourceFile?.original_file_name ?? "Unknown file"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {importType?.import_type_name ?? "Unknown type"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {batch.fiscal_year ?? "Not provided"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {batch.period ?? "Not provided"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {batch.batch_status}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {sourceFile?.metadata?.uploaded_by_email ??
                              appUser.email}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {formatDate(sourceFile?.uploaded_at ?? batch.created_at)}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {formatFileSize(sourceFile?.byte_size)}
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {duplicateDetected ? "Possible duplicate" : "None"}
                          </td>
                          <td className="py-3">
                            {sourceFile?.source_file_id ? (
                              <Link
                                className="text-sm font-medium text-primary hover:underline"
                                href={`/imports/templates/new?sourceFileId=${sourceFile.source_file_id}`}
                              >
                                Configure template
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">Unavailable</span>
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

function getRelatedRecord<T>(value: T | T[] | null) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
