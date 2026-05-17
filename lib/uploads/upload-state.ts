export type UploadSourceFileState = {
  status: "idle" | "success" | "error";
  message?: string;
  duplicateWarning?: string;
  upload?: {
    originalFileName: string;
    importTypeName: string;
    fiscalYear: string;
    period: string;
    fileType: string;
    fileSize: string;
    fileHash: string;
    uploadedAt: string;
    importBatchStatus: string;
  };
};

export const initialUploadSourceFileState: UploadSourceFileState = {
  status: "idle"
};
