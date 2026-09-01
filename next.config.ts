import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow the dev server to be reached from other devices on the LAN (e.g. a
  // phone testing over Wi-Fi via the Mac's local IP) instead of just
  // localhost. Harmless in production — only affects `next dev`.
  allowedDevOrigins: ["192.168.22.112"],
};

export default nextConfig;
