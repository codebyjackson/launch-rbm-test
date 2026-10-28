"use client";

// EXAMPLE APP ONLY. RBM's router decides how a medicine is carried in the
// address; this is one way, a ?product=<id> query parameter, to show the
// Dashboard's two props for it working.
//
// The address is read after the page has hydrated, not by the server page:
// reading searchParams there would make every request render the page anew
// (no pre-built /en, /fr, /pt), and useSearchParams() in a pre-built page
// needs a Suspense boundary that would render the whole dashboard in the
// browser only. So the page arrives with every row closed, then opens and
// scrolls to the medicine, as today's page did for #pyramax after its script
// had run.
import { useCallback, useEffect, useState } from "react";
import { Dashboard, type DashboardProps } from "@/components/Dashboard";

const PARAM = "product";

const fromAddress = () => new URLSearchParams(window.location.search).get(PARAM);

export function ExampleDashboard(props: Omit<DashboardProps, "initialProduct" | "onProductChange">) {
  const [product, setProduct] = useState<string | null>(null);

  // on load, and on back and forward
  useEffect(() => {
    const read = () => setProduct(fromAddress());
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  // A row the reader opened goes into the address, replacing the entry (the
  // back button still leaves the page, as today's did not add entries
  // either). Passing the id back is the board's echo: no jump.
  const onProductChange = useCallback((id: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set(PARAM, id);
    window.history.replaceState(null, "", url);
    setProduct(id);
  }, []);

  return <Dashboard {...props} initialProduct={product} onProductChange={onProductChange} />;
}
