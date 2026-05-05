import { defineConfig, loadEnv } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import path from "path";
import svgr from "vite-plugin-svgr";

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
        "/api/waqi": {
          target: "https://api.waqi.info",
          changeOrigin: true,
          rewrite: (p) => {
            const stripped = p.replace(/^\/api\/waqi/, "");
            const [pathOnly, query = ""] = stripped.split("?");
            const sp = new URLSearchParams(query);
            sp.set("token", env.WAQI_TOKEN ?? "");
            return `${pathOnly}?${sp.toString()}`;
          },
        },
      },
    },
  };
});
