import { SimpleReferenceImportPage } from "@/components/simple-reference-import-page";
import { simpleReferenceImportConfigs } from "@/lib/imports/simple-reference-import-config";

export default async function ObjectsReferenceDataPage({
  searchParams
}: {
  searchParams: Promise<{ add?: string; objectCode?: string; search?: string }>;
}) {
  const { add = "", objectCode = "", search = "" } = await searchParams;

  return (
    <SimpleReferenceImportPage
      addDefaults={{ add, code: objectCode }}
      config={simpleReferenceImportConfigs.objects}
      mode="management"
      search={search}
    />
  );
}
