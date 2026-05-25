import { SimpleReferenceImportPage } from "@/components/simple-reference-import-page";
import { simpleReferenceImportConfigs } from "@/lib/imports/simple-reference-import-config";

export default async function AcfrReferenceDataPage({
  searchParams
}: {
  searchParams: Promise<{ acfrCode?: string; add?: string; search?: string }>;
}) {
  const { acfrCode = "", add = "", search = "" } = await searchParams;

  return (
    <SimpleReferenceImportPage
      addDefaults={{ add, code: acfrCode }}
      config={simpleReferenceImportConfigs.acfr}
      mode="management"
      search={search}
    />
  );
}
