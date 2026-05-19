export type TrialBalanceValidationState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialTrialBalanceValidationState: TrialBalanceValidationState = {
  status: "idle"
};
