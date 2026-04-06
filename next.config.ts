import type { NextConfig } from "next";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

function getBuildId(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return Date.now().toString(36);
  }
}

const buildId = getBuildId();

const swPath = path.join(process.cwd(), "public", "sw.js");
const swContent = fs.readFileSync(swPath, "utf-8");
const swPatched = swContent.replace(/__BUILD_ID__/g, buildId);

const swOutPath = path.join(process.cwd(), "public", "sw.js");
if (swContent.includes("__BUILD_ID__") || !swContent.includes(buildId)) {
  fs.writeFileSync(swOutPath, swPatched);
  console.log(`[next.config] sw.js patched with buildId: ${buildId}`);
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BUILD_ID: buildId,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
