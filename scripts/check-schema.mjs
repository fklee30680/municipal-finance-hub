import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260517000100_core_schema.sql"
);
const setupMigrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260517000200_setup_configuration.sql"
);
const rawUploadMigrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260517000300_raw_file_upload_storage.sql"
);
const templateBuilderMigrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260517000400_template_builder_support.sql"
);
const trialBalancePreviewMigrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260517000500_trial_balance_preview.sql"
);
const mappingImportMigrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260517000600_mapping_reference_imports.sql"
);
const validationMigrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260519023954_trial_balance_validation.sql"
);
const postingMigrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260519234331_post_validated_trial_balance.sql"
);
const analysisMigrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260523000100_analysis_outputs_mapping_coverage.sql"
);

const requiredTables = [
  "organizations",
  "app_users",
  "roles",
  "user_roles",
  "fiscal_years",
  "fiscal_periods",
  "account_structures",
  "account_segment_definitions",
  "import_types",
  "import_templates",
  "import_template_versions",
  "sheet_mappings",
  "field_mappings",
  "transformation_rules",
  "validation_rules",
  "source_files",
  "import_batches",
  "import_exceptions",
  "trial_balance_lines",
  "trial_balance_line_segments",
  "funds",
  "acfr_mappings",
  "departments",
  "functions",
  "objects",
  "mapping_versions",
  "calculation_runs",
  "financial_summary_results",
  "statement_summary_results",
  "variance_results",
  "trend_results",
  "exception_results",
  "threshold_configs",
  "report_templates",
  "report_template_versions",
  "report_instances",
  "report_parameters",
  "report_comments",
  "report_exports",
  "report_import_batches",
  "report_mapping_versions",
  "audit_logs",
  "inactivation_requests",
  "reactivation_requests"
];

