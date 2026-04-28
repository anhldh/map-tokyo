// src/data/odptRealtime.ts
export interface OdptTrainRealtime {
  trainNumber: string;
  railway: string; // "odpt.Railway:Toei.Asakusa" → cần normalize
  delay: number; // seconds, có thể âm
  fromStation?: string;
  toStation?: string;
  trainType?: string;
  direction?: string;
  /** Server timestamp */
  date: string;
}

const OPERATORS = [
  "odpt.Operator:TWR",
  "odpt.Operator:TokyoMetro",
  "odpt.Operator:Toei",
  "odpt.Operator:YokohamaMunicipal",
  "odpt.Operator:MIR",
  "odpt.Operator:TamaMonorail",
];

export async function fetchOdptTrains(
  consumerKey: string,
): Promise<OdptTrainRealtime[]> {
  const operatorsParam = OPERATORS.join(",");
  const url = `https://api.odpt.org/api/v4/odpt:Train?odpt:operator=${operatorsParam}&acl:consumerKey=${consumerKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ODPT trains fetch failed: ${res.status}`);
  }
  const data = await res.json();

  return data.map((item: any) => ({
    trainNumber: item["odpt:trainNumber"],
    railway: normalizeRailwayId(item["odpt:railway"]),
    delay: item["odpt:delay"] ?? 0,
    fromStation: item["odpt:fromStation"]
      ? normalizeStationId(item["odpt:fromStation"])
      : undefined,
    toStation: item["odpt:toStation"]
      ? normalizeStationId(item["odpt:toStation"])
      : undefined,
    trainType: item["odpt:trainType"],
    direction: item["odpt:railDirection"],
    date: item["dc:date"],
  }));
}

/** "odpt.Railway:Toei.Asakusa" → "Toei.Asakusa" */
function normalizeRailwayId(id: string): string {
  return id.replace(/^odpt\.Railway:/, "");
}

/** "odpt.Station:Toei.Asakusa.Asakusa" → "Toei.Asakusa.Asakusa" */
function normalizeStationId(id: string): string {
  return id.replace(/^odpt\.Station:/, "");
}
