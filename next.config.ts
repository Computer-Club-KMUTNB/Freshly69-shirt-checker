import type { NextConfig } from "next";

// Security headers for every page and API response.
// A full Content-Security-Policy is intentionally NOT set: the barcode reader loads its WASM from
// cdn.jsdelivr.net and Next injects inline scripts, so a strict CSP would need careful testing on
// real phones. `frame-ancestors` alone is safe and blocks click-jacking.
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" }, // no other site may embed this app in an iframe
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" }, // never leak URLs to other sites
  // camera is needed for scanning (this site only); everything else is switched off
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // API answers hold personal data: never cache them in a browser or a shared proxy
      { source: "/api/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
