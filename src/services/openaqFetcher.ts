let lastRequestAt = 0;
const MIN_GAP_MS = 1100; // ~55 req/min, dưới limit 60/min

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Serialize tất cả request qua 1 chain
let chain: Promise<unknown> = Promise.resolve();

export async function openaqFetch(url: string, retries = 3): Promise<Response> {
  const run = async (): Promise<Response> => {
    const wait = Math.max(0, lastRequestAt + MIN_GAP_MS - Date.now());
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();

    const res = await fetch(url);

    if (res.status === 429 && retries > 0) {
      const retryAfter = Number(res.headers.get("retry-after") ?? "");
      const reset = Number(res.headers.get("x-ratelimit-reset") ?? "");
      const backoff =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Number.isFinite(reset) && reset > 0
            ? reset * 1000
            : 5000;
      console.warn(
        `[openaq] 429, sleep ${backoff}ms, retries left ${retries - 1}`,
      );
      await sleep(backoff);
      return openaqFetch(url, retries - 1);
    }

    return res;
  };

  const next = chain.then(run, run);
  chain = next.catch(() => {});
  return next;
}
