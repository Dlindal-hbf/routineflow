import { ResetSchedulePolicy } from "@/src/lib/scheduling/reset-types";

// timezone is fixed for the entire application
const FIXED_TIMEZONE = "Europe/Oslo";


type CalendarDate = { year: number; month: number; day: number };

type TimeParts = { hour: number; minute: number };

function parseResetTime(resetTime: string): TimeParts {
  const [hourRaw, minuteRaw] = resetTime.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new Error(`Invalid reset hour: ${resetTime}`);
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    throw new Error(`Invalid reset minute: ${resetTime}`);
  }

  return { hour, minute };
}

function getTimeZoneParts(date: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function getTimeZoneOffsetMs(date: Date, timezone: string = FIXED_TIMEZONE): number {
  const p = getTimeZoneParts(date, timezone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - date.getTime();
}

function zonedDateTimeToUtc(
  calendarDate: CalendarDate,
  time: TimeParts,
  timezone: string = FIXED_TIMEZONE
): Date {
  const initialGuess = new Date(
    Date.UTC(
      calendarDate.year,
      calendarDate.month - 1,
      calendarDate.day,
      time.hour,
      time.minute,
      0,
      0
    )
  );

  const offset1 = getTimeZoneOffsetMs(initialGuess, timezone);
  let result = new Date(initialGuess.getTime() - offset1);

  const offset2 = getTimeZoneOffsetMs(result, timezone);
  if (offset2 !== offset1) {
    result = new Date(initialGuess.getTime() - offset2);
  }

  return result;
}

function addCalendarDays(date: CalendarDate, days: number): CalendarDate {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function addCalendarMonths(date: CalendarDate, months: number): CalendarDate {
  const d = new Date(Date.UTC(date.year, date.month - 1 + months, 1));
  const maxDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(date.day, maxDay);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day,
  };
}

function calendarDateToWeekday(date: CalendarDate): number {
  return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
}

function compareDates(a: Date, b: Date): number {
  return a.getTime() - b.getTime();
}

function getNowCalendarDate(fromDate: Date, timezone: string = FIXED_TIMEZONE): CalendarDate {
  const p = getTimeZoneParts(fromDate, timezone);
  return { year: p.year, month: p.month, day: p.day };
}

export function getNextDailyOccurrence(policy: ResetSchedulePolicy, fromDate: Date): Date {
  const time = parseResetTime(policy.resetTime);
  const today = getNowCalendarDate(fromDate);
  let candidate = zonedDateTimeToUtc(today, time);

  if (compareDates(candidate, fromDate) <= 0) {
    candidate = zonedDateTimeToUtc(addCalendarDays(today, 1), time);
  }

  return candidate;
}

export function getNextWeeklyOccurrence(policy: ResetSchedulePolicy, fromDate: Date): Date {
  const time = parseResetTime(policy.resetTime);
  const targetDay = policy.resetDayOfWeek ?? 1;

  const base = getNowCalendarDate(fromDate);
  const currentDow = calendarDateToWeekday(base);
  let delta = (targetDay - currentDow + 7) % 7;

  let candidateDate = addCalendarDays(base, delta);
  let candidate = zonedDateTimeToUtc(candidateDate, time);

  if (compareDates(candidate, fromDate) <= 0) {
    delta += 7;
    candidateDate = addCalendarDays(base, delta);
    candidate = zonedDateTimeToUtc(candidateDate, time);
  }

  return candidate;
}

export function getNextBiweeklyOccurrence(policy: ResetSchedulePolicy, fromDate: Date): Date {
  const time = parseResetTime(policy.resetTime);
  const targetDay = policy.resetDayOfWeek ?? 1;

  const base = getNowCalendarDate(fromDate);

  const anchorDate = policy.anchorStartAt
    ? getNowCalendarDate(new Date(policy.anchorStartAt))
    : base;

  const anchorDow = calendarDateToWeekday(anchorDate);
  const shiftToTarget = (targetDay - anchorDow + 7) % 7;
  const firstCycleDate = addCalendarDays(anchorDate, shiftToTarget);
  const firstCycleUtc = zonedDateTimeToUtc(firstCycleDate, time);

  if (compareDates(firstCycleUtc, fromDate) > 0) {
    return firstCycleUtc;
  }

  const msPer14Days = 14 * 24 * 60 * 60 * 1000;
  const elapsed = fromDate.getTime() - firstCycleUtc.getTime();
  const cyclesPassed = Math.floor(elapsed / msPer14Days) + 1;

  return new Date(firstCycleUtc.getTime() + cyclesPassed * msPer14Days);
}

export function getNextMonthlyOccurrence(policy: ResetSchedulePolicy, fromDate: Date): Date {
  const time = parseResetTime(policy.resetTime);
  const targetDay = Math.min(Math.max(policy.resetDayOfMonth ?? 1, 1), 31);

  const base = getNowCalendarDate(fromDate);
  const startMonth: CalendarDate = { ...base, day: 1 };

  const thisMonthMaxDay = new Date(
    Date.UTC(startMonth.year, startMonth.month, 0)
  ).getUTCDate();
  const dayForThisMonth = Math.min(targetDay, thisMonthMaxDay);

  let candidateDate: CalendarDate = {
    year: startMonth.year,
    month: startMonth.month,
    day: dayForThisMonth,
  };

  let candidate = zonedDateTimeToUtc(candidateDate, time);

  if (compareDates(candidate, fromDate) <= 0) {
    const nextMonth = addCalendarMonths(startMonth, 1);
    const nextMonthMaxDay = new Date(
      Date.UTC(nextMonth.year, nextMonth.month, 0)
    ).getUTCDate();
    candidateDate = {
      year: nextMonth.year,
      month: nextMonth.month,
      day: Math.min(targetDay, nextMonthMaxDay),
    };
    candidate = zonedDateTimeToUtc(candidateDate, time);
  }

  return candidate;
}

export function calculateNextResetAt(policy: ResetSchedulePolicy, fromDate: Date): Date | null {
  if (policy.frequency === "none") {
    return null;
  }

  if (policy.frequency === "daily") {
    return getNextDailyOccurrence(policy, fromDate);
  }

  if (policy.frequency === "weekly") {
    return getNextWeeklyOccurrence(policy, fromDate);
  }

  if (policy.frequency === "biweekly") {
    return getNextBiweeklyOccurrence(policy, fromDate);
  }

  return getNextMonthlyOccurrence(policy, fromDate);
}

export function calculatePreviousPeriodStartAt(
  policy: ResetSchedulePolicy,
  periodEndAt: Date
): Date {
  if (policy.frequency === "daily") {
    return new Date(periodEndAt.getTime() - 24 * 60 * 60 * 1000);
  }

  if (policy.frequency === "weekly") {
    return new Date(periodEndAt.getTime() - 7 * 24 * 60 * 60 * 1000);
  }

  if (policy.frequency === "biweekly") {
    return new Date(periodEndAt.getTime() - 14 * 24 * 60 * 60 * 1000);
  }

  if (policy.frequency === "monthly") {
    const p = getTimeZoneParts(periodEndAt, FIXED_TIMEZONE);
    const prevMonthDate = addCalendarMonths(
      { year: p.year, month: p.month, day: p.day },
      -1
    );
    const t = parseResetTime(policy.resetTime);
    return zonedDateTimeToUtc(prevMonthDate, t);
  }

  return periodEndAt;
}
