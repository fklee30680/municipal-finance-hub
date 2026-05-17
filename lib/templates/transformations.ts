export const transformationOptions = [
  "trim_whitespace",
  "remove_commas_from_numbers",
  "remove_dollar_signs",
  "parentheses_as_negative",
  "blank_numeric_to_zero",
  "blank_numeric_to_null",
  "preserve_leading_zeros",
  "remove_trailing_account_delimiters",
  "normalize_account_delimiters",
  "pad_codes_to_segment_length",
  "remove_blank_rows",
  "ignore_repeated_header_rows",
  "uppercase_text",
  "titlecase_text",
  "parse_dates"
] as const;

export function formatTransformationLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
