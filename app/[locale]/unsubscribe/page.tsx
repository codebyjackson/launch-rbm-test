import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Unsubscribe } from "@/components/unsubscribe/Unsubscribe";
import { unsubscribeText } from "@/components/unsubscribe/text";
import { isLocale } from "@/lib/locales";

// The "Unsubscribe?" page: /en/unsubscribe, /fr/unsubscribe, /pt/unsubscribe.
// The link in the welcome email opens the forms service, which sends the
// reader here with the link's token (?t=…); the button posts it to
// /api/unitaid/unsubscribe. The forms service cannot draw this page itself: on
// Supabase's own address a page is served as plain text. On RBM's site it
// sits in the module, at /{locale}/unitaid/unsubscribe, and the forms service
// sends RBM's readers there (SITES in launch-development-test's
// supabase/functions/_shared/mail.mjs).
//
// Never indexed, and no Referer: the address carries the token, and the link
// back must not hand it to anyone.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: unsubscribeText(locale).title,
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function UnsubscribePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <Unsubscribe text={unsubscribeText(locale)} backHref={`/${locale}`} />;
}
