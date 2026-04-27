// src/data/japaneseHolidays.ts
import { type Dayjs } from "dayjs";

/**
 * Danh sách lễ Nhật tĩnh — đủ cho demo.
 * Format: "MM-DD" cho lễ cố định, hoặc full "YYYY-MM-DD" cho lễ chuyển động (vernal/autumnal equinox, Marine Day...)
 *
 * Nếu cần đầy đủ chính xác: dùng package `japanese-holidays` hoặc fetch từ API Nội Các Phủ.
 */
const FIXED_HOLIDAYS: string[] = [
  "01-01", // 元日
  "02-11", // 建国記念の日
  "02-23", // 天皇誕生日
  "04-29", // 昭和の日
  "05-03", // 憲法記念日
  "05-04", // みどりの日
  "05-05", // こどもの日
  "08-11", // 山の日
  "11-03", // 文化の日
  "11-23", // 勤労感謝の日
];

// Lễ chuyển động: cần list theo năm. Bổ sung khi cần.
const MOVING_HOLIDAYS: Record<string, string[]> = {
  "2026": [
    "2026-01-12", // Coming of Age Day (2nd Mon Jan)
    "2026-03-20", // Vernal Equinox
    "2026-07-20", // Marine Day (3rd Mon Jul)
    "2026-09-21", // Respect for the Aged Day
    "2026-09-22", // Furikae kyūjitsu
    "2026-09-23", // Autumnal Equinox
    "2026-10-12", // Sports Day
  ],
};

export function isJapaneseHoliday(date: Dayjs): boolean {
  const mmdd = date.format("MM-DD");
  if (FIXED_HOLIDAYS.includes(mmdd)) return true;

  const year = date.format("YYYY");
  const ymd = date.format("YYYY-MM-DD");
  return MOVING_HOLIDAYS[year]?.includes(ymd) ?? false;
}
