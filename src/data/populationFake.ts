// // src/data/populationFake.ts
// import type { Dayjs } from "dayjs";

// export interface PopulationStation {
//   lon: number;
//   lat: number;
//   importance?: number;
// }

// export interface PopulationPoint {
//   lon: number;
//   lat: number;
//   weight: number;
// }

const MAJOR_STATION_IDS = new Set([
  "Shinjuku",
  "Shibuya",
  "Tokyo",
  "Ikebukuro",
  "Ueno",
  "Shinagawa",
  "Akihabara",
  "Ginza",
  "Roppongi",
]);

// export function getStationImportance(name: string): number {
//   return MAJOR_STATION_IDS.has(name) ? 1.5 : 1.0;
// }

// function getStationActivity(
//   hour: number,
//   minute: number,
//   isWeekend: boolean,
// ): number {
//   const h = hour + minute / 60;

//   // Tàu nghỉ: 1h-5h sáng → station gần như chết
//   if (h >= 1 && h < 5) return 0.02;

//   // Tàu đầu / tàu cuối: ít hoạt động
//   if (h >= 0 && h < 1) return 0.1; // tàu cuối
//   if (h >= 5 && h < 6) return 0.15; // tàu đầu

//   if (isWeekend) {
//     if (h >= 11 && h <= 18)
//       return 0.5 + 0.8 * Math.exp(-Math.pow((h - 14) / 3, 2));
//     if (h >= 21) return 0.3;
//     return 0.25;
//   }

//   // Weekday
//   if (h >= 6.5 && h <= 9.5)
//     return 0.4 + 2.5 * Math.exp(-Math.pow((h - 8) / 0.8, 2));
//   if (h >= 16.5 && h <= 20.5)
//     return 0.4 + 3.0 * Math.exp(-Math.pow((h - 18.5) / 1.0, 2));
//   if (h >= 11 && h <= 14)
//     return 0.5 + 0.5 * Math.exp(-Math.pow((h - 12.5) / 0.8, 2));
//   if (h >= 20 && h <= 23) return 0.4; // sau giờ làm
//   return 0.35;
// }

// function gaussRandom(): number {
//   const u1 = Math.random() || 0.0001;
//   const u2 = Math.random();
//   return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
// }

// // src/data/populationFake.ts

// const HOTSPOT_MIN_COUNT = 250;
// const TOP_N_HOTSPOTS = 30;

// // Baseline: số điểm xanh rải rác ở mỗi station, không phụ thuộc giờ
// const BASELINE_PER_STATION = 2;

// export function generatePopulation(
//   stations: PopulationStation[],
//   time: Dayjs,
// ): PopulationPoint[] {
//   const isWeekend = time.day() === 0 || time.day() === 6;
//   const stationMul = getStationActivity(time.hour(), time.minute(), isWeekend);

//   const points: PopulationPoint[] = [];

//   // === Baseline: mọi ga đều có vài điểm xanh nhạt ===
//   // Weight nhỏ → khi aggregate vào hex sẽ rơi vào tier xanh thấp nhất
//   // Off-peak (đêm khuya) baseline cũng giảm theo nhưng không tắt
//   const baselineMul = Math.max(0.3, stationMul); // sàn 0.3 để không tắt hẳn
//   const baselinePerSt = Math.round(BASELINE_PER_STATION * baselineMul);

//   for (const st of stations) {
//     for (let i = 0; i < baselinePerSt; i++) {
//       const r = Math.abs(gaussRandom()) * 0.4;
//       const theta = Math.random() * Math.PI * 2;
//       const dLat = (r * Math.sin(theta)) / 111;
//       const dLon = (r * Math.cos(theta)) / 91;
//       points.push({
//         lon: st.lon + dLon,
//         lat: st.lat + dLat,
//         weight: 0.2 + Math.random() * 0.2, // weight nhỏ → tier thấp
//       });
//     }
//   }

//   // === Hotspots: top N ga đông nhất, weight lớn ===
//   const ranked = stations
//     .map((st) => ({
//       station: st,
//       count: Math.round(150 * (st.importance ?? 1) * stationMul),
//     }))
//     .filter((x) => x.count >= HOTSPOT_MIN_COUNT)
//     .sort((a, b) => b.count - a.count)
//     .slice(0, TOP_N_HOTSPOTS);

//   for (const { station, count } of ranked) {
//     const importance = station.importance ?? 1.0;
//     for (let i = 0; i < count; i++) {
//       const r = Math.abs(gaussRandom()) * 0.3;
//       const theta = Math.random() * Math.PI * 2;
//       const dLat = (r * Math.sin(theta)) / 111;
//       const dLon = (r * Math.cos(theta)) / 91;
//       points.push({
//         lon: station.lon + dLon,
//         lat: station.lat + dLat,
//         weight: 1 + Math.random() * importance,
//       });
//     }
//   }

