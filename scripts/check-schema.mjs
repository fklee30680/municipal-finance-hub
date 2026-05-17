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

const requiredDocs = [
  "docs/product-spec.md",
  "docs/build-plan.md",
  "docs/architecture-decisions.md",
  "docs/database-schema.md",
  "docs/fiscal-calendar.md",
  "docs/raw-file-upload.md",
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
    "New Upload",
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
    "Upload Source File",
    "Parsing, template mapping, validation, and posting happen in later"
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

const filesToScan = [
  "app",
  "components",
  "lib"
].flatMap((dir) => collectFiles(join(root, dir)));

for (const file of filesToScan) {
  if (file.endsWith(join("lib", "supabase", "admin.ts"))) {
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
