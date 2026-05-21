import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ImportWorkflowAction } from "@/lib/imports/workflow-state";

export function ImportStepCard({
  children,
  description,
  step,
  title
}: {
  children: ReactNode;
  description?: string;
  step: number;
  title: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
            {step}
          </span>
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            {description ? (
              <p className="text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function NextActionPanel({
  action
}: {
  action: ImportWorkflowAction;
}) {
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardHeader>
        <CardTitle>Next recommended action</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-base font-semibold text-foreground">
          Step {action.stepNumber}: {action.label}
        </p>
        <p className="text-sm leading-6 text-muted-foreground">
          {action.description}
        </p>
      </CardContent>
    </Card>
  );
}

export function InfoItem({
  label,
  value
}: {
  label: string;
  value: number | string | null | undefined;
}) {
  return (
    <div>
      <p className="font-medium text-foreground">{label}</p>
      <p className="break-words text-muted-foreground">{value ?? "Not available"}</p>
    </div>
  );
}
