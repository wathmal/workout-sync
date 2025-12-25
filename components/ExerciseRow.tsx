import React from "react";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";
import { WorkoutSet } from "@/lib/types";

interface ExerciseRowProps {
  set: WorkoutSet;
  onKgChange: (value: number) => void;
  onRepsChange: (value: number) => void;
  onToggleComplete: () => void;
  onDelete: () => void;
}

export function ExerciseRow({ set, onKgChange, onRepsChange, onToggleComplete, onDelete }: ExerciseRowProps) {
  return (
    <div className="grid grid-cols-[50px_1fr_1fr_45px_35px] sm:grid-cols-[60px_1fr_1fr_50px_40px] gap-2 sm:gap-3 items-center py-2 border-b border-border last:border-0 w-full">
      <div className="text-center font-medium text-foreground text-sm sm:text-base">{set.set_number}</div>

      <Input
        type="number"
        value={set.kg}
        onChange={(e) => onKgChange(Number(e.target.value))}
        className="h-9 sm:h-10 text-sm sm:text-base text-center focus:ring-2 focus:ring-ring/20 text-foreground"
      />

      <Input
        type="number"
        value={set.reps}
        onChange={(e) => onRepsChange(Number(e.target.value))}
        className="h-9 sm:h-10 text-sm sm:text-base text-center focus:ring-2 focus:ring-ring/20 text-foreground"
      />

      <button
        onClick={onToggleComplete}
        className={`w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center transition-colors flex-shrink-0 ${
          set.completed
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-muted-foreground hover:bg-secondary/80"
        }`}
      >
        <Check className="w-4 h-4 sm:w-5 sm:h-5" />
      </button>
      
      {/* Delete Button */}
      <button
        onClick={onDelete}
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-md flex items-center justify-center hover:bg-destructive/10 transition-colors flex-shrink-0"
        title="Delete set"
      >
        <X className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
      </button>
    </div>
  );
}
