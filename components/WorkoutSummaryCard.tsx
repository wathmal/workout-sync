import React from "react";
import { Card } from "@/components/ui/card";

interface WorkoutSummaryCardProps {
  label: string;
  value: string | number;
  unit?: string;
  className?: string;
}

export function WorkoutSummaryCard({ label, value, unit, className }: WorkoutSummaryCardProps) {
  return (
    <div className={`flex flex-col items-center min-w-0 ${className}`}>
      <span className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className="text-xl sm:text-2xl font-semibold text-foreground truncate">{value}</span>
        {unit && <span className="text-sm text-muted-foreground flex-shrink-0">{unit}</span>}
      </div>
    </div>
  );
}

