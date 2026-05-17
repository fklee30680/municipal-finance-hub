import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ensureAppUserForAuthUser } from "@/lib/auth/app-user";
import { requireUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";

type TemplateRow = {
  import_template_id: string;
  template_name: string;
  active_status: string;
  updated_at: string;
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
  import_template_id: string;
  version_number: number;
  file_type: string | null;
  updated_at: string;
};

export default async function ImportTemplatesPage() {
  const authUser = await requireUser();
  const adminClient = createAdminClient();
  const appUser = await ensureAppUserForAuthUser(adminClient, authUser);

  const templatesResult = await adminClient
    .from("import_templates")
    .select(
      `
      import_template_id,
      template_name,
      active_status,
      updated_at,
      import_types (
        import_type_name
      )
    `
    )
    .eq("organization_id", appUser.organization_id)
    .order("updated_at", { ascending: false })
    .returns<TemplateRow[]>();

  const versionsResult = await adminClient
    .from("import_template_versions")
    .select("import_template_id, version_number, file_type, updated_at")
    .eq("organization_id", appUser.organization_id)
    .order("version_number", { ascending: false })
    .returns<VersionRow[]>();

  const latestVersions = new Map<string, VersionRow>();
  for (const version of versionsResult.data ?? []) {
    if (!latestVersions.has(version.import_template_id)) {
      latestVersions.set(version.import_template_id, version);
    }
  }

  const templates = templatesResult.data ?? [];

  return (
    <AppShell>
      <section className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-primary">Imports</p>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              Import Templates
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Templates define reusable file layout instructions. They do not
              validate, post, or activate financial data.
            </p>
          </div>
          <Link
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-ring"
            href="/imports/templates/new"
          >
            New Template
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Template list</CardTitle>
          </CardHeader>
          <CardContent>
            {templatesResult.error || versionsResult.error ? (
              <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                Templates could not be loaded:{" "}
                {templatesResult.error?.message ?? versionsResult.error?.message}
              </p>
            ) : null}

            {!templatesResult.error && templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No import templates have been created yet.
              </p>
            ) : null}

            {templates.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="py-3 pr-4 font-medium">Template name</th>
                      <th className="py-3 pr-4 font-medium">Import type</th>
                      <th className="py-3 pr-4 font-medium">Latest version</th>
                      <th className="py-3 pr-4 font-medium">File type</th>
                      <th className="py-3 pr-4 font-medium">Active status</th>
                      <th className="py-3 pr-4 font-medium">Updated at</th>
                      <th className="py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((template) => {
                      const latestVersion = latestVersions.get(
                        template.import_template_id
                      );
                      const importType = getRelatedRecord(template.import_types);

                      return (
                        <tr
                          className="border-b border-border align-top"
                          key={template.import_template_id}
                        >
                          <td className="py-3 pr-4 font-medium text-foreground">
                            {template.template_name}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {importType?.import_type_name ?? "Unknown"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {latestVersion?.version_number ?? "None"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {latestVersion?.file_type ?? "Not set"}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {template.active_status}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {formatDate(latestVersion?.updated_at ?? template.updated_at)}
                          </td>
                          <td className="py-3">
                            <Link
                              className="text-sm font-medium text-primary hover:underline"
                              href={`/imports/templates/${template.import_template_id}`}
                            >
                              View
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
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
