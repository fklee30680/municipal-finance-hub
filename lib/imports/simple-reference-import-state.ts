import type { SimpleReferenceImportRoute } from "@/lib/imports/simple-reference-import-config";

export type SimpleReferenceImportIssue = {
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

export type SimpleReferenceRowStatus =
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

export type SimpleReferencePreviewRow = {
  excluded?: boolean;
  issueMessage: string;
  rowStatus: SimpleReferenceRowStatus;
  sourceRowNumber: number;
  values: Record<string, string>;
};

export type SimpleReferenceImportOptions = {
  fillMissingData: boolean;
  updateExisting: boolean;
};

export type SimpleReferencePreviewState = {
  message?: string;
  options: SimpleReferenceImportOptions;
  preview?: {
    deletedFromPreview: number;
    issues: SimpleReferenceImportIssue[];
    rows: SimpleReferencePreviewRow[];
    route: SimpleReferenceImportRoute;
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

export type SimpleReferenceCommitState = {
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

export const initialSimpleReferencePreviewState: SimpleReferencePreviewState = {
  options: {
    fillMissingData: false,
    updateExisting: false
  },
  status: "idle"
};

export const initialSimpleReferenceCommitState: SimpleReferenceCommitState = {
  status: "idle"
};
