import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type MonthlyReportSectionStatus =
  | "blocked"
  | "no_data"
  | "not_built"
  | "ready";

type MonthlyReportSectionProps = {
  actions?: ReactNode;
  calculationRunId?: string | null;
  children?: ReactNode;
  purpose: string;
  sectionId: string;
  sourceNote: string;
  status: MonthlyReportSectionStatus;
  statusDetail?: string;
  title: string;
};

const statusConfig: Record<
  MonthlyReportSectionStatus,
  { className: string; label: string }
> = {
  blocked: {
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    label: "Blocked"
  },
  no_data: {
    className: "border-amber-300 bg-amber-50 text-amber-950",
    label: "No data"
  },
  not_built: {
    className: "border-border bg-muted text-muted-foreground",
    label: "Not built"
  },
  ready: {
    className: "border-emerald-300 bg-emerald-50 text-emerald-950",
    label: "Ready"
  }
};

export function MonthlyReportSection({
  actions,
  calculationRunId,
  children,
  purpose,
  sectionId,
  sourceNote,
  status,
  statusDetail,
  title
}: MonthlyReportSectionProps) {
  const statusView = statusConfig[status];
  const titleId = `${sectionId}-title`;

  return (
    <section aria-labelledby={titleId}>
      <Card className="overflow-hidden">
        <CardHeader className="border-b border-border bg-muted/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle id={titleId}>{title}</CardTitle>
                <span
                  className={cn(
                    "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                    statusView.className
                  )}
                >
                  {statusView.label}
                </span>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">{purpose}</p>
            </div>
            {actions ? <div className="shrink-0">{actions}</div> : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Governed source
              </p>
              <p className="mt-1 leading-5 text-foreground">{sourceNote}</p>
            </div>
            <div className="rounded-md border border-border bg-background p-3">
              <p className="text-xs font-medium uppercase text-muted-foreground">
                Calculation context
              </p>
              <p className="mt-1 leading-5 text-foreground">
                {calculationRunId
                  ? `Selected run ${calculationRunId.slice(0, 8)}`
                  : "No eligible governed calculation run selected"}
              </p>
            </div>
          </div>

          {statusDetail ? (
            <p className="text-sm leading-6 text-muted-foreground">{statusDetail}</p>
          ) : null}

          {children ?? <MonthlyReportSectionEmptyState status={status} />}
        </CardContent>
      </Card>
    </section>
  );
}

function MonthlyReportSectionEmptyState({
  status
}: {
  status: MonthlyReportSectionStatus;
}) {
  const message =
    status === "blocked"
      ? "Select an eligible governed calculation run before preparing this section."
      : status === "no_data"
        ? "No governed output is available for this section for the selected calculation run."
        : "Section framework ready. Content will be added in a later Slice 11 build.";

  return (
    <div className="rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
      {message}
    </div>
  );
}
