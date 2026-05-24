import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { isSupportedMappingImportType } from "@/lib/imports/mapping-import";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatFileSize } from "@/lib/uploads/config";

type ImportFilter =
  | "all"
  | "trial_balance"
  | "reference"
  | "needs_action"
  | "posted"
  | "warnings";

type ImportBatchRow = {
  import_batch_id: string;
  fiscal_year: number | null;
  period: number | null;
  batch_status: string;
  active_status: string;
  reporting_status: string;
  is_active_for_reporting: boolean;
  template_version_id: string | null;
  warning_count: number;
  error_count: number;
  rows_processed: number;
  rows_accepted: number;
  rows_rejected: number;
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

export default async function ImportsPage({
  searchParams
}: {
  searchParams: Promise<{ filter?: string; includeInactive?: string }>;
}) {
  const filters = await searchParams;
  const includeInactive = filters.includeInactive === "true";
  const activeFilter = getImportFilter(filters.filter);
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);

  let batchesQuery = adminClient
    .from("import_batches")
    .select(
      `
      import_batch_id,
      fiscal_year,
      period,
      batch_status,
      active_status,
      reporting_status,
      is_active_for_reporting,
      template_version_id,
      warning_count,
      error_count,
      rows_processed,
      rows_accepted,
      rows_rejected,
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
    .limit(50);

  if (!includeInactive) {
    batchesQuery = batchesQuery
      .not("batch_status", "in", "(inactive,superseded,archived,rejected)")
      .neq("active_status", "inactive");
  }

  const batchesResult = await batchesQuery.returns<ImportBatchRow[]>();
  const batches = filterBatches({
    batches: batchesResult.data ?? [],
    filter: activeFilter
  });

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Imports</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Imports
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Use this page to start imports and review recent import activity.
            Trial balance imports and reference imports have separate workflows.
            Advanced tools remain available for review, templates,
            replacements, and reactivation.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(260px,360px)]">
          <PrimaryImportCard
            description="Load monthly or historical trial balances through period selection, saved layout reuse, preview, validation, and post or replace."
            href="/imports/trial-balance"
            linkLabel="Start Trial Balance Import"
            title="Trial Balance Import"
          />
          <PrimaryImportCard
            description="Maintain Funds, Objects, ACFR, Departments, and Functions as setup and classification master data."
            href="/imports/reference"
            linkLabel="Open Reference Imports"
            title="Reference Imports"
          />
          <Card>
            <CardHeader>
              <CardTitle>Advanced tools</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <AdvancedToolLink href="/imports/periods" label="Period Review" />
              <AdvancedToolLink
                href="/imports/replacement-requests"
                label="Replacement Requests"
              />
              <AdvancedToolLink
                href="/imports/reactivation-requests"
                label="Reactivation Requests"
              />
              <AdvancedToolLink href="/imports/templates" label="Import Templates" />
              <AdvancedToolLink
                href="/imports/new"
                label="Advanced Import Workspace"
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <CardTitle>Recent imports</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Recent files, current status, and the most useful next action.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {filterOptions.map((option) => (
                  <Link
                    className={
                      activeFilter === option.value
                        ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                        : "rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                    }
                    href={buildImportsHref({
                      filter: option.value,
                      includeInactive
                    })}
                    key={option.value}
                  >
                    {option.label}
                  </Link>
                ))}
                <Link
                  className="rounded-md border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted"
                  href={buildImportsHref({
                    filter: activeFilter,
                    includeInactive: !includeInactive
                  })}
                >
                  {includeInactive ? "Hide inactive" : "Include inactive"}
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {batchesResult.error ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Upload history could not be loaded: {batchesResult.error.message}
              </p>
            ) : null}

            {!batchesResult.error && batches.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No imports match this view.
              </p>
            ) : null}

            {batches.length > 0 ? (
              <>
                <div className="hidden lg:block">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-3 pr-4 font-medium">File</th>
                        <th className="py-3 pr-4 font-medium">Type</th>
                        <th className="py-3 pr-4 font-medium">Fiscal Period</th>
                        <th className="py-3 pr-4 font-medium">Status / Next Step</th>
                        <th className="py-3 pr-4 font-medium">Uploaded</th>
                        <th className="py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {batches.map((batch) => (
                        <RecentImportRow batch={batch} key={batch.import_batch_id} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="grid gap-3 lg:hidden">
                  {batches.map((batch) => (
                    <RecentImportCard batch={batch} key={batch.import_batch_id} />
                  ))}
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

const filterOptions: Array<{ label: string; value: ImportFilter }> = [
  { label: "All", value: "all" },
  { label: "Trial Balance", value: "trial_balance" },
  { label: "Reference", value: "reference" },
  { label: "Needs Action", value: "needs_action" },
  { label: "Posted", value: "posted" },
  { label: "Errors / Warnings", value: "warnings" }
];

function PrimaryImportCard({
  description,
  href,
  linkLabel,
  title
}: {
  description: string;
  href: string;
  linkLabel: string;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        <Link
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
          href={href}
        >
          {linkLabel}
        </Link>
      </CardContent>
    </Card>
  );
}

function AdvancedToolLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      className="rounded-md border border-border bg-card px-3 py-2 font-medium text-foreground hover:bg-muted"
      href={href}
    >
      {label}
    </Link>
  );
}

function RecentImportRow({ batch }: { batch: ImportBatchRow }) {
  const view = getBatchView(batch);

  return (
    <tr className="border-b border-border align-top">
      <td className="py-3 pr-4">
        <div className="max-w-[280px] space-y-1">
          <p className="break-words font-medium text-foreground">{view.fileName}</p>
          <div className="flex flex-wrap gap-2">
            {view.duplicateDetected ? (
              <StatusBadge tone="warning">Possible duplicate</StatusBadge>
            ) : null}
            <span className="text-xs text-muted-foreground">
              {formatFileSize(view.fileSize)}
            </span>
          </div>
        </div>
      </td>
      <td className="py-3 pr-4 text-muted-foreground">{view.importTypeName}</td>
      <td className="py-3 pr-4 text-muted-foreground">{view.fiscalPeriod}</td>
      <td className="py-3 pr-4">
        <div className="space-y-1">
          <StatusBadge tone={view.statusTone}>{view.statusLabel}</StatusBadge>
          <p className="text-xs leading-5 text-muted-foreground">{view.statusDetail}</p>
        </div>
      </td>
      <td className="py-3 pr-4 text-muted-foreground">
        <div className="space-y-1">
          <p>{formatDate(view.uploadedAt)}</p>
          <p className="text-xs">{view.uploadedBy}</p>
        </div>
      </td>
      <td className="py-3">
        <RowActions view={view} />
      </td>
    </tr>
  );
}

function RecentImportCard({ batch }: { batch: ImportBatchRow }) {
  const view = getBatchView(batch);

  return (
    <div className="space-y-3 rounded-md border border-border p-4">
      <div className="space-y-1">
        <p className="break-words font-medium text-foreground">{view.fileName}</p>
        <p className="text-sm text-muted-foreground">
          {view.importTypeName} - {view.fiscalPeriod}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <StatusBadge tone={view.statusTone}>{view.statusLabel}</StatusBadge>
        {view.duplicateDetected ? (
          <StatusBadge tone="warning">Possible duplicate</StatusBadge>
        ) : null}
      </div>
      <p className="text-sm leading-6 text-muted-foreground">
        {view.statusDetail}
      </p>
      <p className="text-xs text-muted-foreground">
        Uploaded {formatDate(view.uploadedAt)} by {view.uploadedBy}
      </p>
      <RowActions view={view} />
    </div>
  );
}

function RowActions({ view }: { view: ReturnType<typeof getBatchView> }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-2 text-sm">
      <Link className="font-medium text-primary hover:underline" href={view.primaryHref}>
        {view.primaryLabel}
      </Link>
      {view.secondaryActions.map((action) => (
        <Link
          className="font-medium text-muted-foreground hover:text-primary hover:underline"
          href={action.href}
          key={action.label}
        >
          {action.label}
        </Link>
      ))}
    </div>
  );
}

function StatusBadge({
  children,
  tone
}: {
  children: string;
  tone: "default" | "error" | "muted" | "success" | "warning";
}) {
  const className =
    tone === "success"
      ? "border-emerald-300 bg-emerald-50 text-emerald-950"
      : tone === "warning"
      ? "border-amber-300 bg-amber-50 text-amber-950"
      : tone === "error"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : tone === "muted"
      ? "border-border bg-muted text-muted-foreground"
      : "border-primary/30 bg-primary/10 text-primary";

  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}

function getBatchView(batch: ImportBatchRow) {
  const sourceFile = getRelatedRecord(batch.source_files);
  const importType = getRelatedRecord(batch.import_types);
  const importTypeCode = importType?.import_type_code ?? "";
  const isTrialBalance = importTypeCode === "trial_balance";
  const isReference = Boolean(
    importTypeCode && isSupportedMappingImportType(importTypeCode)
  );
  const duplicateDetected =
    Boolean(batch.metadata?.duplicate_source_file_id) ||
    Boolean(sourceFile?.metadata?.duplicate_detected);
  const status = getImportStatus({
    batch,
    duplicateDetected,
    importTypeCode,
    isReference,
    isTrialBalance
  });
  const primaryAction = getPrimaryAction({
    batch,
    importTypeCode,
    isReference,
    isTrialBalance,
    sourceFileId: sourceFile?.source_file_id ?? null,
    statusKey: status.key
  });

  return {
    duplicateDetected,
    fileName: sourceFile?.original_file_name ?? "Unknown file",
    fileSize: sourceFile?.byte_size,
    fiscalPeriod:
      batch.fiscal_year && batch.period !== null
        ? `FY ${batch.fiscal_year} / Period ${batch.period}`
        : "Not provided",
    importBatchId: batch.import_batch_id,
    importTypeCode,
    importTypeName: importType?.import_type_name ?? "Unknown type",
    primaryHref: primaryAction.href,
    primaryLabel: primaryAction.label,
    secondaryActions: getSecondaryActions({
      batch,
      importTypeCode,
      isReference,
      isTrialBalance,
      sourceFileId: sourceFile?.source_file_id ?? null
    }).filter((action) => action.href !== primaryAction.href),
    statusDetail: status.detail,
    statusKey: status.key,
    statusLabel: status.label,
    statusTone: status.tone,
    uploadedAt: sourceFile?.uploaded_at ?? batch.created_at,
    uploadedBy: sourceFile?.metadata?.uploaded_by_email ?? "Current organization"
  };
}

function getImportStatus({
  batch,
  duplicateDetected,
  importTypeCode,
  isReference,
  isTrialBalance
}: {
  batch: ImportBatchRow;
  duplicateDetected: boolean;
  importTypeCode: string;
  isReference: boolean;
  isTrialBalance: boolean;
}) {
  if (batch.batch_status === "archived") {
    return status("archived", "Archived", "muted", "Retained for history.");
  }

  if (batch.batch_status === "superseded") {
    return status(
      "superseded",
      "Superseded",
      "muted",
      "A newer import replaced this period."
    );
  }

  if (batch.batch_status === "posted_with_exceptions") {
    return status(
      "posted",
      "Posted with warnings",
      "warning",
      "Posted and active for reporting, with warnings retained for review."
    );
  }

  if (batch.batch_status === "posted") {
    return status(
      "posted",
      "Posted",
      "success",
      batch.is_active_for_reporting
        ? "Active for reporting."
        : "Posted but not active for reporting."
    );
  }

  if (batch.error_count > 0 || batch.rows_rejected > 0) {
    return status(
      "warnings",
      "Needs review",
      "error",
      "Errors or rejected rows need review before this can continue."
    );
  }

  if (duplicateDetected || batch.warning_count > 0) {
    return status(
      "warnings",
      "Warnings",
      "warning",
      "Warnings are present. Review details before finalizing."
    );
  }

  if (!batch.template_version_id) {
    return status(
      "needs_action",
      "Template needed",
      "default",
      "Configure or apply a template before preview."
    );
  }

  if (isTrialBalance && batch.batch_status === "validated") {
    return status(
      "needs_action",
      "Ready to post",
      "default",
      "Validation is complete. Continue to posting or replacement."
    );
  }

  if (isTrialBalance && batch.batch_status === "previewed") {
    return status(
      "needs_action",
      "Ready to validate",
      "default",
      "Preview is complete. Run validation next."
    );
  }

  if (isReference && batch.batch_status === "previewed") {
    return status(
      "needs_action",
      "Ready to commit",
      "default",
      "Preview is complete. Review accepted rows and commit."
    );
  }

  if (batch.template_version_id) {
    return status(
      "needs_action",
      "Ready to preview",
      "default",
      importTypeCode === "trial_balance"
        ? "Generate trial balance preview."
        : "Preview this reference import."
    );
  }

  return status(
    "needs_action",
    "Continue setup",
    "default",
    "Continue the import workflow."
  );
}

function getPrimaryAction({
  batch,
  importTypeCode,
  isReference,
  isTrialBalance,
  sourceFileId,
  statusKey
}: {
  batch: ImportBatchRow;
  importTypeCode: string;
  isReference: boolean;
  isTrialBalance: boolean;
  sourceFileId: string | null;
  statusKey: string;
}) {
  if (statusKey === "posted" || statusKey === "archived" || statusKey === "superseded") {
    return {
      href: `/imports/${batch.import_batch_id}/review`,
      label: "Review"
    };
  }

  if (!batch.template_version_id && sourceFileId) {
    return {
      href: `/imports/templates/new?sourceFileId=${sourceFileId}`,
      label: "Configure Template"
    };
  }

  if (isTrialBalance && batch.batch_status === "validated") {
    return {
      href: `/imports/${batch.import_batch_id}/post`,
      label: "Post / Replace"
    };
  }

  if (isTrialBalance && batch.batch_status === "previewed") {
    return {
      href: `/imports/${batch.import_batch_id}/validation`,
      label: "Validate"
    };
  }

  if (isTrialBalance) {
    return {
      href: `/imports/${batch.import_batch_id}/preview`,
      label: "Preview"
    };
  }

  if (isReference) {
    return {
      href: `/imports/${batch.import_batch_id}/mapping-preview`,
      label: "Preview / Commit"
    };
  }

  return {
    href: `/imports/new?importBatchId=${batch.import_batch_id}&sourceFileId=${sourceFileId ?? ""}&importTypeCode=${importTypeCode}`,
    label: "Continue"
  };
}

function getSecondaryActions({
  batch,
  importTypeCode,
  isReference,
  isTrialBalance,
  sourceFileId
}: {
  batch: ImportBatchRow;
  importTypeCode: string;
  isReference: boolean;
  isTrialBalance: boolean;
  sourceFileId: string | null;
}) {
  const actions: Array<{ href: string; label: string }> = [];

  if (sourceFileId) {
    actions.push({
      href: `/imports/templates/new?sourceFileId=${sourceFileId}`,
      label: "Template"
    });
  }

  if (isTrialBalance) {
    actions.push(
      { href: `/imports/${batch.import_batch_id}/preview`, label: "Preview" },
      {
        href: `/imports/${batch.import_batch_id}/validation`,
        label: "Validation"
      },
      { href: `/imports/${batch.import_batch_id}/post`, label: "Post / Replace" }
    );
  }

  if (isReference) {
    actions.push({
      href: `/imports/${batch.import_batch_id}/mapping-preview`,
      label: "Mapping Review"
    });
  }

  actions.push({
    href: `/imports/${batch.import_batch_id}/review`,
    label:
      batch.is_active_for_reporting ||
      ["posted", "posted_with_exceptions"].includes(batch.batch_status)
        ? "Review"
        : "Review / Archive"
  });

  if (sourceFileId && importTypeCode) {
    actions.push({
      href: `/imports/new?importBatchId=${batch.import_batch_id}&sourceFileId=${sourceFileId}&importTypeCode=${importTypeCode}`,
      label: "Workspace"
    });
  }

  return actions;
}

function status(
  key: string,
  label: string,
  tone: "default" | "error" | "muted" | "success" | "warning",
  detail: string
) {
  return { detail, key, label, tone };
}

function filterBatches({
  batches,
  filter
}: {
  batches: ImportBatchRow[];
  filter: ImportFilter;
}) {
  if (filter === "all") {
    return batches;
  }

  return batches.filter((batch) => {
    const importType = getRelatedRecord(batch.import_types);
    const importTypeCode = importType?.import_type_code ?? "";
    const isReference = Boolean(
      importTypeCode && isSupportedMappingImportType(importTypeCode)
    );
    const isTrialBalance = importTypeCode === "trial_balance";
    const sourceFile = getRelatedRecord(batch.source_files);
    const duplicateDetected =
      Boolean(batch.metadata?.duplicate_source_file_id) ||
      Boolean(sourceFile?.metadata?.duplicate_detected);
    const statusView = getImportStatus({
      batch,
      duplicateDetected,
      importTypeCode,
      isReference,
      isTrialBalance
    });

    if (filter === "trial_balance") return isTrialBalance;
    if (filter === "reference") return isReference;
    if (filter === "needs_action") return statusView.key === "needs_action";
    if (filter === "posted") return statusView.key === "posted";
    if (filter === "warnings") return statusView.key === "warnings";
    return true;
  });
}

function getImportFilter(value: string | undefined): ImportFilter {
  return filterOptions.some((option) => option.value === value)
    ? (value as ImportFilter)
    : "all";
}

function buildImportsHref({
  filter,
  includeInactive
}: {
  filter: ImportFilter;
  includeInactive: boolean;
}) {
  const params = new URLSearchParams();
  if (filter !== "all") params.set("filter", filter);
  if (includeInactive) params.set("includeInactive", "true");
  const query = params.toString();
  return query ? `/imports?${query}` : "/imports";
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
