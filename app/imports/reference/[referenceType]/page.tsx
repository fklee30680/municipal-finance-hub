import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { uploadSourceFile } from "@/app/imports/actions";
import { createImportTemplate } from "@/app/imports/templates/actions";
import { AppShell } from "@/components/app-shell";
import { ImportUploadForm } from "@/components/import-upload-form";
import {
  MappingCommitAction,
  MappingPreviewAction
} from "@/components/mapping-import-actions";
import { TemplateBuilderForm } from "@/components/template-builder-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import {
  getReferenceImportConfig,
  type ReferenceImportConfig
} from "@/lib/imports/reference-imports";
import { createAdminClient } from "@/lib/supabase/admin";
import { inspectSourceFileForTemplate } from "@/lib/templates/file-inspection";
import {
  formatFileSize,
  SUPPORTED_IMPORT_TYPE_CODES
} from "@/lib/uploads/config";

type Related<T> = T | T[] | null;

type ImportBatchRow = {
  import_batch_id: string;
  batch_status: string;
  created_at: string;
  template_version_id: string | null;
  rows_accepted: number;
  rows_rejected: number;
  warning_count: number;
  source_files: Related<{
    source_file_id: string;
    original_file_name: string;
    byte_size: number | null;
    uploaded_at: string;
  }>;
};

type ImportTypeOption = {
  import_type_id: string;
  import_type_code: string;
  import_type_name: string;
};

type SourceFileOption = {
  source_file_id: string;
  original_file_name: string;
  uploaded_at: string;
};

type AccountStructureOption = {
  account_structure_id: string;
  structure_name: string;
  version_number: number;
};

type FundRow = {
  fund_id: string;
  fund_code: string;
  fund_name: string;
  fund_type: string | null;
  fund_group: string | null;
  major_fund_flag: string | null;
  active_status: string;
  effective_start_date: string | null;
  effective_end_date: string | null;
  updated_at: string | null;
};

type MappingRunRow = {
  mapping_import_run_id: string;
  run_status: string;
  row_count: number;
  rows_accepted: number;
  rows_rejected: number;
  rows_with_warnings: number;
  new_mappings: number;
  changed_mappings: number;
  unchanged_mappings: number;
  duplicate_rows: number;
  conflicting_rows: number;
  mapping_version_id: string | null;
  committed_at: string | null;
  created_at: string;
};

