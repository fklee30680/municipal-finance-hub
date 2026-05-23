import { SimpleReferenceImportPage } from "@/components/simple-reference-import-page";
import { simpleReferenceImportConfigs } from "@/lib/imports/simple-reference-import-config";

export default async function DepartmentsImportPage({
  searchParams
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { search = "" } = await searchParams;

  return (
    <SimpleReferenceImportPage
      config={simpleReferenceImportConfigs.departments}
      search={search}
    />
  );
}
