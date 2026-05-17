import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <AppShell>
      <section className="space-y-6">
        <div className="space-y-3">
          <p className="text-sm font-medium text-primary">Foundation</p>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-foreground">
            Municipal Finance Reporting Hub
          </h1>
          <p className="max-w-3xl text-base leading-7 text-muted-foreground">
            Municipal Finance Reporting Hub helps finance teams upload monthly
            financial data, validate imports, analyze trends, review dashboards,
            and generate monthly finance reports.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Reporting layer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                The app is designed to support review, analysis, and reporting
                without replacing the ERP or accounting system of record.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Configurable foundation</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                Future import, parsing, mapping, and validation work should be
                configurable rather than hardcoded to one export layout.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Slice 0 scope</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">
                This slice provides the project shell, docs, environment
                conventions, Supabase helpers, and placeholder routes only.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </AppShell>
  );
}

