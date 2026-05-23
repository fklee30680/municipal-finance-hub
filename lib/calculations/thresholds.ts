import type { SupabaseClient } from "@supabase/supabase-js";

export type ThresholdConfig = {
  globalDollarThreshold: number;
  globalPercentageThreshold: number;
  minimumBaseAmountForPercentageVariance: number;
  thresholdConfigId: string | null;
};

export const defaultThresholdConfig: ThresholdConfig = {
  globalDollarThreshold: 100000,
  globalPercentageThreshold: 0.1,
  minimumBaseAmountForPercentageVariance: 1000,
  thresholdConfigId: null
};

type ThresholdConfigRecord = {
  threshold_config_id: string;
  global_dollar_threshold: number | string | null;
  global_percentage_threshold: number | string | null;
  minimum_base_amount_for_percentage_variance: number | string | null;
  dollar_threshold: number | string | null;
  percentage_threshold: number | string | null;
};

export async function loadThresholdConfig({
  adminClient,
  organizationId
}: {
  adminClient: SupabaseClient;
  organizationId: string;
}): Promise<ThresholdConfig> {
  const result = await adminClient
    .from("threshold_configs")
    .select(
      "threshold_config_id, global_dollar_threshold, global_percentage_threshold, minimum_base_amount_for_percentage_variance, dollar_threshold, percentage_threshold"
    )
    .eq("organization_id", organizationId)
    .eq("active_status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<ThresholdConfigRecord>();

  if (result.error || !result.data) {
    return defaultThresholdConfig;
  }

  return {
    globalDollarThreshold:
      toNumber(result.data.global_dollar_threshold) ??
      toNumber(result.data.dollar_threshold) ??
      defaultThresholdConfig.globalDollarThreshold,
    globalPercentageThreshold:
      toNumber(result.data.global_percentage_threshold) ??
      toNumber(result.data.percentage_threshold) ??
      defaultThresholdConfig.globalPercentageThreshold,
    minimumBaseAmountForPercentageVariance:
      toNumber(result.data.minimum_base_amount_for_percentage_variance) ??
      defaultThresholdConfig.minimumBaseAmountForPercentageVariance,
    thresholdConfigId: result.data.threshold_config_id
  };
}

export function classifyVarianceSeverity({
  absoluteVarianceAmount,
  thresholdConfig,
  variancePercent
}: {
  absoluteVarianceAmount: number;
  thresholdConfig: ThresholdConfig;
  variancePercent: number | null;
}) {
  if (absoluteVarianceAmount >= thresholdConfig.globalDollarThreshold * 2) {
    return "High";
  }

  if (absoluteVarianceAmount >= thresholdConfig.globalDollarThreshold) {
    return "Warning";
  }

  if (
    variancePercent !== null &&
    Math.abs(variancePercent) >= thresholdConfig.globalPercentageThreshold * 2
  ) {
    return "High";
  }

  if (
    variancePercent !== null &&
    Math.abs(variancePercent) >= thresholdConfig.globalPercentageThreshold
  ) {
    return "Warning";
  }

  return "Info";
}

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = typeof value === "number" ? value : Number.parseFloat(value);
  return Number.isNaN(numeric) ? null : numeric;
}
