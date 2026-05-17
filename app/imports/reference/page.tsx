import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { referenceImportConfigs } from "@/lib/imports/reference-imports";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ReferenceImportsPage() {
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);

  const cards = await Promise.all(
    referenceImportConfigs.map(async (config) => {
      const importType = await adminClient
        .from("import_types")
        .select("import_type_id")
        .eq("organization_id", appUser.organization_id)
        .eq("import_type_code", config.importTypeCode)
        .maybeSingle<{ import_type_id: string }>();
      const latestBatch = importType.data
        ? await adminClient
            .from("import_batches")
            .select("batch_status, created_at")
            .eq("organization_id", appUser.organization_id)
            .eq("import_type_id", importType.data.import_type_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle<{ batch_status: string; created_at: string }>()
        : null;
      const activeCount = await loadActiveReferenceCount({
        adminClient,
        organizationId: appUser.organization_id,
        targetTable: config.targetTable
      });

      return {
        ...config,
        activeCount,
        latestBatch: latestBatch?.data ?? null
      };
    })
  );

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Reference Imports
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Import and maintain reference data one list at a time. Each lane
              uploads one file, uses one template, previews bad rows, and commits
              accepted mappings only after review.
            </p>
          </div>
          <Link
            className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            href="/imports"
          >
            Back to Imports
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => (
            <Card key={card.importTypeCode}>
              <CardHeader>
                <CardTitle>{card.pluralName}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <p className="text-sm leading-6 text-muted-foreground">
                  {card.description}
                </p>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="font-medium text-foreground">Active rows</dt>
                    <dd className="text-muted-foreground">{card.activeCount}</dd>
                  </div>
                  <div>
                    <dt className="font-medium text-foreground">Last import</dt>
                    <dd className="text-muted-foreground">
                      {card.latestBatch
                        ? `${card.latestBatch.batch_status} on ${formatDate(card.latestBatch.created_at)}`
                        : "No import yet"}
                    </dd>
                  </div>
                </dl>
                <Link
                  className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
                  href={`/imports/reference/${card.routeSegment}`}
                >
                  Open {card.name}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </AppShell>
  );
}

async function loadActiveReferenceCount({
  adminClient,
  organizationId,
  targetTable
}: {
  adminClient: ReturnType<typeof createAdminClient>;
  organizationId: string;
  targetTable: (typeof referenceImportConfigs)[number]["targetTable"];
}) {
  const result = await adminClient
    .from(targetTable)
    .select("*", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("active_status", "active");

  return result.count ?? 0;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium"
  }).format(new Date(value));
}
