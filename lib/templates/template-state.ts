export type TemplateSaveState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialTemplateSaveState: TemplateSaveState = {
  status: "idle"
};
