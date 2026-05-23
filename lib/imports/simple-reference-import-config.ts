export type SimpleReferenceImportRoute =
  | "acfr"
  | "departments"
  | "functions"
  | "objects";

export type SimpleReferenceTargetTable =
  | "acfr_mappings"
  | "departments"
  | "functions"
  | "objects";

export type SimpleReferenceFieldConfig = {
  dbField: string;
  defaultColumn: string;
  key: string;
  label: string;
  required?: boolean;
};

export type SimpleReferenceTableColumn = {
  dbField: string;
  label: string;
};

export type SimpleReferenceImportConfig = {
  auditPrefix: string;
  codeField: string;
  codeLabel: string;
  description: string;
  emptyText: string;
  fields: SimpleReferenceFieldConfig[];
  idField: string;
  mappingScope: "acfr" | "department" | "function" | "object";
  nameField: string;
  pageTitle: string;
  pluralLabel: string;
  route: SimpleReferenceImportRoute;
  searchPlaceholder: string;
  searchTitle: string;
  searchableFields: string[];
  tableColumns: SimpleReferenceTableColumn[];
  tableTitle: string;
  targetTable: SimpleReferenceTargetTable;
};

export const simpleReferenceImportConfigs: Record<
  SimpleReferenceImportRoute,
  SimpleReferenceImportConfig
