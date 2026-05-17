import type { SupportedMappingImportType } from "@/lib/imports/mapping-import";

export type ReferenceImportConfig = {
  codeLabel: string;
  description: string;
  importTypeCode: SupportedMappingImportType;
  name: string;
  pluralName: string;
  routeSegment: string;
  targetTable: "funds" | "objects" | "acfr_mappings" | "departments" | "functions";
};

export const referenceImportConfigs: ReferenceImportConfig[] = [
  {
    codeLabel: "Fund code",
    description: "Load fund names, fund groups, fund types, and active status.",
    importTypeCode: "fund_mapping",
    name: "Fund Import",
    pluralName: "Funds",
    routeSegment: "funds",
    targetTable: "funds"
  },
  {
    codeLabel: "Object code",
    description:
      "Load account names, account types, balance sheet categories, and cash flow categories.",
    importTypeCode: "object_mapping",
    name: "Object Import",
    pluralName: "Objects",
    routeSegment: "objects",
    targetTable: "objects"
  },
  {
    codeLabel: "ACFR code",
    description: "Load ACFR names, descriptions, and active status.",
    importTypeCode: "acfr_mapping",
    name: "ACFR Import",
    pluralName: "ACFR",
    routeSegment: "acfr",
    targetTable: "acfr_mappings"
  },
  {
    codeLabel: "Department code",
    description: "Load department names, groups, and active status.",
    importTypeCode: "department_mapping",
    name: "Department Import",
    pluralName: "Departments",
    routeSegment: "departments",
    targetTable: "departments"
  },
  {
    codeLabel: "Function code",
    description: "Load function names, descriptions, and active status.",
    importTypeCode: "function_mapping",
    name: "Function Import",
    pluralName: "Functions",
    routeSegment: "functions",
    targetTable: "functions"
  }
];

export function getReferenceImportConfig(routeSegment: string) {
  return (
    referenceImportConfigs.find((config) => config.routeSegment === routeSegment) ??
    null
  );
}

export function getReferenceImportConfigByCode(importTypeCode: string) {
  return (
    referenceImportConfigs.find((config) => config.importTypeCode === importTypeCode) ??
    null
  );
}
