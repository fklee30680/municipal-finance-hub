import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const migrationPath = join(
  root,
  "supabase",
  "migrations",
  "20260517000100_core_schema.sql"
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

const requiredDocs = [
  "docs/product-spec.md",
  "docs/build-plan.md",
  "docs/architecture-decisions.md",
  "docs/database-schema.md",
  "TASKS.md"
];

for (const doc of requiredDocs) {
  if (!existsSync(join(root, doc))) {
    fail(`Missing documentation file: ${doc}`);
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
