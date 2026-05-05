import { serve, file } from "bun";
import { join } from "path";

const BUILD_DIR = "./dist";
const WAQI_PREFIX = "/api/waqi/";
const WAQI_UPSTREAM = "https://api.waqi.info";

const server = serve({
  port: process.env.PORT || 5173,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // ===== Proxy WAQI =====
    if (path.startsWith(WAQI_PREFIX)) {
      return handleWAQI(req, url);
    }

    // ===== Static files / SPA fallback =====
    const requestedPath = path === "/" ? "/index.html" : path;
    const filePath = join(BUILD_DIR, requestedPath);
    const f = file(filePath);

    if (await f.exists()) {
      return new Response(f);
    }
    return new Response(file(join(BUILD_DIR, "index.html")));
  },
});

async function handleWAQI(req: Request, url: URL): Promise<Response> {
  const token = process.env.WAQI_TOKEN;
  if (!token) {
    return Response.json(
      { error: "WAQI_TOKEN not configured" },
      { status: 500 },
    );
  }

  // /api/waqi/map/bounds/?latlng=... → https://api.waqi.info/map/bounds/?latlng=...&token=...
  const upstreamPath = url.pathname.slice(WAQI_PREFIX.length);
  const sp = new URLSearchParams(url.search);
  sp.set("token", token);
  const upstreamUrl = `${WAQI_UPSTREAM}/${upstreamPath}?${sp.toString()}`;

  try {
    const upstream = await fetch(upstreamUrl, { method: req.method });

    const headers = new Headers();
    const ct = upstream.headers.get("content-type");
    if (ct) headers.set("content-type", ct);

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (err) {
    console.error("[waqi proxy]", err);
    return Response.json({ error: "Upstream fetch failed" }, { status: 502 });
  }
}

console.log(`Server đang chạy tại http://localhost:${server.port}`);
