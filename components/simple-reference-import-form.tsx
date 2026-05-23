"use client";

import {
  type Dispatch,
  type SetStateAction,
  useActionState,
  useMemo,
  useState
} from "react";

import {
  commitSimpleReferenceImportAction,
  previewSimpleReferenceImportAction
} from "@/app/imports/reference-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SimpleReferenceImportConfig } from "@/lib/imports/simple-reference-import-config";
import {
  initialSimpleReferenceCommitState,
  initialSimpleReferencePreviewState,
  type SimpleReferencePreviewRow,
  type SimpleReferencePreviewState
} from "@/lib/imports/simple-reference-import-state";

const fieldClass =
  "mt-1 min-h-10 w-full rounded-none border border-border bg-background px-3 text-sm font-normal normal-case text-foreground";

export function SimpleReferenceImportForm({
  config
}: {
  config: SimpleReferenceImportConfig;
}) {
  const [previewState, previewAction, previewPending] = useActionState(
    previewSimpleReferenceImportAction,
    initialSimpleReferencePreviewState
  );
  const [commitState, commitAction, commitPending] = useActionState(
    commitSimpleReferenceImportAction,
    initialSimpleReferenceCommitState
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
          <span>Import {config.tableTitle}</span>
          <span className="text-xs font-normal uppercase text-muted-foreground">
            Expand / Collapse
          </span>
        </summary>
        <form action={previewAction} className="space-y-5 border-t border-border p-6">
          <input name="route" type="hidden" value={config.route} />
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Import {config.tableTitle}
            </h2>
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
              {config.fields.map((field) => (
                <TextInput
                  defaultValue={field.defaultColumn}
                  key={field.key}
                  label={field.label}
                  name={field.key}
                  required={field.required}
                />
              ))}
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
                label={`Update existing ${config.pluralLabel}`}
                name="updateExisting"
              />
              <CheckboxInput
                helperText="Imported values fill blank fields without overwriting saved values."
                label={`Fill missing data on existing ${config.pluralLabel}`}
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
                name="referenceFile"
                required
                type="file"
              />
              <Button disabled={previewPending} type="submit">
                {previewPending ? "Parsing..." : `Import ${config.tableTitle}`}
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

      {previewState.preview?.route === config.route ? (
        <ReferencePreviewModal
          commitAction={commitAction}
          commitPending={commitPending}
          config={config}
          previewState={previewState}
        />
      ) : null}
    </div>
  );
}

function ReferencePreviewModal({
  commitAction,
  commitPending,
  config,
  previewState
}: {
  commitAction: (payload: FormData) => void;
  commitPending: boolean;
  config: SimpleReferenceImportConfig;
  previewState: SimpleReferencePreviewState;
}) {
  const [rows, setRows] = useState<SimpleReferencePreviewRow[]>(
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
              {config.tableTitle} Import Preview
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Review the staged import before committing. Edits in this preview
              do not modify the saved table until you commit.
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
            <input name="route" type="hidden" value={config.route} />
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
                defaultValue={`${config.tableTitle} import from /imports/${config.route}`}
                name="changeDescription"
              />
            </label>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1400px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-3 pr-3 font-medium">Row</th>
                    {config.fields.map((field) => (
                      <th className="py-3 pr-3 font-medium" key={field.dbField}>
                        {field.label.replace(" Column", "")}
                      </th>
                    ))}
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
                      {config.fields.map((field) => (
                        <EditableCell
                          field={field.dbField}
                          index={index}
                          key={field.dbField}
                          rows={rows}
                          setRows={setRows}
                        />
                      ))}
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
                {commitPending ? "Committing..." : `Commit ${config.tableTitle}`}
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
  field: string;
  index: number;
  rows: SimpleReferencePreviewRow[];
  setRows: Dispatch<SetStateAction<SimpleReferencePreviewRow[]>>;
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
                  rowStatus:
                    row.rowStatus === "deleted" || row.rowStatus === "rejected"
                      ? row.rowStatus
                      : ("edited" as const),
                  values: {
                    ...row.values,
                    [field]: event.target.value
                  }
                }
              : row
          );
          setRows(nextRows);
        }}
        value={rows[index]?.values[field] ?? ""}
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
