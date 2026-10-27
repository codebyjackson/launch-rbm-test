"use client";

import { useRef } from "react";
import { CSV_BOM, CSV_TYPE } from "@/lib/frame";
import { DownloadIcon } from "./icons";

/**
 * Download CSV: the text arrives finished from the server (frameView); the
 * click only wraps it in a file. As on the page, the object URL is not
 * revoked.
 */
export function CsvButton({ label, csv, fileName }: { label: string; csv: string; fileName: string }) {
  const button = useRef<HTMLButtonElement>(null);

  const download = () => {
    const blob = new Blob([CSV_BOM + csv], { type: CSV_TYPE });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    // The page put the link in <body> for the moment of the click (some
    // browsers follow a download link only from inside the document). Here
    // it goes beside the button, inside the dashboard: nothing is added to
    // the host page's <body>.
    const host = button.current?.parentElement;
    if (host) host.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <button className="dl-btn" id="dl-csv" type="button" ref={button} onClick={download}>
      <DownloadIcon /> {label}
    </button>
  );
}
