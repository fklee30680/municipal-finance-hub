export type TrialBalancePostingState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialTrialBalancePostingState: TrialBalancePostingState = {
  status: "idle"
};
