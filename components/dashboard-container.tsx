"use client";

import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DashboardContainerProps = {
  action?: ReactNode;
  children: ReactNode;
  defaultExpanded?: boolean;
  description: string;
  metric?: ReactNode;
  status?: string;
  statusTone?: "default" | "warning" | "error" | "success";
  summary?: ReactNode;
  title: string;
};

export function DashboardContainer({
  action,
  children,
  defaultExpanded = false,
  description,
  metric,
  status,
  statusTone = "default",
  summary,
  title
}: DashboardContainerProps) {
  const contentId = useId();
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-4 border-b border-border bg-muted/20">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle>{title}</CardTitle>
              {status ? (
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-semibold",
                    statusTone === "error"
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : statusTone === "warning"
                        ? "border-amber-300 bg-amber-50 text-amber-950"
                        : statusTone === "success"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                          : "border-border bg-card text-muted-foreground"
                  )}
                >
                  {status}
                </span>
              ) : null}
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
            {!expanded && summary ? (
              <div className="rounded-md border border-border bg-card px-3 py-2 text-sm text-muted-foreground">
                {summary}
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {metric ? (
              <div className="rounded-md border border-border bg-card px-3 py-2 text-sm font-medium">
                {metric}
              </div>
            ) : null}
            {action}
            <Button
              aria-controls={contentId}
              aria-expanded={expanded}
              onClick={() => setExpanded((current) => !current)}
              type="button"
              variant="outline"
            >
              {expanded ? "Collapse" : "Expand"}
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded ? (
        <CardContent className="pt-6" id={contentId}>
          {children}
        </CardContent>
      ) : null}
    </Card>
  );
}
