import type { Dayjs } from "dayjs";
import { isJapaneseHoliday } from "./japaneseHolidays";
import { R2_BASE } from "@/utils/constants";

export interface RawTimetableEntry {
  s: string;
  a?: string;
  d?: string;
}

export interface RawTrainTimetable {
  id: string;
  t: string;
  r: string;
  n: string;
  y: string;
  d: string;
  os?: string[];
  ds?: string[];
  tt: RawTimetableEntry[];
  nm?: unknown[];
  v?: string;
}

export interface TrainTimetable {
  id: string;
  trainId: string;
  railway: string;
  trainNumber: string;
  trainType: string;
  direction: string;
  origins?: string[];
  destinations?: string[];
  stations: string[];
  arrivals: (number | undefined)[];
  departures: (number | undefined)[];
  start: number;
  end: number;
}

/** Số giây tàu đứng tại station xuất phát trước khi khởi hành (khớp configs.standingDuration gốc) */
export const STANDING_DURATION = 15;

/** "HH:MM" -> giây tính từ 00:00. Hỗ trợ HH >= 24 nếu sau này dataset dùng "25:30" cho tàu khuya. */
export function getTimeOffset(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 3600 + m * 60;
}

export function parseTrainTimetable(raw: RawTrainTimetable): TrainTimetable {
  const stations = raw.tt.map((e) => e.s);
  const arrivals = raw.tt.map((e) => (e.a ? getTimeOffset(e.a) : undefined));
  const departures = raw.tt.map((e) => (e.d ? getTimeOffset(e.d) : undefined));

  const all = [...arrivals, ...departures].filter(
    (t): t is number => typeof t === "number",
  );

  return {
    id: raw.id,
    trainId: raw.t,
    railway: raw.r,
    trainNumber: raw.n,
    trainType: raw.y,
    direction: raw.d,
    origins: raw.os,
    destinations: raw.ds,
    stations,
    arrivals,
    departures,
    start: Math.min(...all) - STANDING_DURATION,
    end: Math.max(...all),
  };
}

export type CalendarType =
  | "weekday"
  | "saturday"
  | "sunday-holiday"
  | "holiday";

const TIMETABLE_FILES: Record<CalendarType, string> = {
  weekday: "timetable-weekday.json",
  saturday: "timetable-saturday.json",
  "sunday-holiday": "timetable-sunday-holiday.json",
  holiday: "timetable-holiday.json",
};

export async function loadTimetable(
  calendar: CalendarType,
  baseUrl = R2_BASE,
): Promise<TrainTimetable[]> {
  const file = TIMETABLE_FILES[calendar];
  const res = await fetch(`${baseUrl}/${file}`);
  if (!res.ok) {
    throw new Error(
      `Failed to load timetable ${calendar}: ${res.status} ${res.statusText}`,
    );
  }
  const raw = (await res.json()) as RawTrainTimetable[];
  return raw.map(parseTrainTimetable);
}

export async function loadWeekdayTimetable(
  baseUrl = R2_BASE,
): Promise<TrainTimetable[]> {
  const res = await fetch(`${baseUrl}/timetable-weekday.json`);
  if (!res.ok) {
    throw new Error(
      `Failed to load timetable: ${res.status} ${res.statusText}`,
    );
  }
  const raw = (await res.json()) as RawTrainTimetable[];
  return raw.map(parseTrainTimetable);
}

export function getCalendarType(date: Dayjs): CalendarType {
  const dayOfWeek = date.day(); // 0 = Sun, 6 = Sat
  const holiday = isJapaneseHoliday(date);

  if (dayOfWeek === 6 && holiday) return "holiday"; // Sat + holiday
  if (dayOfWeek === 6) return "saturday";
  if (dayOfWeek === 0 || holiday) return "sunday-holiday";
  return "weekday";
}

export async function loadAllTimetables(
  baseUrl = R2_BASE,
): Promise<Record<CalendarType, TrainTimetable[]>> {
  const calendars: CalendarType[] = [
    "weekday",
    "saturday",
    "sunday-holiday",
    "holiday",
  ];

  // Load weekday trước, dùng làm fallback
  const weekday = await loadTimetable("weekday", baseUrl);

  const entries = await Promise.all(
    calendars.map(async (cal) => {
      if (cal === "weekday") return [cal, weekday] as const;
      try {
        const data = await loadTimetable(cal, baseUrl);
        return [cal, data] as const;
      } catch (err) {
        console.warn(`[timetable] ${cal} not found, fallback to weekday`, err);
        return [cal, weekday] as const;
      }
    }),
  );

  return Object.fromEntries(entries) as Record<CalendarType, TrainTimetable[]>;
}