//   return points;
// }
// src/data/populationFake.ts
import type { Dayjs } from "dayjs";

export interface PopulationStation {
  name?: string; // Thêm name để nhận diện
  lon: number;
  lat: number;
  importance?: number;
}

export interface PopulationPoint {
  lon: number;
  lat: number;
  weight: number;
}

// Phân loại ga để tạo behavior di chuyển chân thực hơn
const STATION_PROFILES: Record<
  string,
  { type: "business" | "entertainment" | "mixed"; base: number }
> = {
  Shinjuku: { type: "entertainment", base: 2.5 },
  Shibuya: { type: "entertainment", base: 2.2 },
  Roppongi: { type: "entertainment", base: 1.8 },
  Ikebukuro: { type: "entertainment", base: 1.8 },
  Tokyo: { type: "business", base: 2.5 },
  Shinagawa: { type: "business", base: 2.0 },
  Ginza: { type: "business", base: 1.8 },
  Ueno: { type: "mixed", base: 1.5 },
  Akihabara: { type: "mixed", base: 1.5 },
};

function getStationConfig(name?: string) {
  if (!name) return { type: "mixed", base: 1.0 };
  return STATION_PROFILES[name] || { type: "mixed", base: 1.0 };
}
export function getStationImportance(name: string): number {
  return MAJOR_STATION_IDS.has(name) ? 1.0 : 1.0;
}

// Trả về tuple: [Số lượng người (multiplier), Độ phân tán tính bằng km (spreadKm)]
function getActivity(
  h: number,
  type: string,
  isWeekend: boolean,
): [number, number] {
  // Đêm khuya (1h - 5h): Tàu nghỉ
  if (h >= 1 && h < 5) {
    if (type === "entertainment") return [0.5, 1.5]; // Khu ăn chơi vẫn còn người nán lại
    return [0.2, 3.5]; // Các khu khác người dân đã tản ra xa ga (về khu dân cư ngủ)
  }

  if (isWeekend) {
    // Cuối tuần: Peak dải dác từ trưa đến chiều tối
    const peak = Math.exp(-Math.pow((h - 15) / 4, 2));
    return [0.6 + 0.8 * peak, 1.5];
  }

  // Weekday
  // Rush hour sáng (8h-9h) và chiều tối (18h-19h)
  const morningRush = Math.exp(-Math.pow((h - 8.5) / 1.0, 2));
  const eveningRush = Math.exp(-Math.pow((h - 18.5) / 1.5, 2));

  if (type === "business") {
    // Khu văn phòng: Đổ dồn cực mạnh ban ngày, gom chặt quanh ga. Đêm vắng.
    const vol = 0.3 + 2.5 * morningRush + 1.2 * eveningRush;
    return [vol, 0.6]; // Spread cực thấp, gom cục lại
  } else if (type === "entertainment") {
    // Khu giải trí: Peak mạnh vào chiều tối và giữ đến đêm
    const nightLife = h >= 20 ? 0.8 : 0;
    const vol = 0.4 + 0.5 * morningRush + 2.0 * eveningRush + nightLife;
    return [vol, 1.0];
  } else {
    // Khu Mixed / Khu dân cư
    const vol = 0.4 + 1.0 * morningRush + 1.0 * eveningRush;
    return [vol, 2.0]; // Lan đều đặn
  }
}

function gaussRandom(): number {
  const u1 = Math.random() || 0.0001;
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function generatePopulation(
  stations: PopulationStation[],
  time: Dayjs,
): PopulationPoint[] {
  const isWeekend = time.day() === 0 || time.day() === 6;
  const h = time.hour() + time.minute() / 60;
  const points: PopulationPoint[] = [];

  for (const st of stations) {
    const config = getStationConfig(st.name);
    const [multiplier, spreadKm] = getActivity(h, config.type, isWeekend);

    // Tính số point sẽ render dựa trên độ quan trọng của ga và hệ số thời gian
    const count = Math.round(
      150 * config.base * multiplier * (st.importance ?? 1),
    );

    // Tính toán bù trừ kinh độ theo vĩ độ thực tế của ga (Tokyo ~ 35.6 độ)
    const latRad = (st.lat * Math.PI) / 180;
    const kmPerLonDegree = 111 * Math.cos(latRad); // ~90km ở Tokyo
    const kmPerLatDegree = 111;

    for (let i = 0; i < count; i++) {
      // Đổi r từ KM sang Độ (Degree)
      const rKm = Math.abs(gaussRandom()) * spreadKm;
      const theta = Math.random() * Math.PI * 2;

      const dLat = (rKm * Math.sin(theta)) / kmPerLatDegree;
      const dLon = (rKm * Math.cos(theta)) / kmPerLonDegree;

      points.push({
        lon: st.lon + dLon,
        lat: st.lat + dLat,
        weight: 1 + Math.random() * 0.5,
      });
    }
  }

  return points;
}
