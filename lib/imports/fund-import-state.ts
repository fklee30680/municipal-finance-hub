export type FundImportIssue = {
  issueMessage: string;
  issueSeverity: "info" | "warning" | "error";
  issueType: string;
  rawValue?: string | null;
  sourceColumnName?: string | null;
  sourceRowNumber: number;
  suggestedFix?: string | null;
  targetFieldName?: string | null;
  transformedValue?: string | null;
};

export type FundImportPreviewRow = {
  activeStatus: string;
  changeReason: string;
  effectiveEndDate: string;
  effectiveStartDate: string;
  excluded?: boolean;
  fundCode: string;
  fundGroup: string;
  fundName: string;
  fundType: string;
  includeInCashReconciliation: string;
  includeInStandardReporting: string;
  issueMessage: string;
  majorFundFlag: string;
  reportingExclusionReason: string;
  reportingModel: string;
  reportingTreatment: string;
  rowStatus:
    | "new"
    | "changed"
    | "unchanged"
    | "skipped_existing"
    | "fill_missing"
    | "rejected"
    | "edited"
    | "deleted"
    | "warning"
    | "duplicate"
    | "conflict";
  sourceRowNumber: number;
};

export type FundImportOptions = {
  fillMissingData: boolean;
  updateExisting: boolean;
};

export type FundImportPreviewState = {
  message?: string;
  options: FundImportOptions;
  preview?: {
    deletedFromPreview: number;
    issues: FundImportIssue[];
    rows: FundImportPreviewRow[];
    sheetNames: string[];
    selectedSheetName: string;
    summary: {
      changed: number;
      duplicate: number;
      fillMissing: number;
      newRows: number;
      rejected: number;
      skipped: number;
      unchanged: number;
      warning: number;
    };
  };
  status: "idle" | "success" | "error";
};

export type FundImportCommitState = {
  message?: string;
  result?: {
    deletedFromPreview: number;
    filledMissing: number;
    inserted: number;
    mappingVersion: number | null;
    rejected: number;
    skipped: number;
    updated: number;
  };
  status: "idle" | "success" | "error";
};

export const initialFundImportPreviewState: FundImportPreviewState = {
  options: {
    fillMissingData: false,
    updateExisting: false
  },
  status: "idle"
};

export const initialFundImportCommitState: FundImportCommitState = {
  status: "idle"
};
