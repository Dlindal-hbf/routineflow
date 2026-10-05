"use client";

import { useState, type ComponentProps } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface PasswordFieldProps extends Omit<ComponentProps<"input">, "type" | "id" | "name"> {
  id: string;
  name: "password" | "confirmPassword";
  label: string;
  error?: string;
  hint?: string;
}

export function PasswordField({ id, name, label, error, hint, disabled, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const descriptions = [hint && `${id}-hint`, error && `${id}-error`, props["aria-describedby"]].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-slate-800">{label}</Label>
      <div className="relative">
        <Input {...props} id={id} name={name} type={visible ? "text" : "password"} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={descriptions} className="h-11 pr-12 text-[16px] outline-none disabled:opacity-60 aria-invalid:border-red-700" />
        <Button type="button" variant="ghost" size="icon" disabled={disabled} aria-label={`${visible ? "Skjul" : "Vis"} ${label.toLocaleLowerCase("nb")}`} aria-pressed={visible} aria-controls={id} onClick={() => setVisible(!visible)} className="absolute inset-y-0 right-0 h-11 w-11 text-slate-600 hover:bg-stone-100">
          {visible ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
        </Button>
      </div>
      {hint && <p id={`${id}-hint`} className="text-xs leading-relaxed text-slate-500">{hint}</p>}
      <div aria-live="polite" aria-atomic="true">
        {error && <p id={`${id}-error`} className="text-sm text-red-800">{error}</p>}
      </div>
    </div>
  );
}

export default PasswordField;
