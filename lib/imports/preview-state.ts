export type TrialBalancePreviewState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialTrialBalancePreviewState: TrialBalancePreviewState = {
  status: "idle"
};
