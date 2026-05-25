export type ValidationSeverity = "critical_error" | "warning" | "information";

export type ValidationRuleCategory =
  | "file_setup"
  | "required_field"
  | "numeric_parse"
  | "account_parse"
  | "reference_mapping"
  | "duplicate_account"
  | "financial_formula"
  | "trial_balance_integrity"
  | "fiscal_period"
  | "period_conflict"
  | "preview_issue_carryforward";

export type ValidationRuleDefinition = {
  category: ValidationRuleCategory;
  code: string;
  defaultSeverity: ValidationSeverity;
  suggestedFix: string;
};

export const validationRuleCatalog: ValidationRuleDefinition[] = [
  {
    category: "file_setup",
    code: "missing_preview_run",
    defaultSeverity: "critical_error",
    suggestedFix: "Generate a trial balance preview before running validation."
  },
  {
    category: "required_field",
    code: "missing_required_field",
    defaultSeverity: "critical_error",
    suggestedFix: "Fix the source file or template mapping, reupload if needed, and regenerate preview."
  },
  {
    category: "numeric_parse",
    code: "invalid_numeric_value",
    defaultSeverity: "critical_error",
    suggestedFix: "Correct values that are not valid numbers, then regenerate preview. Commas, dollar signs, .00, negatives, and parentheses negatives are supported."
  },
  {
    category: "account_parse",
    code: "unparseable_account_number",
    defaultSeverity: "critical_error",
    suggestedFix: "Correct the account number so it matches the configured account structure."
  },
  {
    category: "account_parse",
    code: "account_segment_count_mismatch",
    defaultSeverity: "critical_error",
    suggestedFix: "Correct the account number segment count or update the account structure configuration."
  },
  {
    category: "reference_mapping",
    code: "missing_fund_mapping",
    defaultSeverity: "critical_error",
    suggestedFix: "Import or correct the fund mapping before validating again."
  },
  {
    category: "reference_mapping",
    code: "missing_acfr_mapping",
    defaultSeverity: "critical_error",
    suggestedFix: "Import or correct the ACFR mapping before validating again."
  },
  {
    category: "reference_mapping",
    code: "missing_department_mapping",
    defaultSeverity: "critical_error",
    suggestedFix: "Import or correct the department mapping before validating again."
  },
  {
    category: "reference_mapping",
    code: "missing_function_mapping",
    defaultSeverity: "critical_error",
    suggestedFix: "Import or correct the function mapping before validating again."
  },
  {
    category: "reference_mapping",
    code: "missing_object_mapping",
    defaultSeverity: "critical_error",
    suggestedFix: "Import or correct the object mapping before validating again."
  },
  {
    category: "reference_mapping",
    code: "mapping_version_unavailable",
    defaultSeverity: "warning",
    suggestedFix: "Commit mappings through the mapping import workflow so validation can record mapping versions."
  },
  {
    category: "duplicate_account",
    code: "duplicate_full_account_number",
    defaultSeverity: "critical_error",
    suggestedFix: "Remove duplicate account lines from the source file or combine them before reuploading."
  },
  {
    category: "financial_formula",
    code: "balance_formula_failure",
    defaultSeverity: "critical_error",
    suggestedFix: "Check beginning balance, net change, and ending balance in the source file."
  },
  {
    category: "financial_formula",
    code: "net_change_formula_failure",
    defaultSeverity: "critical_error",
    suggestedFix: "Check debit, credit, and net change columns in the source file."
  },
  {
    category: "trial_balance_integrity",
    code: "batch_out_of_balance",
    defaultSeverity: "critical_error",
    suggestedFix: "Review missing accounts, sign convention, or incomplete export rows."
  },
  {
    category: "trial_balance_integrity",
    code: "fund_out_of_balance",
    defaultSeverity: "critical_error",
    suggestedFix: "Review missing accounts, incorrect signs, or incomplete export rows for this fund."
  },
  {
    category: "trial_balance_integrity",
    code: "batch_debits_credits_out_of_balance",
    defaultSeverity: "critical_error",
    suggestedFix: "Review whether the file is incomplete or the debit/credit columns are mapped correctly."
  },
  {
    category: "trial_balance_integrity",
    code: "fund_debits_credits_out_of_balance",
    defaultSeverity: "critical_error",
    suggestedFix: "Review activity rows, mappings, or incomplete export rows for this fund."
  },
  {
    category: "trial_balance_integrity",
    code: "row_formula_mismatch",
    defaultSeverity: "critical_error",
    suggestedFix: "Review beginning balance, net change, and ending balance for this row."
  },
  {
    category: "trial_balance_integrity",
    code: "row_net_change_mismatch",
    defaultSeverity: "critical_error",
    suggestedFix: "Review debit, credit, and net change columns or confirm export sign convention."
  },
  {
    category: "fiscal_period",
    code: "invalid_fiscal_year",
    defaultSeverity: "critical_error",
    suggestedFix: "Select or configure a valid fiscal year before validation."
  },
  {
    category: "fiscal_period",
    code: "invalid_fiscal_setup",
    defaultSeverity: "critical_error",
    suggestedFix: "Configure the fiscal year and period in Setup, then rerun validation."
  },
  {
    category: "fiscal_period",
    code: "invalid_period",
    defaultSeverity: "critical_error",
    suggestedFix: "Select a valid reporting period for the configured fiscal year."
  },
  {
    category: "period_conflict",
    code: "period_conflict_active_data_exists",
    defaultSeverity: "critical_error",
    suggestedFix: "Use the controlled replacement workflow in Slice 8 before posting this period."
  },
  {
    category: "preview_issue_carryforward",
    code: "preview_issue_carried_forward",
    defaultSeverity: "warning",
    suggestedFix: "Review the preview issue, fix the source/template if needed, and regenerate preview."
  },
  {
    category: "preview_issue_carryforward",
    code: "blank_row_skipped",
    defaultSeverity: "information",
    suggestedFix: "No action is needed if blank rows are expected."
  }
];

export function getValidationRule(code: string) {
  return validationRuleCatalog.find((rule) => rule.code === code);
}
