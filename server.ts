import { serve, file } from "bun";
import { join } from "path";

const BUILD_DIR = "./dist";
const OPENAQ_PREFIX = "/api/openaq/";
const OPENAQ_UPSTREAM = "https://api.openaq.org";

const server = serve({
  port: process.env.PORT || 5173,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // ===== Proxy OpenAQ =====
    if (path.startsWith(OPENAQ_PREFIX)) {
      return handleOpenAQ(req, url);
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

async function handleOpenAQ(req: Request, url: URL): Promise<Response> {
  const apiKey = process.env.OPENAQ_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENAQ_API_KEY not configured" },
      { status: 500 },
    );
  }

  const upstreamPath = url.pathname.slice(OPENAQ_PREFIX.length);
  const upstreamUrl = `${OPENAQ_UPSTREAM}/${upstreamPath}${url.search}`;

  try {
    const upstream = await fetch(upstreamUrl, {
      method: req.method,
      headers: {
        "X-API-Key": apiKey,
        accept: "application/json",
      },
    });

    const headers = new Headers();
    const passHeaders = [
      "content-type",
      "x-ratelimit-used",
      "x-ratelimit-reset",
      "x-ratelimit-limit",
      "x-ratelimit-remaining",
      "retry-after",
    ];
    for (const h of passHeaders) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (err) {
    console.error("[openaq proxy]", err);
    return Response.json({ error: "Upstream fetch failed" }, { status: 502 });
  }
}

console.log(`Server đang chạy tại http://localhost:${server.port}`);
