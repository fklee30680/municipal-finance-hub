import { NextResponse } from "next/server";

import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type ValidationRunRow = {
  validation_run_id: string;
  source_file_id: string;
  import_template_version_id: string;
};

type SourceFileRow = {
  original_file_name: string;
};

type ExceptionRow = {
  row_number: number | null;
  source_column_name: string | null;
  target_field_name: string | null;
  raw_value: string | null;
  transformed_value: string | null;
  severity: string;
  exception_code: string;
  exception_message: string;
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

  const validationRunResult = await adminClient
    .from("validation_runs")
    .select("validation_run_id, source_file_id, import_template_version_id")
    .eq("organization_id", appUser.organization_id)
    .eq("import_batch_id", importBatchId)
    .eq("status", "completed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ValidationRunRow>();

  if (validationRunResult.error || !validationRunResult.data) {
    return new NextResponse("No validation run exists for this import batch.", {
      status: 404
    });
  }
  const validationRun = validationRunResult.data;

  const [sourceFileResult, exceptionsResult] = await Promise.all([
    adminClient
      .from("source_files")
      .select("original_file_name")
      .eq("organization_id", appUser.organization_id)
      .eq("source_file_id", validationRun.source_file_id)
      .maybeSingle<SourceFileRow>(),
    adminClient
      .from("import_exceptions")
      .select(
        "row_number, source_column_name, target_field_name, raw_value, transformed_value, severity, exception_code, exception_message, suggested_fix"
      )
      .eq("organization_id", appUser.organization_id)
      .eq("validation_run_id", validationRun.validation_run_id)
      .order("row_number", { ascending: true })
      .returns<ExceptionRow[]>()
  ]);

  if (exceptionsResult.error) {
    return new NextResponse(exceptionsResult.error.message, { status: 500 });
  }

  const rows = [
    [
      "import_batch_id",
      "validation_run_id",
      "source_file",
      "template_version_id",
      "row_number",
      "source_column",
      "target_field",
      "raw_value",
      "transformed_value",
      "severity",
      "exception_code",
      "exception_message",
      "suggested_fix"
    ],
    ...(exceptionsResult.data ?? []).map((exception) => [
      importBatchId,
      validationRun.validation_run_id,
      sourceFileResult.data?.original_file_name ?? "",
      validationRun.import_template_version_id,
      exception.row_number ?? "",
      exception.source_column_name ?? "",
      exception.target_field_name ?? "",
      exception.raw_value ?? "",
      exception.transformed_value ?? "",
      exception.severity,
      exception.exception_code,
      exception.exception_message,
      exception.suggested_fix ?? ""
    ])
  ];
  const csv = rows.map((row) => row.map(escapeCsvValue).join(",")).join("\n");

  await adminClient.from("audit_logs").insert({
    organization_id: appUser.organization_id,
    actor_user_id: appUser.user_id,
    action_type: "validation_exception_exported",
    entity_table: "validation_runs",
    entity_id: validationRun.validation_run_id,
    after_payload: {
      import_batch_id: importBatchId,
      row_count: exceptionsResult.data?.length ?? 0
    },
    metadata: {
      validation_only: true
    }
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Disposition": `attachment; filename=\"validation-exceptions-${importBatchId}.csv\"`,
      "Content-Type": "text/csv; charset=utf-8"
    }
  });
}

function escapeCsvValue(value: string | number) {
  const stringValue = String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replaceAll('"', '""')}"`;
  }

  return stringValue;
}
