/**
 * Mô phỏng phản ứng hệ thống chống lụt của Tokyo.
 */

export type FloodScenario = "ideal" | "realistic" | "worst-case";

interface ScenarioConfig {
  drainageCapacity: number;
  leveeHeight: number;
  underDrainageFactor: number;
  overloadFactor: number;
  catastrophicFactor: number;
}

const SCENARIOS: Record<FloodScenario, ScenarioConfig> = {
  ideal: {
    drainageCapacity: 2,
    leveeHeight: 8,
    underDrainageFactor: 0.02,
    overloadFactor: 0.2,
    catastrophicFactor: 0.7,
  },
  realistic: {
    drainageCapacity: 1,
    leveeHeight: 6,
    underDrainageFactor: 0.03,
    overloadFactor: 0.45,
    catastrophicFactor: 1.0,
  },
  "worst-case": {
    drainageCapacity: 0.3,
    leveeHeight: 3,
    underDrainageFactor: 0.2,
    overloadFactor: 0.7,
    catastrophicFactor: 1.0,
  },
};

/**
 * DEM của Mapbox có vùng zero-meter zone Tokyo ở elevation âm (-3 đến -4m).
 * Thực tế các vùng đó được đê chắn + bơm giữ khô. Để mô phỏng đúng:
 * trừ offset này → "mặt nước 0m" trong demo = -4m trong DEM.
 * Plane chỉ nhô lên ngập đất khi nước dâng đủ vượt qua đê + offset.
 */
const DEM_OFFSET = 4;

export function computeEffectiveLevel(
  rawLevel: number,
  scenario: FloodScenario = "realistic",
): number {
  if (rawLevel <= 0) return 0;

  const cfg = SCENARIOS[scenario];

  let effective: number;

  if (rawLevel <= cfg.drainageCapacity) {
    effective = rawLevel * cfg.underDrainageFactor;
  } else if (rawLevel <= cfg.leveeHeight) {
    const t =
      (rawLevel - cfg.drainageCapacity) /
      (cfg.leveeHeight - cfg.drainageCapacity);
    const factor =
      cfg.underDrainageFactor +
      (cfg.overloadFactor - cfg.underDrainageFactor) * smoothstep(t);
    effective = rawLevel * factor;
  } else {
    const overflow = rawLevel - cfg.leveeHeight;
    const baseAtLevee = cfg.leveeHeight * cfg.overloadFactor;
    effective = baseAtLevee + overflow * cfg.catastrophicFactor;
  }

  // Offset: plane đặt thấp hơn mực biển DEM để bù vùng âm
  return effective - DEM_OFFSET;
}

function smoothstep(t: number): number {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
}

export function getFloodDescription(
  rawLevel: number,
  scenario: FloodScenario = "realistic",
): string {
  if (rawLevel === 0) return "Không mô phỏng";
  const cfg = SCENARIOS[scenario];

  if (rawLevel <= cfg.drainageCapacity) {
    return "Hệ thống thoát nước đang xử lý";
  }
  if (rawLevel <= cfg.leveeHeight) {
    return "Drainage quá tải, đê chắn còn trụ";
  }
  return "Đê vỡ — ngập diện rộng";
}

/**
 * Hiển thị "ngập hiển thị" cho UI (clamp 0 không hiện số âm).
 * Đây là phần plane nhô lên trên mặt đất zero-meter zone.
 */
export function getDisplayDepth(
  rawLevel: number,
  scenario: FloodScenario = "realistic",
): number {
  const eff = computeEffectiveLevel(rawLevel, scenario);
  return Math.max(0, eff + DEM_OFFSET); // bù lại offset cho UI hiển thị
}
