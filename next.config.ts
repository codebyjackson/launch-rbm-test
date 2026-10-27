import type { NextConfig } from "next";

// The example app only. RBM drops the components into its own app, with its
// own routes and config; nothing here is needed there.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [{ source: "/", destination: "/en", permanent: false }];
  },
};

export default nextConfig;
