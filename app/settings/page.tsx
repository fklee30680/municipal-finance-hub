import { AppShell } from "@/components/app-shell";
import { PlaceholderPage } from "@/components/placeholder-page";

export default function SettingsPage() {
  return (
    <AppShell>
      <PlaceholderPage
        title="Settings"
        description="Settings will later contain organization, import template, and reporting configuration. A full role workflow is out of scope for Slice 0."
      />
    </AppShell>
  );
}