> = {
  objects: {
    auditPrefix: "object",
    codeField: "object_code",
    codeLabel: "object code",
    description:
      "Import object reference data with a lightweight preview, edit, exclude, and commit workflow.",
    emptyText: "No objects have been committed yet.",
    fields: [
      requiredField("objectCode", "object_code", "Object Code Column", "Object Code"),
      requiredField("objectName", "object_name", "Object Name Column", "Object Name"),
      optionalField("accountType", "account_type", "Account Type Column", "Account Type"),
      optionalField(
        "statementCategory",
        "statement_category",
        "Statement Category Column",
        "Statement Category"
      ),
      optionalField(
        "balanceSheetCategory",
        "balance_sheet_category",
        "Balance Sheet Category Column",
        "Balance Sheet Category"
      ),
      optionalField(
        "cashFlowCategory",
        "cash_flow_category",
        "Cash Flow Category Column",
        "Cash Flow Category"
      ),
      optionalField(
        "detailedAccountType",
        "detailed_account_type",
        "Detailed Account Type Column",
        "Detailed Account Type"
      ),
      optionalField(
        "accountTypeDetailed",
        "account_type_detailed",
        "Account Type Detailed Column",
        "Account Type Detailed"
      ),
      optionalField(
        "effectiveStartDate",
        "effective_start_date",
        "Effective Start Date Column",
        "Effective Start Date"
      ),
      optionalField(
        "effectiveEndDate",
        "effective_end_date",
        "Effective End Date Column",
        "Effective End Date"
      ),
      optionalField("activeStatus", "active_status", "Active Status Column", "Active Status"),
      optionalField("changeReason", "change_reason", "Change Reason Column", "Change Reason")
    ],
    idField: "object_id",
    mappingScope: "object",
    nameField: "object_name",
    pageTitle: "Object List Update",
    pluralLabel: "objects",
    route: "objects",
    searchPlaceholder:
      "Search object code, name, account type, statement category, or reporting category",
    searchTitle: "Search Objects",
    searchableFields: [
      "object_code",
      "object_name",
      "account_type",
      "statement_category",
      "balance_sheet_category",
      "cash_flow_category",
      "detailed_account_type",
      "account_type_detailed"
    ],
    tableColumns: [
      { dbField: "object_code", label: "Object Code" },
      { dbField: "object_name", label: "Object Name" },
      { dbField: "account_type", label: "Account Type" },
      { dbField: "statement_category", label: "Statement Category" },
      { dbField: "balance_sheet_category", label: "Balance Sheet Category" },
      { dbField: "cash_flow_category", label: "Cash Flow Category" },
      { dbField: "detailed_account_type", label: "Detailed Account Type" },
      { dbField: "account_type_detailed", label: "Account Type Detailed" },
      { dbField: "active_status", label: "Active Status" },
      { dbField: "effective_start_date", label: "Effective Start" },
      { dbField: "effective_end_date", label: "Effective End" },
      { dbField: "updated_at", label: "Last Updated" }
    ],
    tableTitle: "Objects",
    targetTable: "objects"
  },
  acfr: {
    auditPrefix: "acfr",
    codeField: "acfr_code",
    codeLabel: "ACFR code",
    description:
      "Import ACFR mappings with a lightweight preview, edit, exclude, and commit workflow.",
    emptyText: "No ACFR mappings have been committed yet.",
    fields: [
      requiredField("acfrCode", "acfr_code", "ACFR Code Column", "ACFR Code"),
      requiredField("acfrName", "acfr_name", "ACFR Name Column", "ACFR Name"),
      optionalField("acfrCategory", "acfr_category", "ACFR Category Column", "ACFR Category"),
      optionalField(
        "acfrDescription",
        "acfr_description",
        "ACFR Description Column",
        "ACFR Description"
      ),
      optionalField(
        "effectiveStartDate",
        "effective_start_date",
        "Effective Start Date Column",
        "Effective Start Date"
      ),
      optionalField(
        "effectiveEndDate",
        "effective_end_date",
        "Effective End Date Column",
        "Effective End Date"
      ),
      optionalField("activeStatus", "active_status", "Active Status Column", "Active Status"),
      optionalField("changeReason", "change_reason", "Change Reason Column", "Change Reason")
    ],
    idField: "acfr_mapping_id",
    mappingScope: "acfr",
    nameField: "acfr_name",
    pageTitle: "ACFR List Update",
    pluralLabel: "ACFR mappings",
    route: "acfr",
    searchPlaceholder: "Search ACFR code, name, category, or description",
    searchTitle: "Search ACFR",
    searchableFields: ["acfr_code", "acfr_name", "acfr_category", "acfr_description"],
    tableColumns: [
      { dbField: "acfr_code", label: "ACFR Code" },
      { dbField: "acfr_name", label: "ACFR Name" },
      { dbField: "acfr_category", label: "ACFR Category" },
      { dbField: "acfr_description", label: "ACFR Description" },
      { dbField: "active_status", label: "Active Status" },
      { dbField: "effective_start_date", label: "Effective Start" },
      { dbField: "effective_end_date", label: "Effective End" },
      { dbField: "updated_at", label: "Last Updated" }
    ],
    tableTitle: "ACFR Mappings",
    targetTable: "acfr_mappings"
  },
  departments: {
    auditPrefix: "department",
    codeField: "department_code",
    codeLabel: "department code",
    description:
      "Import department reference data with a lightweight preview, edit, exclude, and commit workflow.",
    emptyText: "No departments have been committed yet.",
    fields: [
      requiredField(
        "departmentCode",
        "department_code",
        "Department Code Column",
        "Department Code"
      ),
      requiredField(
        "departmentName",
        "department_name",
        "Department Name Column",
        "Department Name"
      ),
      optionalField(
        "departmentGroup",
        "department_group",
        "Department Group Column",
        "Department Group"
      ),
      optionalField(
        "effectiveStartDate",
        "effective_start_date",
        "Effective Start Date Column",
        "Effective Start Date"
      ),
      optionalField(
        "effectiveEndDate",
        "effective_end_date",
        "Effective End Date Column",
        "Effective End Date"
      ),
      optionalField("activeStatus", "active_status", "Active Status Column", "Active Status"),
      optionalField("changeReason", "change_reason", "Change Reason Column", "Change Reason")
    ],
    idField: "department_id",
    mappingScope: "department",
    nameField: "department_name",
    pageTitle: "Department List Update",
    pluralLabel: "departments",
    route: "departments",
    searchPlaceholder: "Search department code, name, or group",
    searchTitle: "Search Departments",
    searchableFields: ["department_code", "department_name", "department_group"],
    tableColumns: [
      { dbField: "department_code", label: "Department Code" },
      { dbField: "department_name", label: "Department Name" },
      { dbField: "department_group", label: "Department Group" },
      { dbField: "active_status", label: "Active Status" },
      { dbField: "effective_start_date", label: "Effective Start" },
      { dbField: "effective_end_date", label: "Effective End" },
      { dbField: "updated_at", label: "Last Updated" }
    ],
    tableTitle: "Departments",
    targetTable: "departments"
  },
  functions: {
    auditPrefix: "function",
    codeField: "function_code",
    codeLabel: "function code",
    description:
      "Import function reference data with a lightweight preview, edit, exclude, and commit workflow.",
    emptyText: "No functions have been committed yet.",
    fields: [
      requiredField("functionCode", "function_code", "Function Code Column", "Function Code"),
      requiredField("functionName", "function_name", "Function Name Column", "Function Name"),
      optionalField("functionGroup", "function_group", "Function Group Column", "Function Group"),
      optionalField(
        "functionDescription",
        "function_description",
        "Function Description Column",
        "Function Description"
      ),
      optionalField(
        "effectiveStartDate",
        "effective_start_date",
        "Effective Start Date Column",
        "Effective Start Date"
      ),
      optionalField(
        "effectiveEndDate",
        "effective_end_date",
        "Effective End Date Column",
        "Effective End Date"
      ),
      optionalField("activeStatus", "active_status", "Active Status Column", "Active Status"),
      optionalField("changeReason", "change_reason", "Change Reason Column", "Change Reason")
    ],
    idField: "function_id",
    mappingScope: "function",
    nameField: "function_name",
    pageTitle: "Function List Update",
    pluralLabel: "functions",
    route: "functions",
    searchPlaceholder: "Search function code, name, group, or description",
    searchTitle: "Search Functions",
    searchableFields: [
      "function_code",
      "function_name",
      "function_group",
      "function_description"
    ],
    tableColumns: [
      { dbField: "function_code", label: "Function Code" },
      { dbField: "function_name", label: "Function Name" },
      { dbField: "function_group", label: "Function Group" },
      { dbField: "function_description", label: "Function Description" },
      { dbField: "active_status", label: "Active Status" },
      { dbField: "effective_start_date", label: "Effective Start" },
      { dbField: "effective_end_date", label: "Effective End" },
      { dbField: "updated_at", label: "Last Updated" }
    ],
    tableTitle: "Functions",
    targetTable: "functions"
  }
};

export function getSimpleReferenceImportConfig(route: string) {
  return simpleReferenceImportConfigs[route as SimpleReferenceImportRoute] ?? null;
}

function requiredField(
  key: string,
  dbField: string,
  label: string,
  defaultColumn: string
): SimpleReferenceFieldConfig {
  return {
    dbField,
    defaultColumn,
    key,
    label,
    required: true
  };
}

function optionalField(
  key: string,
  dbField: string,
  label: string,
  defaultColumn: string
): SimpleReferenceFieldConfig {
  return {
    dbField,
    defaultColumn,
    key,
    label
  };
}
