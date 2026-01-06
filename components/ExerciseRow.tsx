import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Check, X } from "lucide-react";
import { WorkoutSet, Exercise } from "@/lib/types";
import { secondsToMMSS, mmssToSeconds } from "@/lib/utils";

interface ExerciseRowProps {
  set: WorkoutSet;
  exerciseType: Exercise["type"];
  onWeightChange?: (value: number) => void;
  onRepsChange?: (value: number) => void;
  onDistanceChange?: (value: number) => void;
  onDurationChange?: (value: number) => void;
  onToggleComplete: () => void;
  onDelete: () => void;
}

export function ExerciseRow({ 
  set, 
  exerciseType,
  onWeightChange,
  onRepsChange,
  onDistanceChange,
  onDurationChange,
  onToggleComplete,
  onDelete 
}: ExerciseRowProps) {
  // Use controlled component approach - derive value from props
  const durationDisplayValue = set.duration_seconds !== undefined ? secondsToMMSS(set.duration_seconds) : "0:00";
  const [durationInput, setDurationInput] = useState(durationDisplayValue);
  const [isFocused, setIsFocused] = useState(false);

  const handleDurationFocus = () => {
    setIsFocused(true);
    setDurationInput(durationDisplayValue);
  };

  const handleDurationBlur = () => {
    setIsFocused(false);
    const seconds = mmssToSeconds(durationInput);
    if (onDurationChange) {
      onDurationChange(seconds);
    }
  };

  const handleDurationChange = (value: string) => {
    setDurationInput(value);
  };
  
  // Use prop value when not focused, local state when focused
  const displayValue = isFocused ? durationInput : durationDisplayValue;

  // Determine grid columns based on exercise type
  const getGridCols = () => {
    switch (exerciseType) {
      case "weight_reps":
        return "grid-cols-[50px_1fr_1fr_45px_35px] sm:grid-cols-[60px_1fr_1fr_50px_40px]";
      case "reps_only":
        return "grid-cols-[50px_1fr_45px_35px] sm:grid-cols-[60px_1fr_50px_40px]";
      case "duration":
        return "grid-cols-[50px_1fr_45px_35px] sm:grid-cols-[60px_1fr_50px_40px]";
      case "distance_duration":
        return "grid-cols-[50px_1fr_1fr_45px_35px] sm:grid-cols-[60px_1fr_1fr_50px_40px]";
      default:
        return "grid-cols-[50px_1fr_1fr_45px_35px] sm:grid-cols-[60px_1fr_1fr_50px_40px]";
    }
  };

  // Get weight value (support both old and new field names)
  const getWeightValue = () => {
    return set.weight_kg !== undefined ? set.weight_kg : (set.kg || 0);
  };

  // Get reps value
  const getRepsValue = () => {
    return set.reps !== undefined ? set.reps : 0;
  };

  return (
    <div className={`grid ${getGridCols()} gap-2 sm:gap-3 items-center py-2 border-b border-border last:border-0 w-full`}>
      <div className="text-center font-medium text-foreground text-sm sm:text-base">{set.set_number}</div>

      {/* Weight input for weight_reps */}
      {exerciseType === "weight_reps" && onWeightChange && (
      <Input
        type="number"
          value={getWeightValue()}
          onChange={(e) => onWeightChange(Number(e.target.value))}
        className="h-9 sm:h-10 text-sm sm:text-base text-center focus:ring-2 focus:ring-ring/20 text-foreground"
          placeholder="0"
      />
      )}

      {/* Reps input for weight_reps and reps_only */}
      {(exerciseType === "weight_reps" || exerciseType === "reps_only") && onRepsChange && (
      <Input
        type="number"
          value={getRepsValue()}
        onChange={(e) => onRepsChange(Number(e.target.value))}
        className="h-9 sm:h-10 text-sm sm:text-base text-center focus:ring-2 focus:ring-ring/20 text-foreground"
          placeholder="0"
      />
      )}

      {/* Distance input for distance_duration */}
      {exerciseType === "distance_duration" && onDistanceChange && (
        <Input
          type="number"
          step="0.1"
          value={set.distance_meters || 0}
          onChange={(e) => onDistanceChange(Number(e.target.value))}
          className="h-9 sm:h-10 text-sm sm:text-base text-center focus:ring-2 focus:ring-ring/20 text-foreground"
          placeholder="0"
        />
      )}

      {/* Duration input for duration and distance_duration */}
      {(exerciseType === "duration" || exerciseType === "distance_duration") && onDurationChange && (
        <Input
          type="text"
          value={displayValue}
          onChange={(e) => handleDurationChange(e.target.value)}
          onFocus={handleDurationFocus}
          onBlur={handleDurationBlur}
          className="h-9 sm:h-10 text-sm sm:text-base text-center focus:ring-2 focus:ring-ring/20 text-foreground"
          placeholder="0:00"
          pattern="[0-9]+:[0-5][0-9]"
        />
      )}

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
