// TanStack Start on Vite. `npm run dev` serves on :8080; `npm run build:node` produces a self-contained Node server in .output.
import { defineConfig, loadEnv, type PluginOption } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig(async ({ command, mode }) => {
  const plugins: PluginOption[] = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    // src/server.ts wraps the SSR handler so a crash renders a calm error page instead of a blank screen.
    tanstackStart({
      server: { entry: "server" },
      importProtection: { behavior: "error", client: { files: ["**/server/**"], specifiers: ["server-only"] } },
    }),
  ];

  if (command === "build") {
    // Nitro packages the server. NITRO_PRESET overrides the target; the default is a plain Node server.
    const { nitro } = await import("nitro/vite");
    plugins.push(nitro({ preset: process.env.NITRO_PRESET || "node-server" }));
  }
  plugins.push(viteReact());

  // Expose VITE_* variables from .env to client code.
  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadEnv(mode, process.cwd(), "VITE_"))) {
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    plugins,
    define,
    css: { transformer: "lightningcss" as const },
    resolve: {
      alias: { "@": path.resolve(process.cwd(), "src") },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
    optimizeDeps: { include: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react/jsx-dev-runtime"] },
    server: { host: "::", port: 8080 },
  };
});
