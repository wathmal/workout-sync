import React from "react";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dumbbell, Info, Trash2 } from "lucide-react";
import { WorkoutExercise, Exercise } from "@/lib/types";
import { ExerciseRow } from "./ExerciseRow";
import { ExerciseSearchCombobox } from "./ExerciseSearchCombobox";

interface ExerciseCardProps {
  workoutExercise: WorkoutExercise;
  onUpdateSet: (setIndex: number, field: "kg" | "reps" | "distance" | "duration" | "completed", value: number | boolean) => void;
  onUpdateNotes: (notes: string) => void;
  onAddSet: () => void;
  onExerciseChange: (newExercise: Exercise) => void;
  onDelete: () => void;
  onDeleteSet: (setIndex: number) => void;
}

export function ExerciseCard({ workoutExercise, onUpdateSet, onUpdateNotes, onAddSet, onExerciseChange, onDelete, onDeleteSet }: ExerciseCardProps) {
  return (
    <Card className="p-4 mb-4 animate-slide-up overflow-hidden">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
          <Dumbbell className="w-5 h-5 text-secondary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <ExerciseSearchCombobox
            currentExerciseTitle={workoutExercise.exercise.title}
            onExerciseSelect={onExerciseChange}
          />
        </div>
        <button
          onClick={onDelete}
          className="p-2 hover:bg-destructive/10 rounded-md transition-colors"
          title="Delete exercise"
        >
          <Trash2 className="w-4 h-4 text-destructive" />
        </button>
      </div>

      {/* Notes hidden per user request */}
      
      <div className="flex items-center gap-2 mb-4 text-muted-foreground text-sm hidden">
        <Info className="w-4 h-4" />
        <span>Rest Timer: OFF</span>
      </div>

      <div className="mb-3 -mx-4 px-4">
        {(() => {
          const exerciseType = workoutExercise.exercise.type;
          const getHeaderCols = () => {
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

          const getHeaders = () => {
            switch (exerciseType) {
              case "weight_reps":
                return (
                  <>
                    <div className="text-center">SET</div>
                    <div className="text-center">KG</div>
                    <div className="text-center">REPS</div>
                    <div></div>
                    <div></div>
                  </>
                );
              case "reps_only":
                return (
                  <>
                    <div className="text-center">SET</div>
                    <div className="text-center">REPS</div>
                    <div></div>
                    <div></div>
                  </>
                );
              case "duration":
                return (
                  <>
                    <div className="text-center">SET</div>
                    <div className="text-center">TIME</div>
                    <div></div>
                    <div></div>
                  </>
                );
              case "distance_duration":
                return (
                  <>
                    <div className="text-center">SET</div>
                    <div className="text-center">DISTANCE (m)</div>
                    <div className="text-center">TIME</div>
                    <div></div>
                    <div></div>
                  </>
                );
              default:
                return (
                  <>
                    <div className="text-center">SET</div>
                    <div className="text-center">KG</div>
                    <div className="text-center">REPS</div>
                    <div></div>
                    <div></div>
                  </>
                );
            }
          };

          return (
            <>
              <div className={`grid ${getHeaderCols()} gap-2 sm:gap-3 pb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide w-full`}>
                {getHeaders()}
              </div>

              {workoutExercise.sets.map((set, index) => (
                <ExerciseRow
                  key={index}
                  set={set}
                  exerciseType={exerciseType}
                  onWeightChange={exerciseType === "weight_reps" ? (value) => onUpdateSet(index, "kg", value) : undefined}
                  onRepsChange={(exerciseType === "weight_reps" || exerciseType === "reps_only") ? (value) => onUpdateSet(index, "reps", value) : undefined}
                  onDistanceChange={exerciseType === "distance_duration" ? (value) => onUpdateSet(index, "distance", value) : undefined}
                  onDurationChange={(exerciseType === "duration" || exerciseType === "distance_duration") ? (value) => onUpdateSet(index, "duration", value) : undefined}
                  onToggleComplete={() => onUpdateSet(index, "completed", !set.completed)}
                  onDelete={() => onDeleteSet(index)}
                />
              ))}
            </>
          );
        })()}
      </div>

      <button
        onClick={onAddSet}
        className="w-full py-2 text-muted-foreground text-sm font-medium hover:bg-muted rounded-md transition-colors"
      >
        + Add Set
      </button>
    </Card>
  );
}

