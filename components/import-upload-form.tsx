"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  initialUploadSourceFileState,
  type UploadSourceFileState
} from "@/lib/uploads/upload-state";

type ImportTypeOption = {
  import_type_id: string;
  import_type_code: string;
  import_type_name: string;
};

export function ImportUploadForm({
  action,
  continuePath = "/imports/new",
  defaultImportTypeCode,
  importTypes
}: {
  action: (
    previousState: UploadSourceFileState,
    formData: FormData
  ) => Promise<UploadSourceFileState>;
  continuePath?: string;
  defaultImportTypeCode?: string;
  importTypes: ImportTypeOption[];
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialUploadSourceFileState
  );
  const defaultImportTypeId =
    importTypes.find(
      (importType) => importType.import_type_code === defaultImportTypeCode
    )?.import_type_id ?? "";
  const [selectedImportTypeId, setSelectedImportTypeId] = useState(defaultImportTypeId);
  const [periodValue, setPeriodValue] = useState("");
  const [period13Handling, setPeriod13Handling] = useState("post_closing");
  const selectedImportType = importTypes.find(
    (importType) => importType.import_type_id === selectedImportTypeId
  );
  const showPeriod13Handling =
    selectedImportType?.import_type_code === "trial_balance" &&
    periodValue.trim() === "13";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <Card>
        <CardHeader>
          <CardTitle>Upload details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="importTypeId">
                Import type
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                id="importTypeId"
                name="importTypeId"
                onChange={(event) => setSelectedImportTypeId(event.target.value)}
                required
                value={selectedImportTypeId}
              >
                <option value="">Select import type</option>
                {importTypes.map((importType) => (
                  <option
                    key={importType.import_type_id}
                    value={importType.import_type_id}
                  >
                    {importType.import_type_name}
                  </option>
                ))}
              </select>
              <p className="text-xs leading-5 text-muted-foreground">
                Trial balance uploads require fiscal year and period. Mapping
                uploads can leave them blank for now.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="fiscalYear">
                  Fiscal year
                </label>
                <Input
                  id="fiscalYear"
                  inputMode="numeric"
                  name="fiscalYear"
                  placeholder="2026"
                  type="number"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="period">
                  Period
                </label>
                <Input
                  id="period"
                  inputMode="numeric"
                  max={13}
                  min={0}
                  name="period"
                  onChange={(event) => setPeriodValue(event.target.value)}
                  placeholder="1"
                  type="number"
                  value={periodValue}
                />
              </div>
            </div>

            {showPeriod13Handling ? (
              <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                <label className="block space-y-2 font-medium" htmlFor="period13Handling">
                  Period 13 trial balance type
                  <select
                    className="flex h-10 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    id="period13Handling"
                    name="period13Handling"
                    onChange={(event) => setPeriod13Handling(event.target.value)}
                    required
                    value={period13Handling}
                  >
                    <option value="post_closing">Post-closing trial balance</option>
                    <option value="pre_closing">Pre-closing year-end trial balance</option>
                    <option value="unsure">Unsure, require review</option>
                  </select>
                </label>
                <p className="leading-6">
                  {period13Handling === "pre_closing"
                    ? "Pre-closing Period 13 may include unclosed nominal activity and will be flagged pending close verification if explainable."
                    : period13Handling === "unsure"
                      ? "The app will run Period 13 diagnostics and require review if balance issues appear."
                      : "Post-closing Period 13 must balance like a normal trial balance."}
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="file">
                File selector
              </label>
              <Input
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                id="file"
                name="file"
                required
                type="file"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                Accepted formats: CSV and Excel files. Maximum size: 25 MB.
              </p>
            </div>

            <Button disabled={isPending || importTypes.length === 0} type="submit">
              {isPending ? "Uploading..." : "Upload source file"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state.status === "idle" ? (
            <p className="text-sm leading-6 text-muted-foreground">
              This step stores the raw source file and creates an import batch.
              Parsing, template mapping, validation, and posting happen in
              later steps.
            </p>
          ) : null}

          {state.message ? (
            <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
              {state.message}
            </p>
          ) : null}

          {state.duplicateWarning ? (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-950">
              {state.duplicateWarning}
            </p>
          ) : null}

          {state.upload ? (
            <>
              <dl className="space-y-3 text-sm">
                {Object.entries({
                  "Original filename": state.upload.originalFileName,
                  "Import type": state.upload.importTypeName,
                  "Fiscal year": state.upload.fiscalYear,
                  Period: state.upload.period,
                  "File type": state.upload.fileType,
                  "File size": state.upload.fileSize,
                  "File hash": state.upload.fileHash,
                  "Upload timestamp": state.upload.uploadedAt,
                  "Import batch status": state.upload.importBatchStatus
                }).map(([label, value]) => (
                  <div className="space-y-1" key={label}>
                    <dt className="font-medium text-foreground">{label}</dt>
                    <dd className="break-words text-muted-foreground">{value}</dd>
                  </div>
                ))}
              </dl>
              <Link
                className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
                href={`${continuePath}?sourceFileId=${state.upload.sourceFileId}&importBatchId=${state.upload.importBatchId}&importTypeCode=${state.upload.importTypeCode}`}
              >
                Continue mapping this file
              </Link>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
