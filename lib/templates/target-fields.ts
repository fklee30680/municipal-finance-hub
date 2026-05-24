import type { SupportedImportTypeCode } from "@/lib/uploads/config";

export type TargetFieldDefinition = {
  name: string;
  label: string;
  required: boolean;
};

const targetFieldsByImportType: Record<
  SupportedImportTypeCode,
  TargetFieldDefinition[]
> = {
  trial_balance: [
    required("full_account_number", "Full account number"),
    required("account_name", "Account name"),
    required("beginning_balance", "Beginning balance"),
    required("debits", "Debits"),
    required("credits", "Credits"),
    required("net_change", "Net change"),
    required("ending_balance", "Ending balance"),
    optional("fund_code", "Fund code"),
    optional("acfr_code", "ACFR code"),
    optional("department_code", "Department code"),
    optional("function_code", "Function code"),
    optional("object_code", "Object code"),
    optional("fiscal_year", "Fiscal year"),
    optional("period", "Period"),
    optional("period_date", "Period date"),
    optional("fund_name", "Fund name"),
    optional("department_name", "Department name")
  ],
  fund_mapping: [
    required("fund_code", "Fund code"),
    required("fund_name", "Fund name"),
    optional("fund_type", "Fund type"),
    optional("fund_group", "Fund group"),
    optional("major_fund_flag", "Major fund flag"),
    optional("active_status", "Active status"),
    optional("effective_start_date", "Effective start date"),
    optional("effective_end_date", "Effective end date")
  ],
  object_mapping: [
    required("object_code", "Object code"),
    required("object_name", "Object name"),
    optional("account_type", "Account type"),
    optional("balance_sheet_line", "Balance sheet line"),
    optional("activity_statement_line", "Activity statement line"),
    optional("active_status", "Active status"),
    optional("effective_start_date", "Effective start date"),
    optional("effective_end_date", "Effective end date")
  ],
  acfr_mapping: [
    required("acfr_code", "ACFR code"),
    required("acfr_name", "ACFR name"),
    optional("acfr_description", "ACFR description"),
    optional("active_status", "Active status"),
    optional("effective_start_date", "Effective start date"),
    optional("effective_end_date", "Effective end date")
  ],
  department_mapping: [
    required("department_code", "Department code"),
    required("department_name", "Department name"),
    optional("department_group", "Department group"),
    optional("active_status", "Active status"),
    optional("effective_start_date", "Effective start date"),
    optional("effective_end_date", "Effective end date")
  ],
  function_mapping: [
    required("function_code", "Function code"),
    required("function_name", "Function name"),
    optional("function_description", "Function description"),
    optional("active_status", "Active status"),
    optional("effective_start_date", "Effective start date"),
    optional("effective_end_date", "Effective end date")
  ]
};

export function getTargetFields(importTypeCode: string) {
  return targetFieldsByImportType[importTypeCode as SupportedImportTypeCode] ?? [];
}

export function getRequiredTargetFieldNames(importTypeCode: string) {
  return getTargetFields(importTypeCode)
    .filter((field) => field.required)
    .map((field) => field.name);
}

function required(name: string, label: string): TargetFieldDefinition {
  return {
    name,
    label,
    required: true
  };
}

function optional(name: string, label: string): TargetFieldDefinition {
  return {
    name,
    label,
    required: false
  };
}
