"use client";

import { Pencil, X } from "lucide-react";
import {
  type Ref,
  useActionState,
  useEffect,
  useId,
  useRef
} from "react";
import { useRouter } from "next/navigation";

import {
  updateSimpleReferenceManualAction,
  type SimpleReferenceManualUpdateState
} from "@/app/imports/reference-actions";
import { Button } from "@/components/ui/button";
import type { SimpleReferenceImportConfig } from "@/lib/imports/simple-reference-import-config";

type ReferenceRow = Record<string, string | number | null>;

const initialState: SimpleReferenceManualUpdateState = {
  message: null,
  status: "idle"
};

export function SimpleReferenceManualUpdateForm({
  config,
  row
}: {
  config: SimpleReferenceImportConfig;
  row: ReferenceRow;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const firstFieldRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  const router = useRouter();
  const titleId = useId();
  const [state, formAction, pending] = useActionState(
    updateSimpleReferenceManualAction,
    initialState
  );

  useEffect(() => {
    if (state.status === "success") {
      dialogRef.current?.close();
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <>
      <button
        className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
        onClick={() => {
          dialogRef.current?.showModal();
          window.requestAnimationFrame(() => firstFieldRef.current?.focus());
        }}
        type="button"
      >
        <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
        Edit
      </button>

      <dialog
        aria-labelledby={titleId}
        className="w-[min(720px,calc(100vw-32px))] rounded-md border border-border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
        ref={dialogRef}
      >
        <form method="dialog">
          <button
            aria-label={`Close ${config.tableTitle} editor`}
            className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            type="submit"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </form>

        <div className="border-b border-border px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-wide text-primary">
            Manual {config.tableTitle} Update
          </p>
          <h3 className="mt-1 text-xl font-semibold text-foreground" id={titleId}>
            {String(row[config.codeField] ?? "")}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {config.manualEditHelpText}
          </p>
        </div>

        <form action={formAction} className="space-y-5 px-6 py-5">
          <input name="route" type="hidden" value={config.route} />
          <input name="rowId" type="hidden" value={String(row[config.idField] ?? "")} />

          <div className="grid gap-4 md:grid-cols-2">
            {config.manualEditableFields.map((field, index) => (
              <EditableField
                defaultValue={row[field.dbField]}
                field={field}
                inputRef={index === 0 ? firstFieldRef : undefined}
                key={field.dbField}
              />
            ))}
          </div>

          <div className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
            Code and name remain controlled by the import workflow. Manual edits
            here update setup/classification fields only.
          </div>

          {state.message ? (
            <p
              className={
                state.status === "error"
                  ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                  : "rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
              }
            >
              {state.message}
            </p>
          ) : null}

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              onClick={() => dialogRef.current?.close()}
              type="button"
            >
              Cancel
            </button>
            <Button disabled={pending} type="submit">
              {pending ? "Saving..." : "Save and Close"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

function EditableField({
  defaultValue,
  field,
  inputRef
}: {
  defaultValue: unknown;
  field: SimpleReferenceImportConfig["manualEditableFields"][number];
  inputRef?: Ref<HTMLInputElement | HTMLSelectElement>;
}) {
  const stringValue =
    defaultValue === null || defaultValue === undefined ? "" : String(defaultValue);
  const commonClass =
    "flex h-10 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  if (field.inputType === "select") {
    const options = getSelectOptions({
      currentValue: stringValue,
      options: field.options ?? []
    });

    return (
      <label className="space-y-2 text-sm font-medium text-foreground">
        {field.label}
        <select
          className={commonClass}
          defaultValue={stringValue}
          name={field.formKey}
          ref={inputRef as Ref<HTMLSelectElement>}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.inputType === "textarea") {
    return (
      <label className="space-y-2 text-sm font-medium text-foreground md:col-span-2">
        {field.label}
        <textarea
          className="min-h-20 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          defaultValue={stringValue}
          name={field.formKey}
        />
      </label>
    );
  }

  return (
    <label className="space-y-2 text-sm font-medium text-foreground">
      {field.label}
      <input
        className={commonClass}
        defaultValue={stringValue}
        name={field.formKey}
        ref={inputRef as Ref<HTMLInputElement>}
        type={field.inputType === "date" ? "date" : "text"}
      />
    </label>
  );
}

function getSelectOptions({
  currentValue,
  options
}: {
  currentValue: string;
  options: Array<{ label: string; value: string }>;
}) {
  if (!currentValue || options.some((option) => option.value === currentValue)) {
    return options;
  }

  return [
    {
      label: `Current: ${currentValue}`,
      value: currentValue
    },
    ...options
  ];
}
