import type { PreviewIssueDraft } from "@/lib/imports/transformations";

export type AccountStructureConfig = {
  delimiter: string | null;
  segmentCount: number;
  trimSpaces: boolean;
  removeTrailingDelimiters: boolean;
  preserveLeadingZeros: boolean;
  segments: Array<{
    segmentNumber: number;
    segmentName: string;
    segmentKey: string;
  }>;
};

export function parseAccountNumber({
  accountNumber,
  accountStructure
}: {
  accountNumber: string;
  accountStructure: AccountStructureConfig;
}) {
  const delimiter = accountStructure.delimiter ?? "-";
  let workingAccountNumber = accountStructure.trimSpaces
    ? accountNumber.trim()
    : accountNumber;

  if (accountStructure.removeTrailingDelimiters && delimiter) {
    while (workingAccountNumber.endsWith(delimiter)) {
      workingAccountNumber = workingAccountNumber.slice(0, -delimiter.length);
    }
  }

  const parts = delimiter
    ? workingAccountNumber.split(delimiter)
    : [workingAccountNumber];
  const normalizedParts = parts.map((part) =>
    accountStructure.trimSpaces ? part.trim() : part
  );

  const parsedSegments: Record<string, string> = {};
  const issues: PreviewIssueDraft[] = [];

  if (normalizedParts.length !== accountStructure.segmentCount) {
    issues.push({
      issueCode: "account_segment_count_mismatch",
      issueMessage: `Expected ${accountStructure.segmentCount} account segments but found ${normalizedParts.length}.`,
      issueSeverity: "error",
      targetFieldName: "full_account_number",
      rawValue: accountNumber,
      transformedValue: workingAccountNumber
    });
  }

  for (const segment of accountStructure.segments) {
    const value = normalizedParts[segment.segmentNumber - 1] ?? "";
    parsedSegments[segment.segmentKey] = value;
  }

  return {
    parsedSegments,
    issues
  };
}
