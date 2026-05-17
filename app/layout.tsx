import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

const appName =
  process.env.NEXT_PUBLIC_APP_NAME ?? "Municipal Finance Reporting Hub";

export const metadata: Metadata = {
  title: appName,
  description:
    "Technical foundation for a municipal finance reporting and analysis platform."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
