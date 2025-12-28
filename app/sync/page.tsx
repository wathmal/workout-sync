"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, Check, AlertCircle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useWorkout } from "@/contexts/WorkoutContext";
import { WorkoutSummaryCard } from "@/components/WorkoutSummaryCard";
import { syncWorkoutToHevy, formatDuration, formatVolume } from "@/lib/mock-data";
import { format } from "date-fns";

export default function SyncPage() {
  const router = useRouter();
  const { currentWorkout } = useWorkout();
  const [syncState, setSyncState] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showSuccessAlert, setShowSuccessAlert] = useState(true);
  const [showErrorAlert, setShowErrorAlert] = useState(true);

  useEffect(() => {
    if (!currentWorkout) {
      router.push("/");
    }
  }, [currentWorkout, router]);

  const handleSync = async () => {
    if (!currentWorkout) return;
    
    setSyncState('syncing');
    setErrorMessage('');
    setShowSuccessAlert(true);
    setShowErrorAlert(true);
    
    const result = await syncWorkoutToHevy(currentWorkout);
    
    if (result.success) {
      setSyncState('success');
    } else {
      setSyncState('error');
      setErrorMessage(result.error || 'Sync failed');
    }
  };

  const handleDone = () => {
    router.push("/");
  };

  if (!currentWorkout) {
    return null;
  }

  const workoutDate = format(currentWorkout.date, 'MMMM dd, yyyy');
  const workoutTime = format(currentWorkout.date, 'HH:mm');

  return (
    <div className="min-h-screen bg-muted animate-fade-in pb-20">
      {/* Header */}
      <div className="bg-background border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10 safe-top">
        <div className="w-20"></div>
        <h1 className="text-lg font-semibold">Sync Workout</h1>
        <div className="w-20"></div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {/* Workout Summary Card */}
        <Card className="p-6 mb-6 animate-slide-up">
          <div className="mb-4">
            <h2 className="text-2xl font-bold text-foreground mb-1">Workout Summary</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <span>{workoutDate}</span>
              <span>•</span>
              <span>{workoutTime}</span>
            </div>
            {currentWorkout.caption && (
              <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
                {currentWorkout.caption}
              </p>
            )}
          </div>
          
          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4">
            <WorkoutSummaryCard
              label="Duration"
              value={formatDuration(currentWorkout.duration_minutes)}
              className="text-center"
            />
            <WorkoutSummaryCard
              label="Volume"
              value={formatVolume(currentWorkout.total_volume_kg)}
              unit="kg"
              className="text-center"
            />
            <WorkoutSummaryCard
              label="Sets"
              value={currentWorkout.total_sets}
              className="text-center"
            />
          </div>
        </Card>

        {/* Exercise List */}
        <div className="mb-6">
          <h3 className="text-xs text-muted-foreground uppercase tracking-wide mb-3">
            Exercises
          </h3>
          <Card className="divide-y divide-border">
            {currentWorkout.exercises.map((workoutExercise, index) => {
              const exerciseType = workoutExercise.exercise.type;
              
              // Format set display based on exercise type
              const formatSetDisplay = (set: typeof workoutExercise.sets[0]) => {
                switch (exerciseType) {
                  case "weight_reps":
                    const weight = set.weight_kg ?? set.kg ?? 0;
                    const reps = set.reps ?? 0;
                    return `${weight}kg × ${reps} reps`;
                  case "reps_only":
                    const repsOnly = set.reps ?? 0;
                    return `${repsOnly} reps`;
                  case "duration":
                    const duration = set.duration_seconds ?? 0;
                    const mins = Math.floor(duration / 60);
                    const secs = duration % 60;
                    return `${mins}:${secs.toString().padStart(2, "0")}`;
                  case "distance_duration":
                    const distance = set.distance_meters ?? 0;
                    const dur = set.duration_seconds ?? 0;
                    const durMins = Math.floor(dur / 60);
                    const durSecs = dur % 60;
                    return `${distance}m / ${durMins}:${durSecs.toString().padStart(2, "0")}`;
                  default:
                    return "N/A";
                }
              };

              // Get best set summary based on exercise type
              const getBestSetSummary = () => {
                switch (exerciseType) {
                  case "weight_reps":
                    const bestSet = workoutExercise.sets.reduce((max, set) => {
                      const weight = set.weight_kg ?? set.kg ?? 0;
                      const reps = set.reps ?? 0;
                      const maxWeight = max.weight_kg ?? max.kg ?? 0;
                      const maxReps = max.reps ?? 0;
                      return weight * reps > maxWeight * maxReps ? set : max;
                    });
                    const bestWeight = bestSet.weight_kg ?? bestSet.kg ?? 0;
                    const bestReps = bestSet.reps ?? 0;
                    return `Best: ${bestWeight}kg × ${bestReps} reps`;
                  case "reps_only":
                    const bestRepsSet = workoutExercise.sets.reduce((max, set) =>
                      (set.reps ?? 0) > (max.reps ?? 0) ? set : max
                    );
                    return `Best: ${bestRepsSet.reps ?? 0} reps`;
                  case "duration":
                    const bestDurationSet = workoutExercise.sets.reduce((max, set) =>
                      (set.duration_seconds ?? 0) > (max.duration_seconds ?? 0) ? set : max
                    );
                    const bestDur = bestDurationSet.duration_seconds ?? 0;
                    const bestMins = Math.floor(bestDur / 60);
                    const bestSecs = bestDur % 60;
                    return `Best: ${bestMins}:${bestSecs.toString().padStart(2, "0")}`;
                  case "distance_duration":
                    return `${workoutExercise.sets.length} sets`;
                  default:
                    return `${workoutExercise.sets.length} sets`;
                }
              };
              
              return (
                <div key={index} className="p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                      <Dumbbell className="w-5 h-5 text-secondary-foreground" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground">
                        {workoutExercise.exercise.title}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {workoutExercise.sets.length} sets • {getBestSetSummary()}
                      </p>
                    </div>
                  </div>
                  
                  {/* Set Details */}
                  <div className="ml-13 space-y-1">
                    {workoutExercise.sets.map((set, setIndex) => (
                      <div key={setIndex} className="text-sm text-muted-foreground">
                        Set {set.set_number}: {formatSetDisplay(set)}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </Card>
        </div>

        {/* Sync Button */}
        <div className="mb-6">
          {syncState === 'idle' && (
            <Button
              onClick={handleSync}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 rounded-xl text-base font-semibold"
            >
              Sync to Hevy
            </Button>
          )}

          {syncState === 'syncing' && (
            <Button
              disabled
              className="w-full bg-primary text-primary-foreground py-6 rounded-xl text-base font-semibold"
            >
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Syncing...
            </Button>
          )}

          {syncState === 'success' && (
            <Button
              disabled
              className="w-full bg-primary text-primary-foreground py-6 rounded-xl text-base font-semibold"
            >
              <Check className="w-5 h-5 mr-2" />
              Synced
            </Button>
          )}

          {syncState === 'error' && (
            <Button
              onClick={handleSync}
              className="w-full bg-destructive hover:bg-destructive/90 text-destructive-foreground py-6 rounded-xl text-base font-semibold"
            >
              <AlertCircle className="w-5 h-5 mr-2" />
              Retry Sync
            </Button>
          )}
        </div>

        {/* Status Messages */}
        {syncState === 'success' && showSuccessAlert && (
          <Alert className="mb-6 animate-slide-up">
            <Check className="h-4 w-4" />
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <AlertTitle>Successfully synced to Hevy!</AlertTitle>
                <AlertDescription>
                  Your workout has been saved and is now available in Hevy.
                </AlertDescription>
              </div>
              <button
                onClick={() => setShowSuccessAlert(false)}
                className="p-1 rounded-md hover:bg-muted transition-colors"
                aria-label="Dismiss success message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Alert>
        )}

        {syncState === 'error' && errorMessage && showErrorAlert && (
          <Alert variant="destructive" className="mb-6 animate-slide-up">
            <AlertCircle className="h-4 w-4" />
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <AlertTitle>Sync Failed</AlertTitle>
                <AlertDescription>
                  {errorMessage}
                </AlertDescription>
              </div>
              <button
                onClick={() => setShowErrorAlert(false)}
                className="p-1 rounded-md hover:bg-muted transition-colors"
                aria-label="Dismiss error message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Alert>
        )}

        {/* Done Button */}
        <div className="mt-6">
          <Button
            onClick={handleDone}
            variant="outline"
            className="w-full py-6 rounded-xl text-base font-semibold"
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
