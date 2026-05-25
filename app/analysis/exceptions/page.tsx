import { GovernedDashboardPage } from "@/components/governed-dashboard-page";
import type { DashboardSearchParams } from "@/lib/dashboards/governed-dashboard";

export default async function ExceptionsDashboardPage({
  searchParams
}: {
  searchParams: Promise<DashboardSearchParams>;
}) {
  return (
    <GovernedDashboardPage searchParams={await searchParams} view="exceptions" />
  );
}
