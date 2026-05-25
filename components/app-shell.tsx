import Link from "next/link";
import type { ReactNode } from "react";
import {
  BarChart3,
  Calculator,
  Database,
  FileText,
  Home,
  Settings,
  Upload
} from "lucide-react";

import { cn } from "@/lib/utils";

const navigation = [
  { href: "/", label: "Home", icon: Home },
  { href: "/imports", label: "Imports", icon: Upload },
  { href: "/reference-data", label: "Reference Data", icon: Database },
  { href: "/analysis/calculation-runs", label: "Analysis", icon: Calculator },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings }
];

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">
              Municipal Finance Reporting Hub
            </p>
            <p className="text-sm text-muted-foreground">
              Reporting and analysis foundation
            </p>
          </div>
          <nav className="flex flex-wrap gap-2" aria-label="Primary navigation">
            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <Link
                  className={cn(
                    "inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground",
                    "hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring"
                  )}
                  href={item.href}
                  key={item.href}
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
