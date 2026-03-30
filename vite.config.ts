import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
  }
}

// Shopify CLI sets HMR_HOST for the Cloudflare tunnel
const host = new URL(
  process.env.HMR_HOST || process.env.HOST || "http://localhost:3000",
);

let hmrConfig;
if (host.hostname === "localhost") {
  hmrConfig = {
    protocol: "ws" as const,
    host: "localhost",
    port: 64341,
    clientPort: 64341,
  };
} else {
  hmrConfig = {
    protocol: "wss" as const,
    host: host.hostname,
    port: parseInt(host.port) || 443,
    clientPort: 443,
  };
}

export default defineConfig({
  server: {
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      allow: ["app", "node_modules"],
    },
  },
  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
    }),
    tsconfigPaths(),
  ],
});
