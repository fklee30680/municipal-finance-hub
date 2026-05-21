import { isSupportedMappingImportType } from "@/lib/imports/mapping-import";

export type ImportWorkflowSnapshot = {
  activeConflict?: boolean;
  batchStatus?: string | null;
  criticalErrorCount?: number | null;
  eligibleToPost?: boolean | null;
  hasSourceFile: boolean;
  hasTemplateVersion: boolean;
  importTypeCode?: string | null;
  latestMappingRunStatus?: string | null;
  latestPreviewStatus?: string | null;
  latestValidationStatus?: string | null;
  mappingRowsAccepted?: number | null;
  warningCount?: number | null;
  warningsAcknowledged?: boolean | null;
};

export type ImportWorkflowAction = {
  key:
    | "upload_file"
    | "map_columns"
    | "generate_preview"
    | "run_validation"
    | "review_errors"
    | "acknowledge_warnings"
    | "post_trial_balance"
    | "commit_mapping"
    | "request_replacement"
    | "view_complete";
  label: string;
  description: string;
  stepNumber: number;
};

export function getNextImportWorkflowAction(
  snapshot: ImportWorkflowSnapshot
): ImportWorkflowAction {
  if (!snapshot.hasSourceFile) {
    return {
      description: "Upload a new CSV or Excel file, or pick a recent upload.",
      key: "upload_file",
      label: "Upload or select a source file",
      stepNumber: 2
    };
  }

  if (!snapshot.importTypeCode || !snapshot.hasTemplateVersion) {
    return {
      description:
        "Select the header row, map the columns, and save a template version.",
      key: "map_columns",
      label: "Map columns and save template",
      stepNumber: 4
    };
  }

  if (snapshot.importTypeCode === "trial_balance") {
    return getTrialBalanceNextAction(snapshot);
  }

  if (isSupportedMappingImportType(snapshot.importTypeCode)) {
    return getMappingNextAction(snapshot);
  }

  return {
    description: "This import type is not part of the active import workspace.",
    key: "view_complete",
    label: "Review import details",
    stepNumber: 7
  };
}

function getTrialBalanceNextAction(snapshot: ImportWorkflowSnapshot) {
  if (!snapshot.latestPreviewStatus) {
    return {
      description:
        "Generate a preview to confirm mapped fields, account segments, totals, and parse issues.",
      key: "generate_preview",
      label: "Generate trial balance preview",
      stepNumber: 5
    } satisfies ImportWorkflowAction;
  }

  if (!snapshot.latestValidationStatus) {
    return {
      description:
        "Run validation against the preview rows before any posting can happen.",
      key: "run_validation",
      label: "Run trial balance validation",
      stepNumber: 6
    } satisfies ImportWorkflowAction;
  }

  if ((snapshot.criticalErrorCount ?? 0) > 0) {
    return {
      description:
        "Critical validation errors block posting. Review the exception detail and fix the source file.",
      key: "review_errors",
      label: "Review critical validation errors",
      stepNumber: 6
    } satisfies ImportWorkflowAction;
  }

  if (
    (snapshot.warningCount ?? 0) > 0 &&
    snapshot.warningsAcknowledged === false
  ) {
    return {
      description:
        "Warnings must be acknowledged by an allowed user before posting can continue.",
      key: "acknowledge_warnings",
      label: "Acknowledge validation warnings",
      stepNumber: 6
    } satisfies ImportWorkflowAction;
  }

  if (snapshot.activeConflict) {
    return {
      description:
        "An active import already exists for this fiscal year and period. Request replacement before posting.",
      key: "request_replacement",
      label: "Request replacement",
      stepNumber: 7
    } satisfies ImportWorkflowAction;
  }

  if (snapshot.eligibleToPost) {
    return {
      description:
        "Post the validated trial balance when you are ready to make it active for future reporting work.",
      key: "post_trial_balance",
      label: "Post validated trial balance",
      stepNumber: 7
    } satisfies ImportWorkflowAction;
  }

  return {
    description:
      "Review the latest validation status before this import can move forward.",
    key: "review_errors",
    label: "Review validation results",
    stepNumber: 6
  } satisfies ImportWorkflowAction;
}

function getMappingNextAction(snapshot: ImportWorkflowSnapshot) {
  if (!snapshot.latestMappingRunStatus) {
    return {
      description:
        "Preview the mapping file so bad rows, duplicates, and changed mappings can be reviewed first.",
      key: "generate_preview",
      label: "Preview mapping import",
      stepNumber: 5
    } satisfies ImportWorkflowAction;
  }

  if (
    snapshot.latestMappingRunStatus === "previewed" &&
    (snapshot.mappingRowsAccepted ?? 0) > 0
  ) {
    return {
      description:
        "Commit accepted rows only. Rejected rows stay out and remain in the bad-data report.",
      key: "commit_mapping",
      label: "Commit accepted mappings",
      stepNumber: 7
    } satisfies ImportWorkflowAction;
  }

  return {
    description:
      "This mapping import has been reviewed or committed. Use the review details for audit follow-up.",
    key: "view_complete",
    label: "View import review",
    stepNumber: 7
  } satisfies ImportWorkflowAction;
}
