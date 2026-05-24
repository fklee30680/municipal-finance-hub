"use client";

import {
  type Dispatch,
  type SetStateAction,
  useActionState,
  useMemo,
  useState
} from "react";

import {
  commitFundImportAction,
  previewFundImportAction
} from "@/app/imports/funds/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  initialFundImportCommitState,
  initialFundImportPreviewState,
  type FundImportPreviewState,
  type FundImportPreviewRow
} from "@/lib/imports/fund-import-state";

const fieldClass =
  "mt-1 min-h-10 w-full rounded-none border border-border bg-background px-3 text-sm font-normal normal-case text-foreground";

export function FundImportForm() {
  const [previewState, previewAction, previewPending] = useActionState(
    previewFundImportAction,
    initialFundImportPreviewState
  );
  const [commitState, commitAction, commitPending] = useActionState(
    commitFundImportAction,
    initialFundImportCommitState
  );

  return (
    <div className="space-y-4">
      {commitState.result ? (
        <section className="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Inserted {commitState.result.inserted}. Updated{" "}
          {commitState.result.updated}. Filled missing{" "}
          {commitState.result.filledMissing}. Skipped{" "}
          {commitState.result.skipped}. Rejected {commitState.result.rejected}.
          Deleted from preview {commitState.result.deletedFromPreview}.
        </section>
      ) : null}

      {commitState.message && !commitState.result ? (
        <section
          className={
            commitState.status === "error"
              ? "rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
              : "rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
          }
        >
          {commitState.message}
        </section>
      ) : null}

      <details className="rounded-md border border-border bg-card" open>
        <summary className="flex cursor-pointer items-center justify-between px-6 py-4 text-sm font-semibold text-foreground">
          <span>Import Funds</span>
          <span className="text-xs font-normal uppercase text-muted-foreground">
            Expand / Collapse
          </span>
        </summary>
        <form action={previewAction} className="space-y-5 border-t border-border p-6">
          <div>
            <h2 className="text-base font-semibold text-foreground">Import Funds</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              For mapping fields, enter the column header name, spreadsheet
              column letter, or column number.
            </p>
          </div>

          <section>
            <h3 className="text-sm font-semibold text-foreground">Import Mapping</h3>
            <div className="mt-3 max-w-xs">
              <TextInput
                defaultValue="1"
                helperText="Enter the row number that contains column headers."
                label="Header Row"
                name="headerRow"
                required
                type="number"
              />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <TextInput
                defaultValue="Fund Code"
                label="Fund Code"
                name="fundCodeColumn"
                required
              />
              <TextInput
                defaultValue="Fund Name"
                label="Fund Name"
                name="fundNameColumn"
                required
              />
              <TextInput
                defaultValue="Fund Type"
                label="Fund Type"
                name="fundTypeColumn"
              />
              <TextInput
                defaultValue="Reporting Model"
                label="Reporting Model"
                name="reportingModelColumn"
              />
              <TextInput
                defaultValue="Fund Group"
                label="Fund Group"
                name="fundGroupColumn"
              />
              <TextInput
                defaultValue="Major Fund Flag"
                label="Major Fund Flag"
                name="majorFundFlagColumn"
              />
              <TextInput
                defaultValue="Reporting Treatment"
                label="Reporting Treatment"
                name="reportingTreatmentColumn"
              />
              <TextInput
                defaultValue="Include In Standard Reporting"
                label="Include In Standard Reporting"
                name="includeInStandardReportingColumn"
              />
              <TextInput
                defaultValue="Include In Cash Reconciliation"
                label="Include In Cash Reconciliation"
                name="includeInCashReconciliationColumn"
              />
              <TextInput
                defaultValue="Reporting Exclusion Reason"
                label="Reporting Exclusion Reason"
                name="reportingExclusionReasonColumn"
              />
              <TextInput
                defaultValue="Effective Start Date"
                label="Effective Start Date"
                name="effectiveStartDateColumn"
              />
              <TextInput
                defaultValue="Effective End Date"
                label="Effective End Date"
                name="effectiveEndDateColumn"
              />
              <TextInput
                defaultValue="Active Status"
                label="Active Status"
                name="activeStatusColumn"
              />
              <TextInput
                defaultValue="Change Reason"
                label="Change Reason"
                name="changeReasonColumn"
              />
              <TextInput
                helperText="Optional for Excel. Use a sheet name or 1-based sheet number. Blank uses the first sheet."
                label="Excel Sheet"
                name="sheetReference"
                placeholder="Sheet1 or 1"
              />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <CheckboxInput
                helperText="Imported nonblank values overwrite saved values."
                label="Update existing funds"
                name="updateExisting"
              />
              <CheckboxInput
                helperText="Imported values fill blank fields without overwriting saved values."
                label="Fill missing data on existing funds"
                name="fillMissingData"
              />
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-foreground">Upload</h3>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row">
              <Input
                accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="min-h-10 flex-1 rounded-none"
                name="fundFile"
                required
                type="file"
              />
              <Button disabled={previewPending} type="submit">
                {previewPending ? "Parsing..." : "Import Funds"}
              </Button>
            </div>
          </section>
        </form>
      </details>

      {previewState.message ? (
        <section
          className={
            previewState.status === "error"
              ? "rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900"
              : "rounded-md border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
          }
        >
          {previewState.message}
        </section>
      ) : null}

      {previewState.preview ? (
        <FundPreviewModal
          commitAction={commitAction}
          commitPending={commitPending}
          previewState={previewState}
        />
      ) : null}
    </div>
  );
}

