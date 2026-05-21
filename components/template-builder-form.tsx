"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getTargetFields } from "@/lib/templates/target-fields";
import {
  formatTransformationLabel,
  transformationOptions
} from "@/lib/templates/transformations";
import {
  initialTemplateSaveState,
  type TemplateSaveState
} from "@/lib/templates/template-state";
import type { SourceFilePreview } from "@/lib/templates/file-inspection";

type ImportTypeOption = {
  import_type_id: string;
  import_type_code: string;
  import_type_name: string;
};

type SourceFileOption = {
  source_file_id: string;
  original_file_name: string;
  uploaded_at: string;
};

type AccountStructureOption = {
  account_structure_id: string;
  structure_name: string;
  version_number: number;
};

const MANUAL_MAPPING_ROW_COUNT = 4;

export function TemplateBuilderForm({
  accountStructures,
  action,
  defaultImportTypeId,
  defaultTemplateDescription,
  defaultTemplateName,
  importTypes,
  mode,
  preview,
  sourceFiles,
  templateId
}: {
  accountStructures: AccountStructureOption[];
  action: (
    previousState: TemplateSaveState,
    formData: FormData
  ) => Promise<TemplateSaveState>;
  defaultImportTypeId?: string;
  defaultTemplateDescription?: string;
  defaultTemplateName?: string;
  importTypes: ImportTypeOption[];
  mode: "create" | "edit";
  preview: SourceFilePreview | null;
  sourceFiles: SourceFileOption[];
  templateId?: string;
}) {
  const [state, formAction, isPending] = useActionState(
    action,
    initialTemplateSaveState
  );
  const [selectedImportTypeId, setSelectedImportTypeId] = useState(
    defaultImportTypeId ?? ""
  );
  const selectedImportType =
    importTypes.find((importType) => importType.import_type_id === selectedImportTypeId) ??
    null;
  const targetFields = selectedImportType
    ? getTargetFields(selectedImportType.import_type_code)
    : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Sample source file</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]" method="get">
            <input
              name="importTypeCode"
              type="hidden"
              value={selectedImportType?.import_type_code ?? ""}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="sourceFileId">
                Sample source file/import batch
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={preview?.sourceFileId ?? ""}
                id="sourceFileId"
                name="sourceFileId"
                required
              >
                <option value="">Select uploaded source file</option>
                {sourceFiles.map((sourceFile) => (
                  <option
                    key={sourceFile.source_file_id}
                    value={sourceFile.source_file_id}
                  >
                    {sourceFile.original_file_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <Button type="submit" variant="outline">
                Load sample preview
              </Button>
            </div>
          </form>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Only a limited sample of rows is shown for layout configuration.
          </p>
        </CardContent>
      </Card>

      <form action={formAction} className="space-y-6">
        <input name="templateId" type="hidden" value={templateId ?? ""} />
        <input name="sourceFileId" type="hidden" value={preview?.sourceFileId ?? ""} />
        <input name="fileType" type="hidden" value={preview?.fileType ?? ""} />
        <input name="sheetCount" type="hidden" value={preview?.sheets.length ?? 0} />

        <Card>
          <CardHeader>
            <CardTitle>
              {mode === "create"
                ? "Create Import Template"
                : "Create New Template Version"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm leading-6 text-muted-foreground">
              Templates tell the system how to read a source file. This step
              does not validate, post, or activate financial data.
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Editing a template creates a new version. Prior versions are
              retained for auditability.
            </p>
            <p className="text-sm leading-6 text-muted-foreground">
              Mapping templates use one import type and one active selected
              sheet. Object, ACFR, Department, Function, and Fund imports are
              separate mapping imports.
            </p>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="templateName">
                  Template name
                </label>
                <Input
                  defaultValue={defaultTemplateName}
                  disabled={mode === "edit"}
                  id="templateName"
                  name="templateName"
                  required={mode === "create"}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="importTypeId">
                  Import type
                </label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={mode === "edit"}
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
                {mode === "edit" ? (
                  <input
                    name="importTypeId"
                    type="hidden"
                    value={defaultImportTypeId ?? ""}
                  />
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="templateDescription"
              >
                Description
              </label>
              <textarea
                className="min-h-24 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                defaultValue={defaultTemplateDescription}
                disabled={mode === "edit"}
                id="templateDescription"
                name="templateDescription"
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium"
                htmlFor="accountStructureId"
              >
                Account structure, when applicable
              </label>
              <select
                className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                id="accountStructureId"
                name="accountStructureId"
              >
                <option value="">Not required for this template</option>
                {accountStructures.map((structure) => (
                  <option
                    key={structure.account_structure_id}
                    value={structure.account_structure_id}
                  >
                    {structure.structure_name} v{structure.version_number}
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {preview ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Detected file layout</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  File type: {preview.fileType.toUpperCase()} · Source file:{" "}
                  {preview.originalFileName}
                </p>
                {preview.warning ? (
                  <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                    {preview.warning}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            {preview.sheets.map((sheet, sheetIndex) => (
              <Card key={`${sheet.sheetName}-${sheet.sheetIndex}`}>
                <CardHeader>
                  <CardTitle>{sheet.sheetName}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  <input
                    name={`sheet_${sheetIndex}_name`}
                    type="hidden"
                    value={sheet.sheetName}
                  />
                  <input
                    name={`sheet_${sheetIndex}_index`}
                    type="hidden"
                    value={sheet.sheetIndex}
                  />
                  <input
                    name={`sheet_${sheetIndex}_columnCount`}
                    type="hidden"
                    value={sheet.columns.length}
                  />
                  <input
                    name={`sheet_${sheetIndex}_manualCount`}
                    type="hidden"
                    value={MANUAL_MAPPING_ROW_COUNT}
                  />

                  <label className="flex items-center gap-2 text-sm">
                    <input name={`sheet_${sheetIndex}_ignore`} type="checkbox" />
                    Ignore sheet
                  </label>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label
                        className="text-sm font-medium"
                        htmlFor={`sheet_${sheetIndex}_headerRow`}
                      >
                        Header row
                      </label>
                      <Input
                        defaultValue={sheet.headerRow}
                        id={`sheet_${sheetIndex}_headerRow`}
                        min={1}
                        name={`sheet_${sheetIndex}_headerRow`}
                        required
                        type="number"
                      />
                    </div>
                    <div className="space-y-2">
                      <label
                        className="text-sm font-medium"
                        htmlFor={`sheet_${sheetIndex}_dataStartRow`}
                      >
                        Data start row
                      </label>
                      <Input
                        defaultValue={sheet.dataStartRow}
                        id={`sheet_${sheetIndex}_dataStartRow`}
                        min={1}
                        name={`sheet_${sheetIndex}_dataStartRow`}
                        required
                        type="number"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-border text-muted-foreground">
                          <th className="py-3 pr-4 font-medium">Detected header</th>
                          <th className="py-3 pr-4 font-medium">Letter</th>
                          <th className="py-3 pr-4 font-medium">Index</th>
                          <th className="py-3 pr-4 font-medium">Sample values</th>
                          <th className="py-3 pr-4 font-medium">Target field</th>
                          <th className="py-3 font-medium">Default value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.columns.map((column) => {
                          const matchedField = targetFields.find(
                            (field) =>
                              normalizeName(field.name) === normalizeName(column.name)
                          );
                          const columnLetter = columnIndexToLetter(column.index);

                          return (
                            <tr
                              className="border-b border-border align-top"
                              key={`${sheet.sheetIndex}-${column.index}`}
                            >
                              <td className="py-3 pr-4 font-medium text-foreground">
                                <input
                                  name={`sheet_${sheetIndex}_column_${column.index}_name`}
                                  type="hidden"
                                  value={column.name}
                                />
                                {column.name}
                              </td>
                              <td className="py-3 pr-4 text-muted-foreground">
                                {columnLetter}
                              </td>
                              <td className="py-3 pr-4 text-muted-foreground">
                                <input
                                  name={`sheet_${sheetIndex}_column_${column.index}_index`}
                                  type="hidden"
                                  value={column.index}
                                />
                                {column.index + 1}
                              </td>
                              <td className="py-3 pr-4 text-muted-foreground">
                                {column.sampleValues.join(", ") || "No sample"}
                              </td>
                              <td className="py-3 pr-4">
                                <select
                                  className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                  defaultValue={matchedField?.name ?? ""}
                                  name={`sheet_${sheetIndex}_column_${column.index}_target`}
                                >
                                  <option value="">Ignore column</option>
                                  {targetFields.map((field) => (
                                    <option key={field.name} value={field.name}>
                                      {field.label}
                                      {field.required ? " (required)" : ""}
                                    </option>
                                  ))}
                                </select>
                                {matchedField?.required ? (
                                  <input
                                    name={`sheet_${sheetIndex}_column_${column.index}_required`}
                                    type="hidden"
                                    value="true"
                                  />
                                ) : null}
                              </td>
                              <td className="py-3">
                                <Input
                                  name={`sheet_${sheetIndex}_column_${column.index}_default`}
                                  placeholder="Optional"
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-3 rounded-md border border-border bg-muted p-4">
                    <div>
                      <h3 className="text-sm font-medium text-foreground">
                        Manual column overrides
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        If a source column is not detected cleanly, enter a
                        header name, column letter, or column number and map it
                        to a target field. Leave unused rows blank.
                      </p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-border text-muted-foreground">
                            <th className="py-3 pr-4 font-medium">Header name</th>
                            <th className="py-3 pr-4 font-medium">Column letter</th>
                            <th className="py-3 pr-4 font-medium">Column number</th>
                            <th className="py-3 pr-4 font-medium">Target field</th>
                            <th className="py-3 font-medium">Default value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Array.from(
                            { length: MANUAL_MAPPING_ROW_COUNT },
                            (_, manualIndex) => (
                              <tr
                                className="border-b border-border align-top last:border-0"
                                key={`${sheet.sheetIndex}-manual-${manualIndex}`}
                              >
                                <td className="py-3 pr-4">
                                  <Input
                                    name={`sheet_${sheetIndex}_manual_${manualIndex}_name`}
                                    placeholder="Header name"
                                  />
                                </td>
                                <td className="py-3 pr-4">
                                  <Input
                                    name={`sheet_${sheetIndex}_manual_${manualIndex}_letter`}
                                    placeholder="A"
                                  />
                                </td>
                                <td className="py-3 pr-4">
                                  <Input
                                    min={1}
                                    name={`sheet_${sheetIndex}_manual_${manualIndex}_number`}
                                    placeholder="1"
                                    type="number"
                                  />
                                </td>
                                <td className="py-3 pr-4">
                                  <select
                                    className="flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    name={`sheet_${sheetIndex}_manual_${manualIndex}_target`}
                                  >
                                    <option value="">Ignore manual entry</option>
                                    {targetFields.map((field) => (
                                      <option key={field.name} value={field.name}>
                                        {field.label}
                                        {field.required ? " (required)" : ""}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-3">
                                  <Input
                                    name={`sheet_${sheetIndex}_manual_${manualIndex}_default`}
                                    placeholder="Optional"
                                  />
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card>
              <CardHeader>
                <CardTitle>Transformation configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {transformationOptions.map((option) => (
                    <label className="flex items-center gap-2 text-sm" key={option}>
                      <input
                        defaultChecked={[
                          "trim_whitespace",
                          "preserve_leading_zeros",
                          "remove_blank_rows"
                        ].includes(option)}
                        name="transformationRules"
                        type="checkbox"
                        value={option}
                      />
                      {formatTransformationLabel(option)}
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex items-center gap-3">
              <Button disabled={isPending} type="submit">
                {isPending ? "Saving..." : "Save template version"}
              </Button>
              {state.message ? (
                <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {state.message}
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">
                Select a sample source file and load a preview before saving a
                template.
              </p>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}

function normalizeName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function columnIndexToLetter(index: number) {
  let value = index + 1;
  let letter = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    value = Math.floor((value - 1) / 26);
  }

  return letter;
}
