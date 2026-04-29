import { serve, file } from "bun";
import { join } from "path";
const BUILD_DIR = "./dist";

const server = serve({
  port: process.env.PORT || 5173,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname;
    if (path === "/") {
      path = "/index.html";
    }

    const filePath = join(BUILD_DIR, path);
    const f = file(filePath);

    if (await f.exists()) {
      return new Response(f);
    }
    return new Response(file(join(BUILD_DIR, "index.html")));
  },
});

console.log(` Server đang chạy tại http://localhost:${server.port}`);