function FundPreviewModal({
  commitAction,
  commitPending,
  previewState
}: {
  commitAction: (payload: FormData) => void;
  commitPending: boolean;
  previewState: FundImportPreviewState;
}) {
  const [rows, setRows] = useState<FundImportPreviewRow[]>(
    previewState.preview?.rows ?? []
  );
  const [modalOpen, setModalOpen] = useState(true);
  const editedRowsJson = useMemo(() => JSON.stringify(rows), [rows]);
  const deletedFromPreview = rows.filter(
    (row) => row.excluded || row.rowStatus === "deleted"
  ).length;
  const commitDisabled =
    commitPending ||
    rows.filter(
      (row) =>
        !row.excluded &&
        !["deleted", "rejected", "duplicate", "conflict"].includes(row.rowStatus)
    ).length === 0;

  if (!modalOpen || !previewState.preview) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 px-4 py-8">
      <div className="mx-auto max-w-7xl rounded-md border border-border bg-background shadow-xl">
            <div className="flex flex-col gap-3 border-b border-border px-6 py-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  Fund Import Preview
                </h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  Review the staged import before committing. Edits in this
                  preview do not modify the saved Funds table until you commit.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sheet: {previewState.preview.selectedSheetName}
                  {previewState.preview.sheetNames.length > 1
                    ? ` (${previewState.preview.sheetNames.join(", ")})`
                    : ""}
                </p>
              </div>
              <button
                className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted"
                onClick={() => setModalOpen(false)}
                type="button"
              >
                Close Preview
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="grid gap-3 text-sm md:grid-cols-6">
                <Summary label="New" value={previewState.preview.summary.newRows} />
                <Summary label="Changed" value={previewState.preview.summary.changed} />
                <Summary
                  label="Fill missing"
                  value={previewState.preview.summary.fillMissing}
                />
                <Summary label="Skipped" value={previewState.preview.summary.skipped} />
                <Summary label="Rejected" value={previewState.preview.summary.rejected} />
                <Summary label="Deleted" value={deletedFromPreview} />
              </div>

              <form action={commitAction} className="space-y-4">
                <input name="rowsJson" type="hidden" value={editedRowsJson} />
                <input
                  name="updateExisting"
                  type="hidden"
                  value={previewState.options.updateExisting ? "on" : ""}
                />
                <input
                  name="fillMissingData"
                  type="hidden"
                  value={previewState.options.fillMissingData ? "on" : ""}
                />
                <label className="block max-w-xl text-sm">
                  <span className="font-medium text-foreground">Change description</span>
                  <Input
                    className="mt-1"
                    defaultValue="Fund import from /imports/funds"
                    name="changeDescription"
                  />
                </label>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1900px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        <th className="py-3 pr-3 font-medium">Row</th>
                        <th className="py-3 pr-3 font-medium">Fund Code</th>
                        <th className="py-3 pr-3 font-medium">Fund Name</th>
                        <th className="py-3 pr-3 font-medium">Fund Type</th>
                        <th className="py-3 pr-3 font-medium">Reporting Model</th>
                        <th className="py-3 pr-3 font-medium">Fund Group</th>
                        <th className="py-3 pr-3 font-medium">Major Fund</th>
                        <th className="py-3 pr-3 font-medium">
                          Reporting Treatment
                        </th>
                        <th className="py-3 pr-3 font-medium">
                          Standard Reporting
                        </th>
                        <th className="py-3 pr-3 font-medium">
                          Cash Reconciliation
                        </th>
                        <th className="py-3 pr-3 font-medium">
                          Reporting Exclusion Reason
                        </th>
                        <th className="py-3 pr-3 font-medium">Effective Start</th>
                        <th className="py-3 pr-3 font-medium">Effective End</th>
                        <th className="py-3 pr-3 font-medium">Active Status</th>
                        <th className="py-3 pr-3 font-medium">Change Reason</th>
                        <th className="py-3 pr-3 font-medium">Status</th>
                        <th className="py-3 pr-3 font-medium">Issue</th>
                        <th className="py-3 font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr
                          className={
                            row.excluded || row.rowStatus === "deleted"
                              ? "border-b border-border bg-muted/60 align-top opacity-70"
                              : "border-b border-border align-top"
                          }
                          key={`${row.sourceRowNumber}-${index}`}
                        >
                          <td className="py-3 pr-3 text-muted-foreground">
                            {row.sourceRowNumber}
                          </td>
                          <EditableCell
                            field="fundCode"
                            index={index}
                            rows={rows}
                            setRows={setRows}
                          />
                          <EditableCell
                            field="fundName"
                            index={index}
                            rows={rows}
                            setRows={setRows}
                          />
                          <EditableCell
                            field="fundType"
                            index={index}
                            rows={rows}
                            setRows={setRows}
                          />
                          <EditableCell
                            field="reportingModel"
                            index={index}
                            rows={rows}
                            setRows={setRows}
                          />
                          <EditableCell
                            field="fundGroup"
                            index={index}
                            rows={rows}
                            setRows={setRows}
                          />
                          <EditableCell
                            field="majorFundFlag"
                            index={index}
                            rows={rows}
                            setRows={setRows}
                          />
                          <EditableCell
                            field="reportingTreatment"
                            index={index}
                            rows={rows}
                            setRows={setRows}
                          />
                          <EditableCell
                            field="includeInStandardReporting"
                            index={index}
                            rows={rows}
                            setRows={setRows}
                          />
                          <EditableCell
                            field="includeInCashReconciliation"
                            index={index}
                            rows={rows}
                            setRows={setRows}
                          />
                          <EditableCell
                            field="reportingExclusionReason"
                            index={index}
                            rows={rows}
                            setRows={setRows}
                          />
                          <EditableCell
                            field="effectiveStartDate"
                            index={index}
                            rows={rows}
                            setRows={setRows}
                          />
                          <EditableCell
                            field="effectiveEndDate"
                            index={index}
                            rows={rows}
                            setRows={setRows}
                          />
                          <EditableCell
                            field="activeStatus"
                            index={index}
                            rows={rows}
                            setRows={setRows}
                          />
                          <EditableCell
                            field="changeReason"
                            index={index}
                            rows={rows}
                            setRows={setRows}
                          />
                          <td className="py-3 pr-3 text-muted-foreground">
                            {row.rowStatus}
                          </td>
                          <td className="max-w-xs py-3 pr-3 text-muted-foreground">
                            {row.issueMessage}
                          </td>
                          <td className="py-3">
                            <button
                              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted"
                              onClick={() => excludeRow(index)}
                              type="button"
                            >
                              Delete / exclude
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button disabled={commitDisabled} type="submit">
                    {commitPending ? "Committing..." : "Commit Funds"}
                  </Button>
                  <button
                    className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted"
                    onClick={() => setModalOpen(false)}
                    type="button"
                  >
                    Keep reviewing
                  </button>
                </div>
              </form>

              <BadDataReport issues={previewState.preview.issues} />
            </div>
      </div>
    </div>
  );

  function excludeRow(index: number) {
    setRows((currentRows) =>
      currentRows.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              excluded: true,
              rowStatus: "deleted"
            }
          : row
      )
    );
  }
}

