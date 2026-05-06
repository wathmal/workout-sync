"use client";

import React from "react";

/**
 * Number input that:
 *   - Renders empty (with a "0" placeholder) when the value is 0, so a
 *     user can backspace and start typing without ending up with "0X".
 *   - Selects the current text on focus so tab-in / click-to-edit
 *     replaces the value cleanly.
 *   - Reports `Number(value || 0)` on every change.
 *
 * The 4 set-row cells (weight, reps, distance, second-cell reps) all
 * shared the same handlers; this consolidates them.
 */

type NumberInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type"
> & {
  value: number;
  onValueChange: (n: number) => void;
};

export function NumberInput({
  value,
  onValueChange,
  inputMode = "decimal",
  placeholder = "0",
  onFocus,
  ...rest
}: NumberInputProps) {
  return (
    <input
      type="number"
      inputMode={inputMode}
      value={value === 0 ? "" : value}
      onFocus={(e) => {
        e.currentTarget.select();
        onFocus?.(e);
      }}
      onChange={(e) => onValueChange(Number(e.target.value || 0))}
      placeholder={placeholder}
      {...rest}
    />
  );
}
