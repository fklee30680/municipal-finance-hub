import { AppShell } from "@/components/app-shell";
import { PlaceholderPage } from "@/components/placeholder-page";

export default function ImportsPage() {
  return (
    <AppShell>
      <PlaceholderPage
        title="Imports"
        description="Configurable import templates, raw file preservation, parsing, and validation will be implemented in later slices."
      />
    </AppShell>
  );
}