const requiredSnippets = [
  "create extension if not exists \"pgcrypto\"",
  "City Standard Account Structure",
  "Default Municipal Organization",
  "trial_balance",
  "fund_mapping",
  "object_mapping",
  "acfr_mapping",
  "department_mapping",
  "function_mapping",
  "Monthly Finance Report Shell",
  "Default Materiality Threshold Shell",
  "active_trial_balance_lines",
  "retained_unchanged boolean not null default true"
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

if (!existsSync(migrationPath)) {
  fail(`Missing migration: ${migrationPath}`);
} else {
  const sql = readFileSync(migrationPath, "utf8");

  for (const table of requiredTables) {
    if (!sql.includes(`create table public.${table}`)) {
      fail(`Missing table: ${table}`);
    }
  }

  for (const snippet of requiredSnippets) {
    if (!sql.includes(snippet)) {
      fail(`Missing required migration content: ${snippet}`);
    }
  }

  const forbiddenBudgetTables = [
    "create table public.budgets",
    "create table public.budget_imports",
    "budget_to_actual"
  ];

  for (const snippet of forbiddenBudgetTables) {
    if (sql.includes(snippet)) {
      fail(`Budget workflow appears to be implemented too early: ${snippet}`);
    }
  }
}

if (!existsSync(setupMigrationPath)) {
  fail(`Missing setup migration: ${setupMigrationPath}`);
} else {
  const setupSql = readFileSync(setupMigrationPath, "utf8");

  const setupSnippets = [
    "create table if not exists public.organization_settings",
    "organization_display_name text not null",
    "current_fiscal_year text",
    "fiscal_year_start_date date",
    "fiscal_year_end_date date",
    "standard_period_count integer not null default 12",
    "enable_period_0 boolean not null default false",
    "enable_period_13 boolean not null default false",
    "enable_accrual_reporting boolean not null default false",
    "default_report_period_mode text not null default 'standard'",
    "organization_settings_report_period_mode_check",
    "check (period between 0 and 13)",
    "System Admin",
    "Finance Admin",
    "Importer",
    "Reviewer",
    "Approver",
    "Viewer",
    "Monthly Finance Report"
  ];

  for (const snippet of setupSnippets) {
    if (!setupSql.includes(snippet)) {
      fail(`Missing required setup migration content: ${snippet}`);
    }
  }
}

if (!existsSync(rawUploadMigrationPath)) {
  fail(`Missing raw upload migration: ${rawUploadMigrationPath}`);
} else {
  const rawUploadSql = readFileSync(rawUploadMigrationPath, "utf8");
  const rawUploadSnippets = [
    "source-files",
    "file_size_limit",
    "26214400",
    "add column if not exists fiscal_year integer",
    "add column if not exists period integer",
    "duplicate_source_file_id",
    "idx_source_files_org_checksum"
  ];

  for (const snippet of rawUploadSnippets) {
    if (!rawUploadSql.includes(snippet)) {
      fail(`Missing required raw upload migration content: ${snippet}`);
    }
  }
}

if (!existsSync(templateBuilderMigrationPath)) {
  fail(`Missing template builder migration: ${templateBuilderMigrationPath}`);
} else {
  const templateBuilderSql = readFileSync(templateBuilderMigrationPath, "utf8");
  const templateBuilderSnippets = [
    "add column if not exists source_file_id uuid",
    "add column if not exists file_type text",
    "add column if not exists source_sample_payload jsonb",
    "add column if not exists target_import_type_id uuid",
    "add column if not exists ignore_sheet boolean",
    "add column if not exists source_column_index integer",
    "add column if not exists default_value text",
    "add column if not exists ignore_column boolean"
  ];

  for (const snippet of templateBuilderSnippets) {
    if (!templateBuilderSql.includes(snippet)) {
      fail(`Missing required template builder migration content: ${snippet}`);
    }
  }
}

if (!existsSync(trialBalancePreviewMigrationPath)) {
  fail(`Missing trial balance preview migration: ${trialBalancePreviewMigrationPath}`);
} else {
  const previewSql = readFileSync(trialBalancePreviewMigrationPath, "utf8");
  const previewSnippets = [
    "create table if not exists public.import_preview_runs",
    "create table if not exists public.import_preview_rows",
    "create table if not exists public.import_preview_issues",
    "batch_status in ('draft', 'uploaded', 'previewed'",
    "full_account_number text",
    "fund_code text",
    "acfr_code text",
    "department_code text",
    "function_code text",
    "object_code text",
    "raw_row_json jsonb",
    "transformed_row_json jsonb",
    "issue_severity in ('info', 'warning', 'error')"
  ];

  for (const snippet of previewSnippets) {
    if (!previewSql.includes(snippet)) {
      fail(`Missing required trial balance preview migration content: ${snippet}`);
    }
  }
}

if (!existsSync(mappingImportMigrationPath)) {
  fail(`Missing mapping import migration: ${mappingImportMigrationPath}`);
} else {
  const mappingImportSql = readFileSync(mappingImportMigrationPath, "utf8");
  const mappingImportSnippets = [
    "create table if not exists public.mapping_import_runs",
    "create table if not exists public.mapping_import_rows",
    "create table if not exists public.mapping_import_issues",
    "mapping_type text not null check",
    "target_table text not null check",
    "row_status text not null check",
    "add column if not exists fund_group text",
    "add column if not exists balance_sheet_category text",
    "add column if not exists acfr_description text",
    "add column if not exists function_description text",
    "source_import_batch_id uuid",
    "source_method text not null default 'import'",
    "change_reason text",
    "mapping_imported"
  ];

  for (const snippet of mappingImportSnippets) {
    if (!mappingImportSql.includes(snippet)) {
      fail(`Missing required mapping import migration content: ${snippet}`);
    }
  }
}

if (!existsSync(validationMigrationPath)) {
  fail(`Missing validation migration: ${validationMigrationPath}`);
} else {
  const validationSql = readFileSync(validationMigrationPath, "utf8");
  const validationSnippets = [
    "create table if not exists public.validation_runs",
    "create table if not exists public.validation_run_mapping_versions",
    "create table if not exists public.warning_acknowledgements",
    "add column if not exists validation_run_id",
    "add column if not exists preview_row_id",
    "add column if not exists source_column_name",
    "severity in ('critical_error', 'warning', 'information'",
    "validation_failed",
    "validated_with_warnings",
    "idx_validation_runs_batch"
  ];

  for (const snippet of validationSnippets) {
    if (!validationSql.includes(snippet)) {
      fail(`Missing required validation migration content: ${snippet}`);
    }
  }
}

if (!existsSync(postingMigrationPath)) {
  fail(`Missing posting migration: ${postingMigrationPath}`);
} else {
  const postingSql = readFileSync(postingMigrationPath, "utf8");
  const postingSnippets = [
    "create table if not exists public.posting_runs",
    "create table if not exists public.posting_run_mapping_versions",
    "add column if not exists validation_run_id",
    "add column if not exists posting_run_id",
    "add column if not exists active_status",
    "add column if not exists segment_position",
    "posted_with_exceptions",
    "replacement_import_batch_id",
    "conflict_status",
    "create or replace view public.active_trial_balance_lines",
    "idx_trial_balance_lines_active_period"
  ];

  for (const snippet of postingSnippets) {
    if (!postingSql.includes(snippet)) {
      fail(`Missing required posting migration content: ${snippet}`);
    }
  }
}

if (!existsSync(analysisMigrationPath)) {
  fail(`Missing analysis migration: ${analysisMigrationPath}`);
} else {
  const analysisSql = readFileSync(analysisMigrationPath, "utf8");
  const analysisSnippets = [
    "create table if not exists public.sign_convention_configs",
    "create table if not exists public.mapping_coverage_results",
    "add column if not exists dependency_manifest",
    "add column if not exists calculation_version",
    "add column if not exists mapping_coverage_status",
    "add column if not exists trial_balance_import_batch_ids",
    "add column if not exists severity_level",
    "mvp_actuals_v1",
    "MVP Calculation Thresholds",
    "MVP Actuals Sign Convention",
    "idx_mapping_coverage_results_run"
  ];

  for (const snippet of analysisSnippets) {
    if (!analysisSql.includes(snippet)) {
      fail(`Missing required analysis migration content: ${snippet}`);
    }
  }
}

const requiredDocs = [
  "docs/product-spec.md",
  "docs/build-plan.md",
  "docs/architecture-decisions.md",
  "docs/database-schema.md",
  "docs/fiscal-calendar.md",
  "docs/raw-file-upload.md",
  "docs/template-builder.md",
  "docs/trial-balance-preview.md",
  "docs/mapping-imports.md",
  "docs/trial-balance-validation.md",
  "docs/posting-and-data-review.md",
  "docs/import-workspace.md",
  "docs/analysis-outputs.md",
  "TASKS.md"
];

for (const doc of requiredDocs) {
  if (!existsSync(join(root, doc))) {
    fail(`Missing documentation file: ${doc}`);
  }
}

const setupPagePath = join(root, "app", "settings", "setup", "page.tsx");
if (!existsSync(setupPagePath)) {
  fail("Missing setup page: app/settings/setup/page.tsx");
} else {
  const setupPage = readFileSync(setupPagePath, "utf8");
  const setupPageLabels = [
    "Setup Configuration",
    "Organization Setup",
    "Fiscal Year Setup",
    "Reporting Period Options",
    "Organization name",
    "Current fiscal year",
    "Fiscal year start date",
    "Fiscal year end date",
    "Standard period count",
    "Period 0 enabled",
    "Period 13 enabled",
    "Accrual reporting enabled",
    "Default report period mode"
  ];

  for (const label of setupPageLabels) {
    if (!setupPage.includes(label)) {
      fail(`Missing setup page label: ${label}`);
    }
  }
}

const importsPagePath = join(root, "app", "imports", "page.tsx");
const newImportPagePath = join(root, "app", "imports", "new", "page.tsx");
const uploadActionPath = join(root, "app", "imports", "actions.ts");
const hashUtilityPath = join(root, "lib", "uploads", "file-hash.ts");
const uploadConfigPath = join(root, "lib", "uploads", "config.ts");

const requiredUploadFiles = [
  importsPagePath,
  newImportPagePath,
  uploadActionPath,
  hashUtilityPath,
  uploadConfigPath
];

for (const file of requiredUploadFiles) {
  if (!existsSync(file)) {
    fail(`Missing raw upload file: ${file}`);
  }
}

if (existsSync(importsPagePath)) {
  const importsPage = readFileSync(importsPagePath, "utf8");
  const importsPageSnippets = [
    "Reference Imports",
    "Import Workspace",
    "Upload history",
    "No files have been uploaded yet.",
    "Duplicate warning"
  ];

  for (const snippet of importsPageSnippets) {
    if (!importsPage.includes(snippet)) {
      fail(`Missing imports history content: ${snippet}`);
    }
  }
}

if (existsSync(newImportPagePath)) {
  const newImportPage = readFileSync(newImportPagePath, "utf8");
  const newImportPageSnippets = [
    "Import Workspace",
    "NextActionPanel",
    "Upload or Select Source File",
    "File Layout and Column Mapping",
    "Commit or Post"
  ];

  for (const snippet of newImportPageSnippets) {
    if (!newImportPage.includes(snippet)) {
      fail(`Missing new upload page content: ${snippet}`);
    }
  }
}

if (existsSync(uploadActionPath)) {
  const uploadAction = readFileSync(uploadActionPath, "utf8");
  const uploadActionSnippets = [
    "isAcceptedUploadFileName",
    "MAX_UPLOAD_BYTES",
    "sha256Hex",
    "checksum_sha256",
    "duplicate_source_file_id",
    "batch_status: \"uploaded\"",
    "is_active_for_reporting: false",
    "rows_processed: 0",
    "file_uploaded"
  ];

  for (const snippet of uploadActionSnippets) {
    if (!uploadAction.includes(snippet)) {
      fail(`Missing upload action content: ${snippet}`);
    }
  }
}

if (existsSync(hashUtilityPath)) {
  const hashUtility = readFileSync(hashUtilityPath, "utf8");

  if (!hashUtility.includes("sha256") || !hashUtility.includes("digest(\"hex\")")) {
    fail("File hash utility does not appear to create stable SHA-256 hex hashes.");
  }
}

if (existsSync(uploadConfigPath)) {
  const uploadConfig = readFileSync(uploadConfigPath, "utf8");
  const uploadConfigSnippets = [".csv", ".xlsx", ".xls", "25 * 1024 * 1024"];

  for (const snippet of uploadConfigSnippets) {
    if (!uploadConfig.includes(snippet)) {
      fail(`Missing upload config content: ${snippet}`);
    }
  }
}

const templateRouteFiles = [
  "app/imports/templates/page.tsx",
  "app/imports/templates/new/page.tsx",
  "app/imports/templates/[templateId]/page.tsx",
  "app/imports/templates/[templateId]/edit/page.tsx",
  "app/imports/templates/actions.ts",
  "components/template-builder-form.tsx",
  "components/import-workspace-panels.tsx",
  "lib/imports/workflow-state.ts",
  "lib/templates/target-fields.ts",
  "lib/templates/file-inspection.ts",
  "lib/templates/transformations.ts"
];

for (const file of templateRouteFiles) {
  if (!existsSync(join(root, file))) {
    fail(`Missing template builder file: ${file}`);
  }
}

const targetFieldCatalogPath = join(root, "lib", "templates", "target-fields.ts");
if (existsSync(targetFieldCatalogPath)) {
  const targetFieldCatalog = readFileSync(targetFieldCatalogPath, "utf8");
  const targetFieldSnippets = [
    "full_account_number",
    "beginning_balance",
    "ending_balance",
    "fund_code",
    "object_code",
    "acfr_code",
    "department_code",
    "function_code"
  ];

  for (const snippet of targetFieldSnippets) {
    if (!targetFieldCatalog.includes(snippet)) {
      fail(`Missing target field catalog content: ${snippet}`);
    }
  }
}

const templateActionPath = join(root, "app", "imports", "templates", "actions.ts");
if (existsSync(templateActionPath)) {
  const templateAction = readFileSync(templateActionPath, "utf8");
  const actionSnippets = [
    "createImportTemplate",
    "createImportTemplateVersion",
    "version_number",
    "sheet_mappings",
    "field_mappings",
    "transformation_rules",
    "template_version_selected",
    "Trial balance templates require an account structure",
    "Mapping templates must keep exactly one active selected sheet",
    "getManualColumnIndex"
  ];

  for (const snippet of actionSnippets) {
    if (!templateAction.includes(snippet)) {
      fail(`Missing template action content: ${snippet}`);
    }
  }
}

const templateBuilderFormPath = join(root, "components", "template-builder-form.tsx");
if (existsSync(templateBuilderFormPath)) {
  const templateBuilderForm = readFileSync(templateBuilderFormPath, "utf8");
  const templateBuilderSnippets = [
    "Manual column overrides",
    "Column letter",
    "Column number",
    "columnIndexToLetter",
    "MANUAL_MAPPING_ROW_COUNT"
  ];

  for (const snippet of templateBuilderSnippets) {
    if (!templateBuilderForm.includes(snippet)) {
      fail(`Missing template builder UX content: ${snippet}`);
    }
  }
}

const workflowStatePath = join(root, "lib", "imports", "workflow-state.ts");
if (existsSync(workflowStatePath)) {
  const workflowState = readFileSync(workflowStatePath, "utf8");
  const workflowSnippets = [
    "getNextImportWorkflowAction",
    "Upload or select a source file",
    "Map columns and save template",
    "Run trial balance validation",
    "Commit accepted mappings",
    "Post validated trial balance"
  ];

  for (const snippet of workflowSnippets) {
    if (!workflowState.includes(snippet)) {
      fail(`Missing workflow-state content: ${snippet}`);
    }
  }
}

const trialBalancePreviewFiles = [
  "app/imports/[importBatchId]/preview/page.tsx",
  "app/imports/[importBatchId]/preview/actions.ts",
  "components/trial-balance-preview-action.tsx",
  "lib/imports/account-parser.ts",
  "lib/imports/file-parsers.ts",
  "lib/imports/transformations.ts",
  "lib/imports/trial-balance-preview.ts"
];

for (const file of trialBalancePreviewFiles) {
  if (!existsSync(join(root, file))) {
    fail(`Missing trial balance preview file: ${file}`);
  }
}

const accountParserPath = join(root, "lib", "imports", "account-parser.ts");
if (existsSync(accountParserPath)) {
  const accountParser = readFileSync(accountParserPath, "utf8");
  const accountParserSnippets = [
    "segmentCount",
    "removeTrailingDelimiters",
    "preserveLeadingZeros",
    "parsedSegments",
    "account_segment_count_mismatch"
  ];

  for (const snippet of accountParserSnippets) {
    if (!accountParser.includes(snippet)) {
      fail(`Missing account parser content: ${snippet}`);
    }
  }
}

const previewEnginePath = join(root, "lib", "imports", "trial-balance-preview.ts");
if (existsSync(previewEnginePath)) {
  const previewEngine = readFileSync(previewEnginePath, "utf8");
  const previewEngineSnippets = [
    "getRequiredTargetFieldNames(\"trial_balance\")",
    "loadSourceFileRows",
    "parseAccountNumber",
    "applyCellTransformations",
    "parsePreviewNumber",
    "batch_status: \"previewed\"",
    "is_active_for_reporting: false",
    "trial_balance_preview_generated"
  ];

  for (const snippet of previewEngineSnippets) {
    if (!previewEngine.includes(snippet)) {
      fail(`Missing trial balance preview engine content: ${snippet}`);
    }
  }
}

const transformationEnginePath = join(root, "lib", "imports", "transformations.ts");
if (existsSync(transformationEnginePath)) {
  const transformationEngine = readFileSync(transformationEnginePath, "utf8");
  const transformationSnippets = [
    "normalizeAmountValue",
    ".replace(/,/g, \"\")",
    ".replace(/\\$/g, \"\")",
    "startsWith(\"(\")",
    "Object.is(parsedValue, -0)"
  ];

  for (const snippet of transformationSnippets) {
    if (!transformationEngine.includes(snippet)) {
      fail(`Missing trial balance numeric parsing support: ${snippet}`);
    }
  }
}

const previewPagePath = join(root, "app", "imports", "[importBatchId]", "preview", "page.tsx");
if (existsSync(previewPagePath)) {
  const previewPage = readFileSync(previewPagePath, "utf8");
  const previewPageSnippets = [
    "Trial Balance Preview",
    "Preview only",
    "Preview summary",
    "Preview rows",
    "Rows with preview issues",
    "Generate preview"
  ];

  for (const snippet of previewPageSnippets) {
    if (!previewPage.includes(snippet)) {
      fail(`Missing trial balance preview page content: ${snippet}`);
    }
  }
}

const mappingImportFiles = [
  "app/imports/[importBatchId]/mapping-preview/page.tsx",
  "app/imports/[importBatchId]/mapping-preview/actions.ts",
  "app/imports/[importBatchId]/mapping-preview/bad-data.csv/route.ts",
  "app/imports/acfr/page.tsx",
  "app/imports/departments/page.tsx",
  "app/imports/funds/page.tsx",
  "app/imports/funds/actions.ts",
  "app/imports/functions/page.tsx",
  "app/imports/objects/page.tsx",
  "app/imports/reference-actions.ts",
  "app/imports/reference/page.tsx",
  "app/imports/reference/[referenceType]/page.tsx",
  "components/fund-import-form.tsx",
  "components/mapping-import-actions.tsx",
  "components/simple-reference-import-form.tsx",
  "components/simple-reference-import-page.tsx",
  "lib/imports/fund-import.ts",
  "lib/imports/fund-import-state.ts",
  "lib/imports/mapping-import.ts",
  "lib/imports/mapping-import-state.ts",
  "lib/imports/reference-imports.ts",
  "lib/imports/simple-reference-import.ts",
  "lib/imports/simple-reference-import-config.ts",
  "lib/imports/simple-reference-import-state.ts"
];

for (const file of mappingImportFiles) {
  if (!existsSync(join(root, file))) {
    fail(`Missing mapping import file: ${file}`);
  }
}

const mappingImportEnginePath = join(root, "lib", "imports", "mapping-import.ts");
if (existsSync(mappingImportEnginePath)) {
  const mappingImportEngine = readFileSync(mappingImportEnginePath, "utf8");
  const mappingImportEngineSnippets = [
    "fund_mapping",
    "object_mapping",
    "acfr_mapping",
    "department_mapping",
    "function_mapping",
    "loadSourceFileRows",
    "applyCellTransformations",
    "duplicate_mapping_code",
    "missing_required_field",
    "mapping_import_preview_generated",
    "mapping_import_committed",
    "batch_status: \"mapping_imported\""
  ];

  for (const snippet of mappingImportEngineSnippets) {
    if (!mappingImportEngine.includes(snippet)) {
      fail(`Missing mapping import engine content: ${snippet}`);
    }
  }
}

const mappingImportPagePath = join(root, "app", "imports", "[importBatchId]", "mapping-preview", "page.tsx");
if (existsSync(mappingImportPagePath)) {
  const mappingImportPage = readFileSync(mappingImportPagePath, "utf8");
  const mappingImportPageSnippets = [
    "Mapping Import Review",
    "Rows accepted",
    "Rows rejected",
    "Bad-data report",
    "Export CSV",
    "Commit action"
  ];

  for (const snippet of mappingImportPageSnippets) {
    if (!mappingImportPage.includes(snippet)) {
      fail(`Missing mapping import page content: ${snippet}`);
    }
  }
}

const referenceImportPagePath = join(root, "app", "imports", "reference", "[referenceType]", "page.tsx");
if (existsSync(referenceImportPagePath)) {
  const referenceImportPage = readFileSync(referenceImportPagePath, "utf8");
  const redirectSnippets = [
    "\"acfr\"",
    "\"departments\"",
    "\"functions\"",
    "\"objects\"",
    "redirect("
  ];

  for (const snippet of redirectSnippets) {
    if (!referenceImportPage.includes(snippet)) {
      fail(`Reference legacy route redirect is missing: ${snippet}`);
    }
  }
}

const fundImportPagePath = join(root, "app", "imports", "funds", "page.tsx");
if (existsSync(fundImportPagePath)) {
  const fundImportPage = readFileSync(fundImportPagePath, "utf8");
  const fundImportUxSnippets = [
    "Fund List Update",
    "Search Funds",
    "FundImportForm",
    "No funds have been committed yet"
  ];

  for (const snippet of fundImportUxSnippets) {
    if (!fundImportPage.includes(snippet)) {
      fail(`Missing fund import UX content: ${snippet}`);
    }
  }
}

const fundImportFormPath = join(root, "components", "fund-import-form.tsx");
if (existsSync(fundImportFormPath)) {
  const fundImportForm = readFileSync(fundImportFormPath, "utf8");
  const fundImportFormSnippets = [
    "Import Funds",
    "Fund Code",
    "Update existing funds",
    "Fill missing data on existing funds",
    "Fund Import Preview",
    "Delete / exclude",
    "Commit Funds",
    "xl:grid-cols-4",
    "Bad-data report"
  ];

  for (const snippet of fundImportFormSnippets) {
    if (!fundImportForm.includes(snippet)) {
      fail(`Missing fund import form content: ${snippet}`);
    }
  }

  const removedFundColumnLabels = [
    "Fund Code Column",
    "Fund Name Column",
    "Fund Type Column",
    "Reporting Model Column"
  ];

  for (const snippet of removedFundColumnLabels) {
    if (fundImportForm.includes(`label="${snippet}"`)) {
      fail(`Fund import form still uses noisy mapping label: ${snippet}`);
    }
  }
}

const simpleReferenceConfigPath = join(root, "lib", "imports", "simple-reference-import-config.ts");
if (existsSync(simpleReferenceConfigPath)) {
  const simpleReferenceConfig = readFileSync(simpleReferenceConfigPath, "utf8");
  const configSnippets = [
    "Object Code",
    "ACFR Code",
    "Department Code",
    "Function Code",
    "account_type_detailed",
    "function_description",
    "department_group",
    "acfr_description"
  ];

  for (const snippet of configSnippets) {
    if (!simpleReferenceConfig.includes(snippet)) {
      fail(`Missing simple reference import config content: ${snippet}`);
    }
  }

  const removedSimpleReferenceLabels = [
    "Object Code Column",
    "ACFR Code Column",
    "Department Code Column",
    "Function Code Column"
  ];

  for (const snippet of removedSimpleReferenceLabels) {
    if (simpleReferenceConfig.includes(`"${snippet}"`)) {
      fail(`Simple reference import config still uses noisy mapping label: ${snippet}`);
    }
  }
}

const simpleReferenceEnginePath = join(root, "lib", "imports", "simple-reference-import.ts");
if (existsSync(simpleReferenceEnginePath)) {
  const simpleReferenceEngine = readFileSync(simpleReferenceEnginePath, "utf8");
  const engineSnippets = [
    "resolveColumnReference",
    "columnLetterToIndex",
    "buildSimpleReferencePreview",
    "commitSimpleReferenceRows",
    "mapping_versions",
    "duplicate_code",
    "existing_record_skipped"
  ];

  for (const snippet of engineSnippets) {
    if (!simpleReferenceEngine.includes(snippet)) {
      fail(`Missing simple reference import engine content: ${snippet}`);
    }
  }
}

const simpleReferenceFormPath = join(root, "components", "simple-reference-import-form.tsx");
if (existsSync(simpleReferenceFormPath)) {
  const simpleReferenceForm = readFileSync(simpleReferenceFormPath, "utf8");
  const formSnippets = [
    "For mapping fields, enter the column header name, spreadsheet",
    "Import Mapping",
    "Update existing",
    "Fill missing data on existing",
    "xl:grid-cols-4",
    "Delete / exclude",
    "Bad-data report",
    "Commit"
  ];

  for (const snippet of formSnippets) {
    if (!simpleReferenceForm.includes(snippet)) {
      fail(`Missing simple reference import form content: ${snippet}`);
    }
  }
}

const simpleReferenceRouteChecks = [
  ["objects", "simpleReferenceImportConfigs.objects"],
  ["acfr", "simpleReferenceImportConfigs.acfr"],
  ["departments", "simpleReferenceImportConfigs.departments"],
  ["functions", "simpleReferenceImportConfigs.functions"]
];

for (const [routeSegment, configSnippet] of simpleReferenceRouteChecks) {
  const routePath = join(root, "app", "imports", routeSegment, "page.tsx");
  if (existsSync(routePath)) {
    const routePage = readFileSync(routePath, "utf8");
    if (!routePage.includes(configSnippet)) {
      fail(`Missing direct reference import route config: ${routeSegment}`);
    }
  }
}

const validationFiles = [
  "app/imports/[importBatchId]/validation/page.tsx",
  "app/imports/[importBatchId]/validation/actions.ts",
  "app/imports/[importBatchId]/validation/exceptions.csv/route.ts",
  "components/trial-balance-validation-actions.tsx",
  "lib/imports/trial-balance-validation.ts",
  "lib/imports/validation-rules.ts",
  "lib/imports/validation-state.ts"
];

for (const file of validationFiles) {
  if (!existsSync(join(root, file))) {
    fail(`Missing trial balance validation file: ${file}`);
  }
}

const validationEnginePath = join(root, "lib", "imports", "trial-balance-validation.ts");
if (existsSync(validationEnginePath)) {
  const validationEngine = readFileSync(validationEnginePath, "utf8");
  const validationEngineSnippets = [
    "runTrialBalanceValidation",
    "loadLatestPreviewRun",
    "import_preview_rows",
    "import_preview_issues",
    "validation_runs",
    "validation_run_mapping_versions",
    "warning_acknowledgements",
    "missing_fund_mapping",
    "missing_object_mapping",
    "duplicate_full_account_number",
    "balance_formula_failure",
    "net_change_formula_failure",
    "period_conflict_active_data_exists",
    "invalid_fiscal_setup",
    "loadFiscalPeriod",
    "linkImportBatchFiscalSetup",
    "dedupeValidationExceptions",
    "batch_status: batchStatus",
    "is_active_for_reporting: false",
    "validation_warning_acknowledged"
  ];

  for (const snippet of validationEngineSnippets) {
    if (!validationEngine.includes(snippet)) {
      fail(`Missing validation engine content: ${snippet}`);
    }
  }
}

const validationPagePath = join(root, "app", "imports", "[importBatchId]", "validation", "page.tsx");
if (existsSync(validationPagePath)) {
  const validationPage = readFileSync(validationPagePath, "utf8");
  const validationPageSnippets = [
    "Trial Balance Validation",
    "Validation determines whether this import is eligible for posting",
    "Validation summary",
    "Root Cause Summary",
    "Exception detail",
    "Warning acknowledgement",
    "Export CSV",
    "Critical errors cannot be acknowledged"
  ];

  for (const snippet of validationPageSnippets) {
    if (!validationPage.includes(snippet)) {
      fail(`Missing validation page content: ${snippet}`);
    }
  }
}

const postingFiles = [
  "app/imports/[importBatchId]/post/page.tsx",
  "app/imports/[importBatchId]/post/actions.ts",
  "app/imports/[importBatchId]/review/page.tsx",
  "app/imports/periods/page.tsx",
  "app/imports/replacement-requests/page.tsx",
  "app/imports/replacement-requests/actions.ts",
  "app/imports/reactivation-requests/page.tsx",
  "app/imports/reactivation-requests/actions.ts",
  "components/trial-balance-posting-actions.tsx",
  "lib/imports/trial-balance-posting.ts",
  "lib/imports/posting-state.ts",
  "lib/auth/permissions.ts"
];

for (const file of postingFiles) {
  if (!existsSync(join(root, file))) {
    fail(`Missing trial balance posting file: ${file}`);
  }
}

const postingEnginePath = join(root, "lib", "imports", "trial-balance-posting.ts");
if (existsSync(postingEnginePath)) {
  const postingEngine = readFileSync(postingEnginePath, "utf8");
  const postingEngineSnippets = [
    "postValidatedTrialBalance",
    "loadLatestValidationRun",
    "import_preview_rows",
    "posting_runs",
    "posting_run_mapping_versions",
    "trial_balance_lines",
    "trial_balance_line_segments",
    "findActivePeriodImport",
    "requestReplacement",
    "approveReplacementRequest",
    "requestReactivation",
    "approveReactivationRequest",
    "is_active_for_reporting: true",
    "active_status: \"active\"",
    "import_posted"
  ];

  for (const snippet of postingEngineSnippets) {
    if (!postingEngine.includes(snippet)) {
      fail(`Missing posting engine content: ${snippet}`);
    }
  }
}

const postingPagePath = join(root, "app", "imports", "[importBatchId]", "post", "page.tsx");
if (existsSync(postingPagePath)) {
  const postingPage = readFileSync(postingPagePath, "utf8");
  const postingPageSnippets = [
    "Post Validated Trial Balance",
    "Posting context",
    "Period conflict",
    "RequestReplacementAction",
    "Posting confirmation",
    "Post Validated Trial Balance"
  ];

  for (const snippet of postingPageSnippets) {
    if (!postingPage.includes(snippet)) {
      fail(`Missing posting page content: ${snippet}`);
    }
  }
}

const analysisFiles = [
  "app/analysis/page.tsx",
  "app/analysis/calculation-runs/page.tsx",
  "app/analysis/calculation-runs/actions.ts",
  "components/calculation-run-form.tsx",
  "lib/calculations/run-calculation.ts",
  "lib/calculations/sign-conventions.ts",
  "lib/calculations/thresholds.ts"
];

for (const file of analysisFiles) {
  if (!existsSync(join(root, file))) {
    fail(`Missing analysis output file: ${file}`);
  }
}

const calculationEnginePath = join(root, "lib", "calculations", "run-calculation.ts");
if (existsSync(calculationEnginePath)) {
  const calculationEngine = readFileSync(calculationEnginePath, "utf8");
  const calculationSnippets = [
    "runAnalysisCalculation",
    "active_trial_balance_lines",
    "mapping_coverage_results",
    "financial_summary_results",
    "statement_summary_results",
    "variance_results",
    "trend_results",
    "exception_results",
    "CALCULATION_VERSION",
    "Multiple active posted imports",
    "missing_prior_year_comparison_data",
    "missing_mapping_classification",
    "calculation_run_completed"
  ];

  for (const snippet of calculationSnippets) {
    if (!calculationEngine.includes(snippet)) {
      fail(`Missing calculation engine content: ${snippet}`);
    }
  }
}

const calculationRunsPagePath = join(root, "app", "analysis", "calculation-runs", "page.tsx");
if (existsSync(calculationRunsPagePath)) {
  const calculationRunsPage = readFileSync(calculationRunsPagePath, "utf8");
  const pageSnippets = [
    "Calculation Runs",
    "CalculationRunForm",
    "Mapping coverage review",
    "Financial summary output",
    "Exception output",
    "not a CFO dashboard"
  ];

  for (const snippet of pageSnippets) {
    if (!calculationRunsPage.includes(snippet)) {
      fail(`Missing calculation runs page content: ${snippet}`);
    }
  }
}

const importReviewPagePath = join(root, "app", "imports", "[importBatchId]", "review", "page.tsx");
if (existsSync(importReviewPagePath)) {
  const importReviewPage = readFileSync(importReviewPagePath, "utf8");
  const reviewSnippets = [
    "Import Review",
    "Import lineage",
    "Validation summary",
    "Posting summary",
    "Mapping versions",
    "Warning acknowledgement trail",
    "Reactivation",
    "Audit summary"
  ];

  for (const snippet of reviewSnippets) {
    if (!importReviewPage.includes(snippet)) {
      fail(`Missing import review page content: ${snippet}`);
    }
  }
}

const filesToScan = [
  "app",
  "components",
  "lib"
].flatMap((dir) => collectFiles(join(root, dir)));

for (const file of filesToScan) {
  if (file.endsWith(join("lib", "supabase", "admin.ts"))) {
    continue;
  }

  if (file.endsWith(join("lib", "supabase", "env.ts"))) {
    continue;
  }

  const content = readFileSync(file, "utf8");
  if (content.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    fail(`Service role key reference outside server/admin code: ${file}`);
  }
}

if (!process.exitCode) {
  console.log("schema checks ok");
}

function collectFiles(dir) {
  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? collectFiles(path) : [path];
  });
}
