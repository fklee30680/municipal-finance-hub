import { SimpleReferenceImportPage } from "@/components/simple-reference-import-page";
import { simpleReferenceImportConfigs } from "@/lib/imports/simple-reference-import-config";

export default async function DepartmentsReferenceDataPage({
  searchParams
}: {
  searchParams: Promise<{ add?: string; departmentCode?: string; search?: string }>;
}) {
  const { add = "", departmentCode = "", search = "" } = await searchParams;

  return (
    <SimpleReferenceImportPage
      addDefaults={{ add, code: departmentCode }}
      config={simpleReferenceImportConfigs.departments}
      mode="management"
      search={search}
    />
  );
}
