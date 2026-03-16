export type DateKey = `${number}-${number}-${number}`;

export type WeekStart = "monday" | "sunday";

export type CalendarWeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type CalendarDateParts = {
  year: number;
  month: number;
  day: number;
};

export type CalendarDayCell = {
  dateKey: DateKey;
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isToday: boolean;
  weekdayIndex: CalendarWeekdayIndex;
};

export type CalendarWeek = Array<CalendarDayCell | null>;

export type CalendarMonthData = {
  monthKey: DateKey;
  monthLabel: string;
  weekdayLabels: string[];
  weeks: CalendarWeek[];
};
