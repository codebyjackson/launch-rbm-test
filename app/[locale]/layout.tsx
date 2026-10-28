import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { LOCALES, isLocale } from "@/lib/locales";
import "@/styles/launch-dashboard.css";

// The example app's root layout. RBM's own layout replaces it. The dashboard's
// CSS applies only inside the .launch-dashboard element, as it will inside
// RBM's page. That element is rendered by the components themselves
// (components/frame/DashboardFrame.tsx), not here: it carries state (the
// sub-open class), and RBM takes the components, not this layout.
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
  // margin 0: the static page's body rule did this, but fenced it now lands on
  // .launch-dashboard, and the browser's 8px default narrowed the example by
  // 16px (more wrapped lines: +139px on /en at 390px, side-by-side 28 Oct).
  return (
    <html lang={locale}>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
