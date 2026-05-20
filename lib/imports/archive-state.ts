export type ArchiveImportState = {
  message?: string;
  status: "idle" | "success" | "error";
};

export const initialArchiveImportState: ArchiveImportState = {
  status: "idle"
};
