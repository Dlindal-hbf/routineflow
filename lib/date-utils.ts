import type { CalendarWeekdayIndex, DateKey, WeekStart } from "@/types/calendar";

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DEFAULT_LOCALE = "no-NO";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function normalizeWeekdayLabel(label: string): string {
  if (!label) {
    return label;
  }

  const trimmed = label.replace(/\.$/, "");
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function getTimeZoneDateParts(date: Date, timeZone: string): {
  year: number;
  month: number;
  day: number;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

export function isDateKey(value: string): value is DateKey {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) {
    return false;
  }

  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const parsed = new Date(year, month - 1, day);

  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}

export function parseDateKey(dateKey: string): Date {
  const match = DATE_KEY_PATTERN.exec(dateKey);
  if (!match) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }

  const [, yearRaw, monthRaw, dayRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${dateKey}`);
  }

  return parsed;
}

export function tryParseDateKey(value?: string | null): Date | null {
  if (!value) {
    return null;
  }

  try {
    return parseDateKey(value);
  } catch {
    return null;
  }
}

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` as DateKey;
}

export function toDateKeyInTimeZone(date: Date, timeZone: string): DateKey {
  const parts = getTimeZoneDateParts(date, timeZone);
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` as DateKey;
}

export function getDateKeyFromTimestamp(
  value: string | Date,
  options?: { timeZone?: string }
): DateKey | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  if (options?.timeZone) {
    return toDateKeyInTimeZone(date, options.timeZone);
  }

  return toDateKey(date);
}

export function formatDateKey(dateKey: DateKey): string {
  const [, month, day] = dateKey.split("-");
  const year = dateKey.slice(0, 4);
  return `${day}.${month}.${year}`;
}

export function formatDate(date: Date): string {
  return formatDateKey(toDateKey(date));
}

export function formatMonthLabel(
  input: Date | DateKey,
  locale: string = DEFAULT_LOCALE
): string {
  const date = typeof input === "string" ? parseDateKey(input) : input;
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatTimestamp(
  value: string | Date,
  locale: string = DEFAULT_LOCALE
): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }

  return date.toLocaleString(locale);
}

export function getWeekdayName(
  input: Date | DateKey,
  options?: {
    locale?: string;
    format?: "long" | "short" | "narrow";
    normalizeLabel?: boolean;
  }
): string {
  const { locale = DEFAULT_LOCALE, format = "long", normalizeLabel = false } = options ?? {};
  const date = typeof input === "string" ? parseDateKey(input) : input;
  const label = new Intl.DateTimeFormat(locale, { weekday: format }).format(date);
  return normalizeLabel ? normalizeWeekdayLabel(label) : label;
}

export function getWeekdayNames(options?: {
  locale?: string;
  format?: "long" | "short" | "narrow";
  weekStartsOn?: WeekStart;
  normalizeLabel?: boolean;
}): string[] {
  const {
    locale = DEFAULT_LOCALE,
    format = "short",
    weekStartsOn = "monday",
    normalizeLabel = true,
  } = options ?? {};

  const mondayReference = parseDateKey("2026-01-05");
  const labels = Array.from({ length: 7 }, (_, index) =>
    getWeekdayName(addDays(mondayReference, index), {
      locale,
      format,
      normalizeLabel,
    })
  );

  if (weekStartsOn === "monday") {
    return labels;
  }

  return [labels[6], ...labels.slice(0, 6)];
}

export function addDays(date: Date, amount: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + amount);
  return result;
}

export function subtractDays(date: Date, amount: number): Date {
  return addDays(date, -amount);
}

export function addDaysToDateKey(dateKey: DateKey, amount: number): DateKey {
  return toDateKey(addDays(parseDateKey(dateKey), amount));
}

export function subtractDaysFromDateKey(dateKey: DateKey, amount: number): DateKey {
  return addDaysToDateKey(dateKey, -amount);
}

export function addMonthsToDateKey(dateKey: DateKey, amount: number): DateKey {
  const date = parseDateKey(dateKey);
  const targetMonthStart = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  const maxDay = new Date(
    targetMonthStart.getFullYear(),
    targetMonthStart.getMonth() + 1,
    0
  ).getDate();

  return toDateKey(
    new Date(
      targetMonthStart.getFullYear(),
      targetMonthStart.getMonth(),
      Math.min(date.getDate(), maxDay)
    )
  );
}

export function getStartOfMonthDateKey(input: Date | DateKey): DateKey {
  const date = typeof input === "string" ? parseDateKey(input) : input;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01` as DateKey;
}

export function getTodayDateKey(timeZone?: string): DateKey {
  const now = new Date();
  return timeZone ? toDateKeyInTimeZone(now, timeZone) : toDateKey(now);
}

export function compareDateKeys(a: DateKey, b: DateKey): number {
  return a.localeCompare(b);
}

export function isSameDateKey(a?: string | null, b?: string | null): boolean {
  return Boolean(a && b && a === b);
}

export function getWeekdayIndex(
  input: Date | DateKey,
  weekStartsOn: WeekStart = "monday"
): CalendarWeekdayIndex {
  const date = typeof input === "string" ? parseDateKey(input) : input;
  const sundayFirst = date.getDay() as CalendarWeekdayIndex;

  if (weekStartsOn === "sunday") {
    return sundayFirst;
  }

  return ((sundayFirst + 6) % 7) as CalendarWeekdayIndex;
}
