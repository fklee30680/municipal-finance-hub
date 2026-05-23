export type FiscalSetupActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  summary?: {
    fiscalYearsCreated?: number;
    fiscalYearsSkipped?: number;
    periodsCreated?: number;
    periodsSkipped?: number;
    errors?: string[];
  };
};

export const initialFiscalSetupActionState: FiscalSetupActionState = {
  status: "idle"
};
