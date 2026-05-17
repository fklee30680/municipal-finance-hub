import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function SettingsPage() {
  return (
    <AppShell>
      <section className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">Settings</p>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
            Settings will later contain organization, import template, and
            reporting configuration. A full role workflow is out of scope for
            the current foundation.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Setup Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Review the seeded organization and fiscal calendar configuration
              model that later slices will make editable.
            </p>
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/settings/setup"
            >
              Open setup configuration
            </Link>
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
