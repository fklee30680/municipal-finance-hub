import { SimpleReferenceImportPage } from "@/components/simple-reference-import-page";
import { simpleReferenceImportConfigs } from "@/lib/imports/simple-reference-import-config";

export default async function FunctionsReferenceDataPage({
  searchParams
}: {
  searchParams: Promise<{ add?: string; functionCode?: string; search?: string }>;
}) {
  const { add = "", functionCode = "", search = "" } = await searchParams;

  return (
    <SimpleReferenceImportPage
      addDefaults={{ add, code: functionCode }}
      config={simpleReferenceImportConfigs.functions}
      mode="management"
      search={search}
    />
  );
}
