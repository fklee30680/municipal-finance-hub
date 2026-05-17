import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type TemplateRow = {
  import_template_id: string;
  template_name: string;
  template_description: string | null;
  active_status: string;
  import_type_id: string;
  import_types:
    | {
        import_type_name: string;
      }
    | Array<{
        import_type_name: string;
      }>
    | null;
};

type VersionRow = {
  template_version_id: string;
  version_number: number;
  version_status: string;
  file_type: string | null;
  created_at: string;
};

export default async function ImportTemplateDetailPage({
  params
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);

  const templateResult = await adminClient
    .from("import_templates")
    .select(
      `
      import_template_id,
      template_name,
      template_description,
      active_status,
      import_type_id,
      import_types (
        import_type_name
      )
    `
    )
    .eq("organization_id", appUser.organization_id)
    .eq("import_template_id", templateId)
    .maybeSingle<TemplateRow>();

  if (templateResult.error || !templateResult.data) {
    notFound();
  }

  const versionsResult = await adminClient
    .from("import_template_versions")
    .select("template_version_id, version_number, version_status, file_type, created_at")
    .eq("organization_id", appUser.organization_id)
    .eq("import_template_id", templateId)
    .order("version_number", { ascending: false })
    .returns<VersionRow[]>();

  const template = templateResult.data;
  const importType = getRelatedRecord(template.import_types);

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Import Templates</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {template.template_name}
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              {template.template_description ??
                "Template configuration and version history."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              className="inline-flex items-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
              href="/imports/templates"
            >
              Back
            </Link>
            <Link
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
              href={`/imports/templates/${template.import_template_id}/edit`}
            >
              Create New Template Version
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Template details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-3">
            <div>
              <p className="font-medium text-foreground">Import type</p>
              <p className="text-muted-foreground">
                {importType?.import_type_name ?? "Unknown"}
              </p>
            </div>
            <div>
              <p className="font-medium text-foreground">Active status</p>
              <p className="text-muted-foreground">{template.active_status}</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Versions</p>
              <p className="text-muted-foreground">
                {versionsResult.data?.length ?? 0}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Version history</CardTitle>
          </CardHeader>
          <CardContent>
            {versionsResult.data && versionsResult.data.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Version</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                      <th className="py-3 pr-4 font-medium">File type</th>
                      <th className="py-3 font-medium">Created at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versionsResult.data.map((version) => (
                      <tr
                        className="border-b border-border"
                        key={version.template_version_id}
                      >
                        <td className="py-3 pr-4 text-muted-foreground">
                          {version.version_number}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {version.version_status}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground">
                          {version.file_type ?? "Not set"}
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {formatDate(version.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No versions have been saved yet.
              </p>
            )}
          </CardContent>
        </Card>
      </section>
    </AppShell>
  );
}

function getRelatedRecord<T>(value: T | T[] | null) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