function TextInput({
  defaultValue,
  helperText,
  label,
  name,
  placeholder,
  required,
  type = "text"
}: {
  defaultValue?: string | number;
  helperText?: string;
  label: string;
  name: string;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-xs font-semibold uppercase text-muted-foreground">
      {label}
      <input
        className={fieldClass}
        defaultValue={defaultValue}
        min={type === "number" ? 1 : undefined}
        name={name}
        placeholder={placeholder}
        required={required}
        type={type}
      />
      {helperText ? (
        <span className="mt-1 block text-xs font-normal normal-case text-muted-foreground">
          {helperText}
        </span>
      ) : null}
    </label>
  );
}

function CheckboxInput({
  helperText,
  label,
  name
}: {
  helperText: string;
  label: string;
  name: string;
}) {
  return (
    <label className="flex min-h-10 items-center gap-3 self-end border border-border bg-background px-3 py-2 text-sm">
      <input className="h-4 w-4 accent-primary" name={name} type="checkbox" />
      <span>
        <span className="block font-semibold text-foreground">{label}</span>
        <span className="block text-xs text-muted-foreground">{helperText}</span>
      </span>
    </label>
  );
}

function EditableCell({
  field,
  index,
  rows,
  setRows
}: {
  field: keyof Pick<
    FundImportPreviewRow,
    | "activeStatus"
    | "changeReason"
    | "effectiveEndDate"
    | "effectiveStartDate"
    | "fundCode"
    | "fundGroup"
    | "fundName"
    | "fundType"
    | "includeInCashReconciliation"
    | "includeInStandardReporting"
    | "majorFundFlag"
    | "reportingExclusionReason"
    | "reportingModel"
    | "reportingTreatment"
  >;
  index: number;
  rows: FundImportPreviewRow[];
  setRows: Dispatch<SetStateAction<FundImportPreviewRow[]>>;
}) {
  return (
    <td className="py-3 pr-3">
      <input
        className="min-h-9 w-full min-w-32 rounded-none border border-border bg-background px-2 text-sm"
        onChange={(event) => {
          const nextRows = rows.map((row, rowIndex) =>
            rowIndex === index
              ? {
                  ...row,
                  [field]: event.target.value,
                  rowStatus:
                    row.rowStatus === "deleted" || row.rowStatus === "rejected"
                      ? row.rowStatus
                      : ("edited" as const)
                }
              : row
          );
          setRows(nextRows);
        }}
        value={rows[index]?.[field] ?? ""}
      />
    </td>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function BadDataReport({
  issues
}: {
  issues: {
    issueMessage: string;
    issueSeverity: string;
    issueType: string;
    rawValue?: string | null;
    sourceColumnName?: string | null;
    sourceRowNumber: number;
    suggestedFix?: string | null;
    targetFieldName?: string | null;
    transformedValue?: string | null;
  }[];
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Bad-data report</h3>
      {issues.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No bad-data issues were found in the staged preview.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="py-3 pr-3 font-medium">Source row</th>
                <th className="py-3 pr-3 font-medium">Source column</th>
                <th className="py-3 pr-3 font-medium">Target field</th>
                <th className="py-3 pr-3 font-medium">Raw value</th>
                <th className="py-3 pr-3 font-medium">Transformed value</th>
                <th className="py-3 pr-3 font-medium">Issue type</th>
                <th className="py-3 pr-3 font-medium">Severity</th>
                <th className="py-3 pr-3 font-medium">Issue message</th>
                <th className="py-3 font-medium">Suggested fix</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue, index) => (
                <tr className="border-b border-border align-top" key={index}>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {issue.sourceRowNumber}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {issue.sourceColumnName ?? ""}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {issue.targetFieldName ?? ""}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {issue.rawValue ?? ""}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {issue.transformedValue ?? ""}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {issue.issueType}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {issue.issueSeverity}
                  </td>
                  <td className="py-3 pr-3 text-muted-foreground">
                    {issue.issueMessage}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {issue.suggestedFix ?? ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
