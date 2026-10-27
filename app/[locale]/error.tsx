"use client";

// Shown only when the dataset could not be loaded and there is no earlier
// good copy to fall back on. English for now: the French and Portuguese come
// with the message files (step 2 of the port). In its own .launch-dashboard
// root, which the layout no longer provides (the frame renders it).
export default function DashboardError() {
  return (
    <div className="launch-dashboard">
      <div role="alert">
        <p>
          <strong>The dashboard data could not be loaded.</strong> Please try again in a few minutes.
        </p>
      </div>
    </div>
  );
}
