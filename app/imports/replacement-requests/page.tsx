import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ReplacementRequestDecisionActions } from "@/components/trial-balance-posting-actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type ReplacementRequestRow = {
  inactivation_request_id: string;
  existing_import_batch_id: string | null;
  replacement_import_batch_id: string | null;
  request_reason: string;
  request_status: string;
  approval_status: string | null;
  requested_by: string | null;
  requested_at: string;
  approval_reason: string | null;
  approved_at: string | null;
  rejected_at: string | null;
};

export default async function ReplacementRequestsPage() {
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);

  const requestsResult = await adminClient
    .from("inactivation_requests")
    .select(
      "inactivation_request_id, existing_import_batch_id, replacement_import_batch_id, request_reason, request_status, approval_status, requested_by, requested_at, approval_reason, approved_at, rejected_at"
    )
    .eq("organization_id", appUser.organization_id)
    .eq("requested_action", "replacement")
    .order("requested_at", { ascending: false })
    .limit(50)
    .returns<ReplacementRequestRow[]>();
  const requests = requestsResult.data ?? [];

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Replacement Requests
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Review replacement requests for period conflicts. Approval
              supersedes the old active import and posts the replacement import
              without deleting source files or history.
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
              Approving a replacement is deliberate. It marks prior active rows
              inactive or superseded, posts the approved replacement, and keeps
              the old import visible through review filters.
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
                Replacement requests could not be loaded: {requestsResult.error.message}
              </p>
            ) : null}
            {!requestsResult.error && requests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No replacement requests have been created yet.
              </p>
            ) : null}
            {requests.map((request) => {
              const status = request.approval_status ?? request.request_status;
              const pending = ["requested", "approved"].includes(status);
              return (
                <div
                  className="space-y-4 rounded-md border border-border p-4"
                  key={request.inactivation_request_id}
                >
                  <div className="grid gap-4 text-sm md:grid-cols-3">
                    <InfoItem label="Request" value={request.inactivation_request_id} />
                    <InfoItem label="Status" value={status} />
                    <InfoItem label="Requested at" value={formatDate(request.requested_at)} />
                    <InfoItem
                      label="Existing active import"
                      value={request.existing_import_batch_id}
                    />
                    <InfoItem
                      label="Replacement import"
                      value={request.replacement_import_batch_id}
                    />
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
                    {request.existing_import_batch_id ? (
                      <Link
                        className="font-medium text-primary hover:underline"
                        href={`/imports/${request.existing_import_batch_id}/review`}
                      >
                        Review Existing Import
                      </Link>
                    ) : null}
                    {request.replacement_import_batch_id ? (
                      <Link
                        className="font-medium text-primary hover:underline"
                        href={`/imports/${request.replacement_import_batch_id}/review`}
                      >
                        Review Replacement Import
                      </Link>
                    ) : null}
                  </div>
                  {pending ? (
                    <ReplacementRequestDecisionActions
                      replacementRequestId={request.inactivation_request_id}
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
