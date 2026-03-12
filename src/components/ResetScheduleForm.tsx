"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RoutineFrequency } from "@/src/lib/scheduling/reset-types";

export type ResetScheduleValue = {
  resetEnabled: boolean;
  frequency: RoutineFrequency;
  resetTime: string;
  resetDayOfWeek?: number;
  resetDayOfMonth?: number;
  // timezone is fixed; value field kept only for internal compatibility
  timezone?: string;
};

interface Props {
  value: ResetScheduleValue;
  onChange: (next: ResetScheduleValue) => void;
}

const weekdayOptions = [
  { label: "Sunday", value: 0 },
  { label: "Monday", value: 1 },
  { label: "Tuesday", value: 2 },
  { label: "Wednesday", value: 3 },
  { label: "Thursday", value: 4 },
  { label: "Friday", value: 5 },
  { label: "Saturday", value: 6 },
];

export default function ResetScheduleForm({
  value,
  onChange,
}: Props) {
  const defaultTimezone = "Europe/Oslo";
  const update = (patch: Partial<ResetScheduleValue>) => {
    onChange({ ...value, timezone: defaultTimezone, ...patch });
  };

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div className="flex items-center gap-2">
        <input
          id="repeat-enabled"
          type="checkbox"
          checked={value.resetEnabled}
          onChange={(e) => update({ resetEnabled: e.target.checked })}
        />
        <Label htmlFor="repeat-enabled">Repeat enabled</Label>
      </div>

      <div className="space-y-2">
        <Label>Frequency</Label>
        <Select
          value={value.frequency}
          onValueChange={(next) => update({ frequency: next as RoutineFrequency })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select frequency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">none</SelectItem>
            <SelectItem value="daily">daily</SelectItem>
            <SelectItem value="weekly">weekly</SelectItem>
            <SelectItem value="biweekly">biweekly</SelectItem>
            <SelectItem value="monthly">monthly</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reset-time">Reset time</Label>
        <Input
          id="reset-time"
          type="time"
          value={value.resetTime}
          onChange={(e) => update({ resetTime: e.target.value || "06:00" })}
        />
      </div>

      {(value.frequency === "weekly" || value.frequency === "biweekly") && (
        <div className="space-y-2">
          <Label>Day of week</Label>
          <Select
            value={String(value.resetDayOfWeek ?? 1)}
            onValueChange={(next) => update({ resetDayOfWeek: Number(next) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weekdayOptions.map((opt) => (
                <SelectItem key={opt.value} value={String(opt.value)}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {value.frequency === "monthly" && (
        <div className="space-y-2">
          <Label htmlFor="reset-day-of-month">Day of month</Label>
          <Input
            id="reset-day-of-month"
            type="number"
            min={1}
            max={31}
            value={value.resetDayOfMonth ?? 1}
            onChange={(e) => {
              const parsed = Number(e.target.value);
              update({
                resetDayOfMonth: Number.isFinite(parsed)
                  ? Math.min(31, Math.max(1, parsed))
                  : 1,
              });
            }}
          />
        </div>
      )}

      {/* timezone is fixed for this app; users cannot change it */}
      <div className="space-y-2">
        <Label>Timezone</Label>
        <div className="inline-block rounded-md bg-slate-100 px-2 py-1 text-sm font-medium text-slate-800">
          Europe/Oslo (CET)
        </div>
      </div>
    </div>
  );
}
