"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export interface AppSelectOption<T extends string = string> {
  value: T
  label: string
  description?: string
  disabled?: boolean
}

interface AppSelectProps<T extends string = string> {
  options: ReadonlyArray<AppSelectOption<T>>
  value?: T
  onValueChange: (value: T) => void
  label?: string
  triggerLabel?: string
  placeholder?: string
  disabled?: boolean
  size?: "sm" | "default" | "lg"
  className?: string
  triggerClassName?: string
  contentClassName?: string
  optionClassName?: string
  id?: string
  renderOption?: (
    option: AppSelectOption<T>,
    state: { selected: boolean }
  ) => React.ReactNode
  renderValue?: (option: AppSelectOption<T>) => React.ReactNode
}

function AppSelect<T extends string = string>({
  options,
  value,
  onValueChange,
  label,
  triggerLabel,
  placeholder = "Select an option",
  disabled = false,
  size = "default",
  className,
  triggerClassName,
  contentClassName,
  optionClassName,
  id,
  renderOption,
  renderValue,
}: AppSelectProps<T>) {
  const generatedId = React.useId()
  const triggerId = id ?? generatedId
  const selectedOption = options.find((option) => option.value === value)

  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <Label htmlFor={triggerId} className="text-sm font-medium text-slate-700">
          {label}
        </Label>
      ) : null}

      <Select
        value={value}
        onValueChange={(nextValue) => onValueChange(nextValue as T)}
        disabled={disabled}
      >
        <SelectTrigger id={triggerId} size={size} className={cn("w-full", triggerClassName)}>
          <div className="min-w-0 flex-1">
            {triggerLabel ? (
              <span
                className={cn(
                  "mb-1 block truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400",
                  size === "sm" && "mb-0.5 text-[10px]",
                  size === "lg" && "mb-1.5"
                )}
              >
                {triggerLabel}
              </span>
            ) : null}

            <SelectValue placeholder={placeholder}>
              {selectedOption
                ? renderValue?.(selectedOption) ?? (
                    <span
                      className={cn(
                        "block truncate text-sm font-semibold text-slate-900",
                        size === "lg" && "text-base"
                      )}
                    >
                      {selectedOption.label}
                    </span>
                  )
                : undefined}
            </SelectValue>
          </div>
        </SelectTrigger>

        <SelectContent className={contentClassName}>
          {options.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              textValue={option.label}
              disabled={option.disabled}
              className={optionClassName}
            >
              {renderOption?.(option, { selected: option.value === value }) ?? (
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-current">{option.label}</div>
                  {option.description ? (
                    <div className="mt-0.5 truncate text-xs font-normal text-slate-500">
                      {option.description}
                    </div>
                  ) : null}
                </div>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

export { AppSelect }
