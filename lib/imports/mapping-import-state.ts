export type MappingImportState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export const initialMappingImportState: MappingImportState = {
  status: "idle"
};
