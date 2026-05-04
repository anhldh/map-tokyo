const OPENAQ_BASE = "/api/openaq/v3";
const TOKYO_BBOX = "138.94,35.50,139.92,35.90";

interface ProbeResult {
  tokyoLocsTotal: number;
  pm25InFirstPage: number;
  pm25TotalGlobal: number | string | null;
  tokyoPm25InFirstPage: number;
  coverage: string;
}

export async function probeOpenAQ(): Promise<ProbeResult> {
  // 1. Lấy danh sách locations Tokyo
  const locRes = await fetch(
    `${OPENAQ_BASE}/locations?bbox=${TOKYO_BBOX}&limit=1000`,
  );
  if (!locRes.ok) throw new Error(`locations ${locRes.status}`);
  const locJson = await locRes.json();
  const tokyoIds = new Set<number>(
    (locJson.results ?? []).map((l: { id: number }) => l.id),
  );

  // 2. Lấy PM2.5 latest page 1
  const pmRes = await fetch(`${OPENAQ_BASE}/parameters/2/latest?limit=1000`);
  if (!pmRes.ok) throw new Error(`pm25 latest ${pmRes.status}`);
  const pmJson = await pmRes.json();
  const pmResults = (pmJson.results ?? []) as Array<{ locationsId: number }>;

  const tokyoPm25 = pmResults.filter((m) => tokyoIds.has(m.locationsId));

  const result: ProbeResult = {
    tokyoLocsTotal: tokyoIds.size,
    pm25InFirstPage: pmResults.length,
    pm25TotalGlobal: pmJson.meta?.found ?? null,
    tokyoPm25InFirstPage: tokyoPm25.length,
    coverage: `${tokyoPm25.length} / ${tokyoIds.size} Tokyo locs có PM2.5 trong page 1`,
  };

  console.group("[OpenAQ Probe]");
  console.log("Tokyo locs total:", result.tokyoLocsTotal);
  console.log("PM2.5 trong page 1 (global):", result.pm25InFirstPage);
  console.log("PM2.5 total global (meta.found):", result.pm25TotalGlobal);
  console.log("Tokyo có data trong page 1:", result.tokyoPm25InFirstPage);
  console.log("Coverage:", result.coverage);
  console.groupEnd();

  return result;
}

// Auto-run khi import (chỉ cho dev probe)
if (import.meta.env.DEV) {
  // expose ra window để gọi từ console
  (
    window as unknown as { probeOpenAQ: () => Promise<ProbeResult> }
  ).probeOpenAQ = probeOpenAQ;
}
