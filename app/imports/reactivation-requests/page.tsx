import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ReactivationRequestDecisionActions } from "@/components/trial-balance-posting-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type ReactivationRequestRow = {
  reactivation_request_id: string;
  entity_id: string | null;
  target_entity_id: string;
  request_reason: string;
  request_status: string;
  approval_status: string | null;
  conflict_status: string | null;
  requested_by: string | null;
  requested_at: string;
  approval_reason: string | null;
  approved_at: string | null;
  rejected_at: string | null;
};

export default async function ReactivationRequestsPage() {
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);

  const requestsResult = await adminClient
    .from("reactivation_requests")
    .select(
      "reactivation_request_id, entity_id, target_entity_id, request_reason, request_status, approval_status, conflict_status, requested_by, requested_at, approval_reason, approved_at, rejected_at"
    )
    .eq("organization_id", appUser.organization_id)
    .order("requested_at", { ascending: false })
    .limit(50)
    .returns<ReactivationRequestRow[]>();
  const requests = requestsResult.data ?? [];

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Reactivation Requests
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Review requests to reactivate inactive or superseded imports.
              Approval requires a conflict check so the app does not silently
              create multiple active imports for the same period.
            </p>
          </div>
          <Link
            className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
            href="/imports"
          >
            Back to Imports
          </Link>
        </div>

        <Card className="border-border bg-muted">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-foreground">
              Reactivation never deletes replacement history. If an active
              import already exists for the same fiscal year and period, the
              request is blocked or rejected instead of creating an active-data
              conflict.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {requestsResult.error ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Reactivation requests could not be loaded: {requestsResult.error.message}
              </p>
            ) : null}
            {!requestsResult.error && requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No reactivation requests have been created yet.
              </p>
            ) : null}
            {requests.map((request) => {
              const status = request.approval_status ?? request.request_status;
              const importBatchId = request.entity_id ?? request.target_entity_id;
              const pending = status === "requested";
              return (
                <div
                  className="space-y-4 rounded-md border border-border p-4"
                  key={request.reactivation_request_id}
                >
                  <div className="grid gap-4 text-sm md:grid-cols-3">
                    <InfoItem label="Request" value={request.reactivation_request_id} />
                    <InfoItem label="Import batch" value={importBatchId} />
                    <InfoItem label="Status" value={status} />
                    <InfoItem label="Conflict status" value={request.conflict_status} />
                    <InfoItem label="Requested at" value={formatDate(request.requested_at)} />
                    <InfoItem label="Requested by" value={request.requested_by} />
                    <InfoItem label="Reason" value={request.request_reason} />
                    <InfoItem label="Review note" value={request.approval_reason} />
                    <InfoItem
                      label="Reviewed at"
                      value={
                        request.approved_at
                          ? formatDate(request.approved_at)
                          : request.rejected_at
                            ? formatDate(request.rejected_at)
                            : "Not reviewed"
                      }
                    />
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    <Link
                      className="font-medium text-primary hover:underline"
                      href={`/imports/${importBatchId}/review`}
                    >
                      Review Import
                    </Link>
                  </div>
                  {pending ? (
                    <ReactivationRequestDecisionActions
                      reactivationRequestId={request.reactivation_request_id}
                    />
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function InfoItem({
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
