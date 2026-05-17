import { AppShell } from "@/components/app-shell";
import { PlaceholderPage } from "@/components/placeholder-page";

export default function DashboardPage() {
  return (
    <AppShell>
      <PlaceholderPage
        title="Dashboard"
        description="Dashboard views will be implemented after imported financial data, normalized storage, and analysis outputs exist."
      />
    </AppShell>
  );
}

