import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";

const referenceSections = [
  {
    description:
      "Maintain fund classifications, reporting treatment, major fund flags, and cash/reconciliation inclusion.",
    href: "/reference-data/funds",
    title: "Funds"
  },
  {
    description:
      "Maintain object/account classifications used for validation, mapping coverage, statements, trends, and dashboards.",
    href: "/reference-data/objects",
    title: "Objects"
  },
  {
    description:
      "Maintain ACFR mappings and descriptions used by statement rollups and mapping coverage.",
    href: "/reference-data/acfr",
    title: "ACFR"
  },
  {
    description:
      "Maintain department groups and active status for organization-level analysis dimensions.",
    href: "/reference-data/departments",
    title: "Departments"
  },
  {
    description:
      "Maintain function groups and descriptions used for functional reporting and analysis dimensions.",
    href: "/reference-data/functions",
    title: "Functions"
  }
];

export default function ReferenceDataHubPage() {
  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Reference Data</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Reference Data
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Maintain reference/master data used by trial balance validation,
              analysis, mapping coverage, dashboards, and reports. Use imports
              for bulk updates; use manual maintenance for one-row fixes and
              setup changes.
            </p>
          </div>
          <Link
            className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            href="/imports/reference"
          >
            Bulk Reference Imports
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {referenceSections.map((section) => (
            <Card key={section.href}>
              <CardContent className="space-y-4 pt-6">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">
                    {section.title}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {section.description}
                  </p>
                </div>
                <Link
                  className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring"
                  href={section.href}
                >
                  Manage {section.title}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="bg-muted">
          <CardContent className="pt-6 text-sm leading-6 text-muted-foreground">
            Trial balance data cannot be edited in Reference Data. Fix trial
            balance source data through the upload, preview, validation,
            posting, replacement, and reactivation workflows.
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}
