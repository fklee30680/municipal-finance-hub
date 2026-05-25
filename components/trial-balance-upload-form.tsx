"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  initialUploadSourceFileState,
  type UploadSourceFileState
} from "@/lib/uploads/upload-state";

type TrialBalancePeriodOption = {
  fiscalPeriodId: string;
  fiscalYear: number;
  fiscalYearId: string;
  importStatus: "available" | "in_progress" | "posted";
  importStatusLabel: string;
  label: string;
  period: number;
};

export function TrialBalanceUploadForm({
  accountStructureId,
  action,
  defaultFiscalPeriodId,
  importTypeId,
  periods,
  templateVersionId
}: {
  accountStructureId?: string | null;
  action: (
    previousState: UploadSourceFileState,
    formData: FormData
  ) => Promise<UploadSourceFileState>;
  defaultFiscalPeriodId?: string;
  importTypeId: string;
  periods: TrialBalancePeriodOption[];
  templateVersionId?: string | null;
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialUploadSourceFileState
  );
  const defaultPeriod =
    periods.find((period) => period.fiscalPeriodId === defaultFiscalPeriodId) ??
    periods[0] ??
    null;
  const [selectedFiscalPeriodId, setSelectedFiscalPeriodId] = useState(
    defaultPeriod?.fiscalPeriodId ?? ""
  );
  const [period13Handling, setPeriod13Handling] = useState("post_closing");
  const selectedPeriod = useMemo(
    () =>
      periods.find((period) => period.fiscalPeriodId === selectedFiscalPeriodId) ??
      null,
    [periods, selectedFiscalPeriodId]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
      <Card>
        <CardHeader>
          <CardTitle>Upload trial balance file</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={formAction} className="space-y-5">
            <input name="importTypeId" type="hidden" value={importTypeId} />
            <input
              name="templateVersionId"
              type="hidden"
              value={templateVersionId ?? ""}
            />
            <input
              name="accountStructureId"
              type="hidden"
              value={accountStructureId ?? ""}
            />
            <input
              name="fiscalYearId"
              type="hidden"
              value={selectedPeriod?.fiscalYearId ?? ""}
            />
            <input
              name="fiscalPeriodId"
              type="hidden"
              value={selectedPeriod?.fiscalPeriodId ?? ""}
            />
            <input
              name="fiscalYear"
              type="hidden"
              value={selectedPeriod?.fiscalYear ?? ""}
            />
            <input name="period" type="hidden" value={selectedPeriod?.period ?? ""} />

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="fiscalPeriodSelect">
                Fiscal period
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                id="fiscalPeriodSelect"
                onChange={(event) => setSelectedFiscalPeriodId(event.target.value)}
                required
                value={selectedFiscalPeriodId}
              >
                <option value="">Select fiscal period</option>
                {periods.map((period) => (
                  <option key={period.fiscalPeriodId} value={period.fiscalPeriodId}>
                    {period.label}
                  </option>
                ))}
              </select>
              <p className="text-xs leading-5 text-muted-foreground">
                Fiscal periods come from Fiscal Year Setup. Historical periods,
                Period 0, and Period 13 appear here when configured.
              </p>
            </div>

            {selectedPeriod ? (
              <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Selected FY {selectedPeriod.fiscalYear}, Period{" "}
                {selectedPeriod.period}. This file will be stored as a trial
                balance import for that configured period. Status:{" "}
                <span className="font-medium text-foreground">
                  {selectedPeriod.importStatusLabel}
                </span>
                .
                {selectedPeriod.importStatus === "posted"
                  ? " A posted trial balance already exists; this period will require the replacement workflow after validation."
                  : null}
                {selectedPeriod.importStatus === "in_progress"
                  ? " Another trial balance import already exists for this period. Review in-progress imports before continuing."
                  : null}
              </div>
            ) : null}

            {selectedPeriod?.period === 13 ? (
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
                    ? "The file may include unclosed revenue, expenditure, expense, transfer, and other nominal account activity. Explainable fund-level activity will be flagged pending close verification."
                    : period13Handling === "unsure"
                      ? "The app will run Period 13 diagnostics and require review before posting if balance issues appear."
                      : "The file should balance like a normal trial balance. Fund-level and batch-level imbalances are treated as critical errors."}
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="file">
                Trial balance file
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

            <Button
              disabled={
                isPending ||
                !selectedPeriod ||
                periods.length === 0
              }
              type="submit"
            >
              {isPending ? "Uploading..." : "Upload Trial Balance"}
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
              This page fixes the import type to trial balance and applies the
              saved layout automatically. Preview, validation, and posting still
              happen after upload.
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
                <div className="space-y-1">
                  <dt className="font-medium text-foreground">Original filename</dt>
                  <dd className="break-words text-muted-foreground">
                    {state.upload.originalFileName}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="font-medium text-foreground">Fiscal period</dt>
                  <dd className="text-muted-foreground">
                    FY {state.upload.fiscalYear}, Period {state.upload.period}
                  </dd>
                </div>
                <div className="space-y-1">
                  <dt className="font-medium text-foreground">Import batch status</dt>
                  <dd className="text-muted-foreground">
                    {state.upload.importBatchStatus}
                  </dd>
                </div>
              </dl>
              <Link
                className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
                href={`/imports/trial-balance?sourceFileId=${state.upload.sourceFileId}&importBatchId=${state.upload.importBatchId}`}
              >
                Continue Trial Balance Workflow
              </Link>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
