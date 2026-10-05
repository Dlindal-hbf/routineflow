import {
  addDaysToDateKey,
  addMonthsToDateKey,
  compareDateKeys,
  formatMonthLabel,
  getStartOfMonthDateKey,
  getTodayDateKey,
  getWeekdayIndex,
  getWeekdayNames,
  parseDateKey,
} from "@/lib/date-utils";
import type { CalendarMonthData, CalendarWeek, DateKey, WeekStart } from "@/types/calendar";

function getDaysInMonth(monthKey: DateKey): number {
  const date = parseDateKey(monthKey);
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
}

export function shiftCalendarMonth(monthKey: DateKey, amount: number): DateKey {
  return getStartOfMonthDateKey(addMonthsToDateKey(monthKey, amount));
}

export function isDateKeyInMonth(dateKey: DateKey, monthKey: DateKey): boolean {
  return compareDateKeys(dateKey, monthKey) >= 0 && dateKey.startsWith(monthKey.slice(0, 7));
}

export function buildMonthCalendar(
  reference: Date | DateKey,
  options?: {
    locale?: string;
    todayKey?: DateKey;
    weekStartsOn?: WeekStart;
  }
): CalendarMonthData {
  const { locale = "no-NO", todayKey = getTodayDateKey(), weekStartsOn = "monday" } =
    options ?? {};

  const monthKey = getStartOfMonthDateKey(reference);
  const firstDay = parseDateKey(monthKey);
  const leadingEmptySlots = getWeekdayIndex(firstDay, weekStartsOn);
  const daysInMonth = getDaysInMonth(monthKey);

  const slots: CalendarWeek = Array.from({ length: leadingEmptySlots }, () => null);

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(firstDay.getFullYear(), firstDay.getMonth(), day);
    const dateKey = addDaysToDateKey(monthKey, day - 1);
    slots.push({
      dateKey,
      dayOfMonth: day,
      inCurrentMonth: true,
      isToday: dateKey === todayKey,
      weekdayIndex: getWeekdayIndex(date, weekStartsOn),
    });
  }

  while (slots.length % 7 !== 0) {
    slots.push(null);
  }

  const weeks: CalendarWeek[] = [];
  for (let index = 0; index < slots.length; index += 7) {
    weeks.push(slots.slice(index, index + 7));
  }

  return {
    monthKey,
    monthLabel: formatMonthLabel(monthKey, locale),
    weekdayLabels: getWeekdayNames({
      locale,
      format: "short",
      weekStartsOn,
      normalizeLabel: true,
    }),
    weeks,
  };
}
