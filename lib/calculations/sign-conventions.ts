export const CALCULATION_VERSION = "mvp_actuals_v1";

export type SignConventionRule = {
  activitySignMultiplier: number;
  endingBalanceSignMultiplier: number;
  naturalBalanceType: "debit" | "credit" | "contextual";
  statementSignMultiplier: number;
  varianceFavorableDirection: "increase" | "decrease" | "contextual";
};

export const defaultSignConventionRules: Record<string, SignConventionRule> = {
  asset: rule("debit", 1, 1, 1),
  assets: rule("debit", 1, 1, 1),
  cash: rule("debit", 1, 1, 1),
  cash_and_investments: rule("debit", 1, 1, 1),
  current_assets: rule("debit", 1, 1, 1),
  liability: rule("credit", -1, -1, 1),
  liabilities: rule("credit", -1, -1, 1),
  current_liabilities: rule("credit", -1, -1, 1),
  fund_balance: rule("credit", -1, -1, 1),
  net_position: rule("credit", -1, -1, 1),
  revenue: rule("credit", -1, -1, 1),
  revenues: rule("credit", -1, -1, 1),
  other_financing_sources: rule("credit", -1, -1, 1),
  expenditure: rule("debit", 1, 1, 1),
  expenditures: rule("debit", 1, 1, 1),
  expense: rule("debit", 1, 1, 1),
  expenses: rule("debit", 1, 1, 1),
  other_financing_uses: rule("debit", 1, 1, 1)
};

export function getSignConventionRule(accountType?: string | null) {
  const key = normalizeClassification(accountType);
  return defaultSignConventionRules[key] ?? rule("contextual", 1, 1, 1);
}

export function presentationAmount({
  accountType,
  amount,
  amountType
}: {
  accountType?: string | null;
  amount: number;
  amountType: "activity" | "ending_balance" | "statement";
}) {
  const convention = getSignConventionRule(accountType);

  if (amountType === "activity") {
    return amount * convention.activitySignMultiplier;
  }

  if (amountType === "ending_balance") {
    return amount * convention.endingBalanceSignMultiplier;
  }

  return amount * convention.statementSignMultiplier;
}

export function normalizeClassification(value?: string | null) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function rule(
  naturalBalanceType: SignConventionRule["naturalBalanceType"],
  activitySignMultiplier: number,
  endingBalanceSignMultiplier: number,
  statementSignMultiplier: number
): SignConventionRule {
  return {
    activitySignMultiplier,
    endingBalanceSignMultiplier,
    naturalBalanceType,
    statementSignMultiplier,
    varianceFavorableDirection: "contextual"
  };
}
