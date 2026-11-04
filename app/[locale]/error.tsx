"use client";

// Shown only when the dataset could not be loaded and there is no earlier
// good copy to fall back on: the loader's "could not be loaded" banner, in the
// page's language (the frame's Banner and the message files). In its own
// .launch-dashboard root: there is no data for the frame to draw.
import { useParams } from "next/navigation";
import { Banner } from "@/components/frame/Banner";
import { frameText } from "@/components/frame/text";
import { isLocale } from "@/lib/locales";

export default function DashboardError() {
  const { locale } = useParams<{ locale: string }>();
  return (
    <div className="launch-dashboard">
      <div className="wrap" role="alert">
        <Banner kind="fail" text={frameText(isLocale(locale) ? locale : "en").banner} />
      </div>
    </div>
  );
}
