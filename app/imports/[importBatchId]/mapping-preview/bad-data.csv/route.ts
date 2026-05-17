import { NextResponse } from "next/server";

import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type BadDataIssue = {
  source_row_number: number | null;
  source_column_name: string | null;
  target_field_name: string | null;
  raw_value: string | null;
  transformed_value: string | null;
  issue_type: string;
  issue_severity: string;
  issue_message: string;
  suggested_fix: string | null;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ importBatchId: string }> }
) {
  const { importBatchId } = await params;
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);
  const latestRun = await adminClient
    .from("mapping_import_runs")
    .select("mapping_import_run_id")
    .eq("organization_id", appUser.organization_id)
    .eq("import_batch_id", importBatchId)
    .in("run_status", ["previewed", "committed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ mapping_import_run_id: string }>();

  if (latestRun.error || !latestRun.data) {
    return new NextResponse("No mapping import bad-data report is available.", {
      status: 404
    });
  }

  const issues = await adminClient
    .from("mapping_import_issues")
    .select(
      "source_row_number, source_column_name, target_field_name, raw_value, transformed_value, issue_type, issue_severity, issue_message, suggested_fix"
    )
    .eq("organization_id", appUser.organization_id)
    .eq("mapping_import_run_id", latestRun.data.mapping_import_run_id)
    .order("source_row_number", { ascending: true })
    .returns<BadDataIssue[]>();

  if (issues.error) {
    return new NextResponse(issues.error.message, { status: 500 });
  }

  const csv = [
    [
      "Source row",
      "Source column",
      "Target field",
      "Raw value",
      "Transformed value",
      "Issue type",
      "Severity",
      "Issue message",
      "Suggested fix"
    ],
    ...(issues.data ?? []).map((issue) => [
      issue.source_row_number ?? "",
      issue.source_column_name ?? "",
      issue.target_field_name ?? "",
      issue.raw_value ?? "",
      issue.transformed_value ?? "",
      issue.issue_type,
      issue.issue_severity,
      issue.issue_message,
      issue.suggested_fix ?? ""
    ])
  ]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Disposition": `attachment; filename="mapping-import-bad-data-${importBatchId}.csv"`,
      "Content-Type": "text/csv; charset=utf-8"
    }
  });
}

function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}
