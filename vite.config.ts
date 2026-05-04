import { defineConfig, loadEnv } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import path from "path";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), babel({ presets: [reactCompilerPreset()] }), svgr()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      proxy: {
        "/api/openaq": {
          target: "https://api.openaq.org",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/openaq/, ""),
          headers: {
            "X-API-Key": env.OPENAQ_API_KEY ?? "",
          },
        },
      },
    },
  };
});
