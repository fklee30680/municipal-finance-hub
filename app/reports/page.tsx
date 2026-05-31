import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <AppShell>
      <section className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Reports</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Reports
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Report workspaces will be built in focused slices from governed
            calculation output. Exports, snapshots, approval workflow, and final
            report drafting are intentionally not part of this shell.
          </p>
        </div>

        <Card>
          <CardHeader>
            <p className="text-sm font-medium text-primary">Workspace</p>
            <CardTitle>Monthly Report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Review the governed calculation run, readiness status,
              traceability, and placeholder monthly report outline before
              drafting features are added.
            </p>
            <Link
              className="inline-flex rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
              href="/reports/monthly"
            >
              Open Monthly Report
            </Link>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