export default async function ReferenceImportTypePage({
  params,
  searchParams
}: {
  params: Promise<{ referenceType: string }>;
  searchParams: Promise<{
    importBatchId?: string;
    search?: string;
    sourceFileId?: string;
  }>;
}) {
  const { referenceType } = await params;
  const query = await searchParams;
  const config = getReferenceImportConfig(referenceType);

  if (!config) {
    notFound();
  }

  if (
    ["acfr", "departments", "functions", "funds", "objects"].includes(
      config.routeSegment
    )
  ) {
    redirect(
      config.routeSegment === "funds"
        ? "/imports/funds"
        : `/imports/${config.routeSegment}`
    );
  }

  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
  const importType = await adminClient
    .from("import_types")
    .select("import_type_id, import_type_code, import_type_name")
    .eq("organization_id", appUser.organization_id)
    .eq("import_type_code", config.importTypeCode)
    .maybeSingle<ImportTypeOption>();

  if (importType.error || !importType.data) {
    notFound();
  }

  const [batchesResult, activeCount, latestTemplate] = await Promise.all([
    loadReferenceImportBatches({
      adminClient,
      importTypeId: importType.data.import_type_id,
      organizationId: appUser.organization_id
    }),
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

  if (config.routeSegment === "funds") {
    return await renderFundImportPage({
      activeCount,
      adminClient,
      appUserOrganizationId: appUser.organization_id,
      batches,
      batchesError: batchesResult.error?.message,
      config,
      importType: importType.data,
      latestTemplate: latestTemplate.data ?? null,
      query
    });
  }

  return renderGenericReferencePage({
    activeCount,
    batches,
    batchesError: batchesResult.error?.message,
    config,
    latestTemplate: latestTemplate.data ?? null
  });
}

async function renderFundImportPage({
  activeCount,
  adminClient,
  appUserOrganizationId,
  batches,
  batchesError,
  config,
  importType,
  latestTemplate,
  query
}: {
  activeCount: number;
  adminClient: ReturnType<typeof createAdminClient>;
  appUserOrganizationId: string;
  batches: ImportBatchRow[];
  batchesError?: string;
  config: ReferenceImportConfig;
  importType: ImportTypeOption;
  latestTemplate: { template_name: string; updated_at: string } | null;
  query: {
    importBatchId?: string;
    search?: string;
    sourceFileId?: string;
  };
}) {
  const selectedBatch =
    (query.importBatchId
      ? batches.find((batch) => batch.import_batch_id === query.importBatchId)
      : null) ??
    (query.sourceFileId
      ? batches.find(
          (batch) => getRelatedRecord(batch.source_files)?.source_file_id === query.sourceFileId
        )
      : null) ??
    null;
  const selectedSourceFile =
    getRelatedRecord(selectedBatch?.source_files) ??
    (query.sourceFileId
      ? { source_file_id: query.sourceFileId, original_file_name: "Selected source file", uploaded_at: "" }
      : null);
  const [builderData, preview, latestMappingRun, fundsResult] = await Promise.all([
    loadTemplateBuilderData({
      adminClient,
      organizationId: appUserOrganizationId
    }),
    selectedSourceFile?.source_file_id
      ? safelyInspectSourceFile({
          adminClient,
          organizationId: appUserOrganizationId,
          sourceFileId: selectedSourceFile.source_file_id
        })
      : Promise.resolve({ error: null, preview: null }),
    selectedBatch
      ? loadLatestMappingRun({
          adminClient,
          importBatchId: selectedBatch.import_batch_id,
          organizationId: appUserOrganizationId
        })
      : Promise.resolve(null),
    loadFunds({
      adminClient,
      organizationId: appUserOrganizationId,
      search: query.search ?? ""
    })
  ]);
  const funds = fundsResult.data ?? [];
  const importSectionOpen =
    Boolean(query.sourceFileId) ||
    Boolean(selectedBatch) ||
    Boolean(latestMappingRun);

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Reference Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Fund List Update
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Import fund codes and names used for trial balance classification.
              Bad rows stay out, accepted rows can be committed after review,
              and prior mapping history stays traceable.
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
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/imports/new?importTypeCode=fund_mapping"
            >
              Full Workspace
            </Link>
          </div>
        </div>

        {latestMappingRun ? (
          <section
            className={
              latestMappingRun.rows_rejected > 0 || latestMappingRun.conflicting_rows > 0
                ? "rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
                : "rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
            }
          >
            Rows accepted {latestMappingRun.rows_accepted}. Rejected{" "}
            {latestMappingRun.rows_rejected}. Warnings{" "}
            {latestMappingRun.rows_with_warnings}. New{" "}
            {latestMappingRun.new_mappings}. Changed{" "}
            {latestMappingRun.changed_mappings}. Duplicates{" "}
            {latestMappingRun.duplicate_rows}. Conflicts{" "}
            {latestMappingRun.conflicting_rows}.
          </section>
        ) : null}

        <details
          className="rounded-md border border-border bg-card"
          open={importSectionOpen}
        >
          <summary className="cursor-pointer px-6 py-4 text-sm font-semibold text-foreground">
            Import Fund List
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {importSectionOpen ? "Review setup" : "Collapsed"}
            </span>
          </summary>
          <div className="space-y-6 border-t border-border p-6">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Import Fund List
              </h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
                Upload the fund file, pick the header row, and map columns. For
                column fields, use detected headers or manual entries like
                Fund Code, A, B, or 1. The raw file is preserved before any
                review or commit happens.
              </p>
            </div>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">Upload</h3>
              <ImportUploadForm
                action={uploadSourceFile}
                continuePath="/imports/reference/funds"
                defaultImportTypeCode="fund_mapping"
                importTypes={[importType]}
              />
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Import mapping
              </h3>
              <TemplateBuilderForm
                accountStructures={builderData.accountStructures}
                action={createImportTemplate}
                defaultImportTypeId={importType.import_type_id}
                defaultTemplateName="Fund Import"
                importTypes={builderData.importTypes.filter(
                  (type) => type.import_type_code === "fund_mapping"
                )}
                mode="create"
                preview={preview.preview}
                sourceFiles={builderData.sourceFiles}
              />
              {preview.error ? (
                <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  File layout could not be inspected: {preview.error}
                </p>
              ) : null}
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground">
                Review and commit
              </h3>
              {!selectedBatch ? (
                <p className="text-sm text-muted-foreground">
                  Upload or select a fund file before generating review.
                </p>
              ) : !selectedBatch.template_version_id ? (
                <p className="text-sm text-muted-foreground">
                  Save a fund template before previewing bad rows and changes.
                </p>
              ) : (
                <div className="space-y-4">
                  <MappingPreviewAction importBatchId={selectedBatch.import_batch_id} />
                  {latestMappingRun ? (
                    <div className="grid gap-4 text-sm md:grid-cols-5">
                      <InfoItem label="Rows detected" value={latestMappingRun.row_count} />
                      <InfoItem label="Rows accepted" value={latestMappingRun.rows_accepted} />
                      <InfoItem label="Rows rejected" value={latestMappingRun.rows_rejected} />
                      <InfoItem label="New funds" value={latestMappingRun.new_mappings} />
                      <InfoItem label="Changed funds" value={latestMappingRun.changed_mappings} />
                      <InfoItem label="Unchanged" value={latestMappingRun.unchanged_mappings} />
                      <InfoItem label="Duplicates" value={latestMappingRun.duplicate_rows} />
                      <InfoItem label="Conflicts" value={latestMappingRun.conflicting_rows} />
                      <InfoItem
                        label="Mapping version"
                        value={latestMappingRun.mapping_version_id ?? "Not committed"}
                      />
                    </div>
                  ) : null}
                  {latestMappingRun ? (
                    <MappingCommitAction
                      disabled={
                        latestMappingRun.run_status !== "previewed" ||
                        latestMappingRun.rows_accepted === 0
                      }
                      importBatchId={selectedBatch.import_batch_id}
                      mappingImportRunId={latestMappingRun.mapping_import_run_id}
                    />
                  ) : null}
                  <Link
                    className="text-sm font-medium text-primary hover:underline"
                    href={`/imports/${selectedBatch.import_batch_id}/mapping-preview`}
                  >
                    Open full bad-data report
                  </Link>
                </div>
              )}
            </section>
          </div>
        </details>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Reference rows</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-semibold text-foreground">{activeCount}</p>
              <p className="text-sm text-muted-foreground">Active funds</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {latestTemplate
                  ? `${latestTemplate.template_name} updated ${formatDate(latestTemplate.updated_at)}`
                  : "No fund template created yet"}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Workflow</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                Fund imports update reference mappings only after review. This
                does not post trial balance data or update dashboards.
              </p>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Funds</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {activeCount} active funds available for future validation and
              reporting classification.
            </p>
          </div>
          <details
            className="rounded-md border border-border bg-card"
            open={Boolean(query.search)}
          >
            <summary className="cursor-pointer px-6 py-4 text-sm font-semibold text-foreground">
              Search Funds
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {query.search
                  ? `${funds.length} matching rows shown`
                  : "Collapsed"}
              </span>
            </summary>
            <form className="flex max-w-lg gap-2 border-t border-border p-6" method="get">
              <input
                className="min-h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                defaultValue={query.search ?? ""}
                name="search"
                placeholder="Search code, name, group, or type"
              />
              <button className="rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">
                Search
              </button>
            </form>
          </details>

          <Card>
            <CardContent className="pt-6">
              {fundsResult.error ? (
                <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Funds could not be loaded: {fundsResult.error.message}
                </p>
              ) : null}
              {!fundsResult.error && funds.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {query.search
                    ? "No funds match the current search."
                    : "No funds have been committed yet."}
                </p>
              ) : null}
              {funds.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-3 pr-4 font-medium">Fund code</th>
                        <th className="py-3 pr-4 font-medium">Fund name</th>
                        <th className="py-3 pr-4 font-medium">Fund type</th>
                        <th className="py-3 pr-4 font-medium">Fund group</th>
                        <th className="py-3 pr-4 font-medium">Major fund</th>
                        <th className="py-3 pr-4 font-medium">Effective start</th>
                        <th className="py-3 pr-4 font-medium">Effective end</th>
                        <th className="py-3 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funds.map((fund) => (
                        <tr className="border-b border-border align-top" key={fund.fund_id}>
                          <td className="py-3 pr-4 font-mono text-xs font-medium text-foreground">
                            {fund.fund_code}
                          </td>
                          <td className="py-3 pr-4 font-medium text-foreground">
                            {fund.fund_name}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {fund.fund_type ?? "Not set"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {fund.fund_group ?? "Not set"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {fund.major_fund_flag ?? "Not set"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {fund.effective_start_date ?? "Open"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {fund.effective_end_date ?? "Open"}
                          </td>
                          <td className="py-3 text-muted-foreground">
                            {fund.active_status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Fund import history</CardTitle>
          </CardHeader>
          <CardContent>
            <ImportHistoryTable
              batches={batches}
              batchesError={batchesError}
              config={config}
            />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function renderGenericReferencePage({
  activeCount,
  batches,
  batchesError,
  config,
  latestTemplate
}: {
  activeCount: number;
  batches: ImportBatchRow[];
  batchesError?: string;
  config: ReferenceImportConfig;
  latestTemplate: { template_name: string; updated_at: string } | null;
}) {
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
              <p className="text-sm text-muted-foreground">
                Active {config.pluralName.toLowerCase()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Template</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {latestTemplate
                  ? `${latestTemplate.template_name} updated ${formatDate(latestTemplate.updated_at)}`
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
            <ImportHistoryTable
              batches={batches}
              batchesError={batchesError}
              config={config}
            />
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

async function loadReferenceImportBatches({
  adminClient,
  importTypeId,
  organizationId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  importTypeId: string;
  organizationId: string;
}) {
  return adminClient
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
    .eq("organization_id", organizationId)
    .eq("import_type_id", importTypeId)
    .order("created_at", { ascending: false })
    .limit(25)
    .returns<ImportBatchRow[]>();
}

async function loadTemplateBuilderData({
  adminClient,
  organizationId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  organizationId: string;
}): Promise<{
  accountStructures: AccountStructureOption[];
  importTypes: ImportTypeOption[];
  sourceFiles: SourceFileOption[];
}> {
  const [importTypesResult, sourceFilesResult, accountStructuresResult] =
    await Promise.all([
      adminClient
        .from("import_types")
        .select("import_type_id, import_type_code, import_type_name")
        .eq("organization_id", organizationId)
        .eq("active_status", "active")
        .in("import_type_code", [...SUPPORTED_IMPORT_TYPE_CODES])
        .order("import_type_name", { ascending: true })
        .returns<ImportTypeOption[]>(),
      adminClient
        .from("source_files")
        .select("source_file_id, original_file_name, uploaded_at")
        .eq("organization_id", organizationId)
        .eq("active_status", "active")
        .order("uploaded_at", { ascending: false })
        .limit(50)
        .returns<SourceFileOption[]>(),
      adminClient
        .from("account_structures")
        .select("account_structure_id, structure_name, version_number")
        .eq("organization_id", organizationId)
        .eq("active_status", "active")
        .order("structure_name", { ascending: true })
        .returns<AccountStructureOption[]>()
    ]);

  return {
    accountStructures: accountStructuresResult.data ?? [],
    importTypes: importTypesResult.data ?? [],
    sourceFiles: sourceFilesResult.data ?? []
  };
}

async function safelyInspectSourceFile({
  adminClient,
  organizationId,
  sourceFileId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  organizationId: string;
  sourceFileId: string;
}) {
  try {
    return {
      error: null,
      preview: await inspectSourceFileForTemplate({
        adminClient,
        organizationId,
        sourceFileId
      })
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unknown inspection error.",
      preview: null
    };
  }
}

async function loadLatestMappingRun({
  adminClient,
  importBatchId,
  organizationId
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  importBatchId: string;
  organizationId: string;
}) {
  const result = await adminClient
    .from("mapping_import_runs")
    .select(
      "mapping_import_run_id, run_status, row_count, rows_accepted, rows_rejected, rows_with_warnings, new_mappings, changed_mappings, unchanged_mappings, duplicate_rows, conflicting_rows, mapping_version_id, committed_at, created_at"
    )
    .eq("organization_id", organizationId)
    .eq("import_batch_id", importBatchId)
    .in("run_status", ["previewed", "committed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<MappingRunRow>();

  return result.data ?? null;
}

async function loadFunds({
  adminClient,
  organizationId,
  search
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  organizationId: string;
  search: string;
}) {
  let query = adminClient
    .from("funds")
    .select(
      "fund_id, fund_code, fund_name, fund_type, fund_group, major_fund_flag, active_status, effective_start_date, effective_end_date, updated_at"
    )
    .eq("organization_id", organizationId)
    .eq("active_status", "active")
    .order("fund_code", { ascending: true })
    .limit(200);

  if (search.trim()) {
    const pattern = `%${search.trim()}%`;
    query = query.or(
      `fund_code.ilike.${pattern},fund_name.ilike.${pattern},fund_type.ilike.${pattern},fund_group.ilike.${pattern}`
    );
  }

  return query.returns<FundRow[]>();
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

function ImportHistoryTable({
  batches,
  batchesError,
  config
}: {
  batches: ImportBatchRow[];
  batchesError?: string;
  config: ReferenceImportConfig;
}) {
  if (batchesError) {
    return (
      <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
        Import history could not be loaded: {batchesError}
      </p>
    );
  }

  if (batches.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No {config.pluralName.toLowerCase()} imports have been uploaded yet.
      </p>
    );
  }

  return (
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
                      href={`/imports/reference/${config.routeSegment}?sourceFileId=${sourceFile.source_file_id}`}
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
                      href={`/imports/reference/${config.routeSegment}?importBatchId=${batch.import_batch_id}&sourceFileId=${sourceFile?.source_file_id ?? ""}`}
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
  );
}

function InfoItem({
  label,
  value
}: {
  label: string;
  value: number | string | null | undefined;
}) {
  return (
    <div>
      <p className="font-medium text-foreground">{label}</p>
      <p className="break-words text-muted-foreground">{value ?? "Not available"}</p>
    </div>
  );
}

function getRelatedRecord<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium"
  }).format(new Date(value));
}
