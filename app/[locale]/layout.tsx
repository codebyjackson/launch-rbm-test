import type { Metadata } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { PAGE_LANG } from "@/lib/frame";
import { LOCALES, isLocale } from "@/lib/locales";
import { messagesFor } from "@/lib/messages";
import "@/styles/launch-dashboard.css";

// The example app's root layout. RBM's own layout replaces it. The dashboard's
// CSS applies only inside the .launch-dashboard element, as it will inside
// RBM's page. That element is rendered by the components themselves
// (components/frame/DashboardFrame.tsx), not here: it carries state (the
// sub-open class), and RBM takes the components, not this layout.
// The page's title, description and keywords in its language: Unitaid.metadata,
// the keys RBM's site reads for the module's page (its sample files).
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const { title, description, keywords } = messagesFor(locale).metadata;
  return { title, description, keywords };
}

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
    <html lang={PAGE_LANG[locale]}>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
