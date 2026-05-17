import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const organizationSetup = [
  { label: "Organization name", value: "Default Municipal Organization" }
];

const fiscalYearSetup = [
  { label: "Current fiscal year", value: "Not configured" },
  { label: "Fiscal year start date", value: "Not configured" },
  { label: "Fiscal year end date", value: "Not configured" },
  { label: "Standard period count", value: "12" }
];

const reportingPeriodOptions = [
  { label: "Period 0 enabled", value: "No" },
  { label: "Period 13 enabled", value: "No" },
  { label: "Accrual reporting enabled", value: "No" },
  { label: "Default report period mode", value: "standard" }
];

export default function SetupPage() {
  return (
    <AppShell>
      <section className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Settings</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Setup Configuration
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Setup editing will be implemented in a later slice. These values are
            currently seeded configuration values.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <SetupCard title="Organization Setup" rows={organizationSetup} />
          <SetupCard title="Fiscal Year Setup" rows={fiscalYearSetup} />
          <SetupCard
            title="Reporting Period Options"
            rows={reportingPeriodOptions}
          />
        </div>
      </section>
    </AppShell>
  );
}

function SetupCard({
  title,
  rows
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-4">
          {rows.map((row) => (
            <div className="space-y-1" key={row.label}>
              <dt className="text-sm font-medium text-foreground">
                {row.label}
              </dt>
              <dd className="text-sm text-muted-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}
