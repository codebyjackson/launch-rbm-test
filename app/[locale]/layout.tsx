import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { LOCALES, isLocale } from "@/lib/locales";
import "@/styles/launch-dashboard.css";

// The example app's root layout. RBM's own layout replaces it. The dashboard's
// CSS applies only inside the .launch-dashboard element, as it will inside
// RBM's page.
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html lang={locale}>
      <body>
        <div className="launch-dashboard">{children}</div>
      </body>
    </html>
  );
}
