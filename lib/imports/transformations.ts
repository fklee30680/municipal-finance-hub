const numericFields = new Set([
  "beginning_balance",
  "debits",
  "credits",
  "net_change",
  "ending_balance"
]);

export type PreviewIssueDraft = {
  issueCode: string;
  issueMessage: string;
  issueSeverity: "info" | "warning" | "error";
  sourceColumnName?: string;
  targetFieldName?: string;
  rawValue?: string;
  transformedValue?: string;
};

export function applyCellTransformations({
  rules,
  targetFieldName,
  value
}: {
  rules: Set<string>;
  targetFieldName: string;
  value: unknown;
}) {
  let transformedValue = stringifyValue(value);

  if (rules.has("trim_whitespace")) {
    transformedValue = transformedValue.trim();
  }

  if (numericFields.has(targetFieldName)) {
    if (rules.has("remove_commas_from_numbers")) {
      transformedValue = transformedValue.replace(/,/g, "");
    }

    if (rules.has("remove_dollar_signs")) {
      transformedValue = transformedValue.replace(/\$/g, "");
    }

    if (rules.has("parentheses_as_negative")) {
      const trimmedValue = transformedValue.trim();
      if (trimmedValue.startsWith("(") && trimmedValue.endsWith(")")) {
        transformedValue = `-${trimmedValue.slice(1, -1)}`;
      }
    }
  }

  if (targetFieldName === "full_account_number") {
    if (rules.has("remove_trailing_account_delimiters")) {
      transformedValue = transformedValue.replace(/[-\s]+$/g, "");
    }

    if (rules.has("normalize_account_delimiters")) {
      transformedValue = transformedValue.replace(/\s*-\s*/g, "-");
    }
  }

  return transformedValue;
}

export function parsePreviewNumber({
  rawValue,
  rules,
  sourceColumnName,
  targetFieldName
}: {
  rawValue: string;
  rules: Set<string>;
  sourceColumnName?: string;
  targetFieldName: string;
}) {
  const trimmedValue = rawValue.trim();

  if (!trimmedValue) {
    if (rules.has("blank_numeric_to_zero")) {
      return {
        value: 0,
        issue: null
      };
    }

    if (rules.has("blank_numeric_to_null")) {
      return {
        value: null,
        issue: null
      };
    }

    return {
      value: null,
      issue: {
        issueCode: "blank_numeric_value",
        issueMessage: `${targetFieldName} is blank.`,
        issueSeverity: "warning" as const,
        sourceColumnName,
        targetFieldName,
        rawValue
      }
    };
  }

  const parsedValue = Number(trimmedValue);

  if (Number.isNaN(parsedValue)) {
    return {
      value: null,
      issue: {
        issueCode: "numeric_parse_failed",
        issueMessage: `${targetFieldName} could not be parsed as a number.`,
        issueSeverity: "error" as const,
        sourceColumnName,
        targetFieldName,
        rawValue,
        transformedValue: rawValue
      }
    };
  }

  return {
    value: parsedValue,
    issue: null
  };
}

export function isBlankPreviewRow(values: string[]) {
  return values.every((value) => !value.trim());
}

export function looksLikeRepeatedHeader({
  headerValues,
  rowValues
}: {
  headerValues: string[];
  rowValues: string[];
}) {
  const normalizedHeader = headerValues.map(normalizeHeaderValue).join("|");
  const normalizedRow = rowValues
    .slice(0, headerValues.length)
    .map(normalizeHeaderValue)
    .join("|");

  return normalizedHeader === normalizedRow;
}

export function stringifyValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function normalizeHeaderValue(value: string) {
  return value.trim().toLowerCase();
}
