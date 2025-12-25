"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, ZoomIn, ZoomOut, Maximize2, Clock, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useWorkout } from "@/contexts/WorkoutContext";
import { WorkoutSummaryCard } from "@/components/WorkoutSummaryCard";
import { ExerciseCard } from "@/components/ExerciseCard";
import { WorkoutExercise, Exercise, DuplicateWorkoutInfo } from "@/lib/types";
import { calculateWorkoutMetrics, formatVolume } from "@/lib/mock-data";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ExerciseSearchCombobox } from "@/components/ExerciseSearchCombobox";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { checkForDuplicateWorkout } from "@/lib/hevy-api";

export default function ReviewPage() {
  const router = useRouter();
  const { 
    processedExercises, 
    setProcessedExercises, 
    setCurrentWorkout, 
    uploadedImage, 
    caption, 
    setCaption,
    extractedWorkoutDate,
    extractedWorkoutTime,
  } = useWorkout();
  const [exercises, setExercises] = useState<WorkoutExercise[]>(processedExercises);
  const [durationMinutes, setDurationMinutes] = useState(45); // Fixed at 45 minutes
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [workoutDate, setWorkoutDate] = useState<Date>(extractedWorkoutDate || new Date());
  const [workoutTime, setWorkoutTime] = useState<string>(extractedWorkoutTime || "08:00");
  const [isAddingExercise, setIsAddingExercise] = useState(false);
  
  // Duplicate workout check state
  const [duplicateWorkout, setDuplicateWorkout] = useState<DuplicateWorkoutInfo | null>(null);
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(true);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (processedExercises.length === 0) {
      router.push("/");
    } else {
      setExercises(processedExercises);
    }
  }, [processedExercises, router]);

  // Create image preview URL from uploaded file
  useEffect(() => {
    if (uploadedImage) {
      const url = URL.createObjectURL(uploadedImage);
      setImagePreviewUrl(url);
      
      // Cleanup URL when component unmounts
      return () => URL.revokeObjectURL(url);
    }
  }, [uploadedImage]);

  // Function to perform duplicate check
  const performDuplicateCheck = async () => {
    setDuplicateWorkout(null);
    setShowDuplicateWarning(true);

    try {
      // Pass only the date (without time) to check for duplicates
      const result = await checkForDuplicateWorkout(workoutDate);

      if (result.hasDuplicate && result.duplicateWorkout) {
        setDuplicateWorkout(result.duplicateWorkout);
      }
    } catch (error) {
      console.error("Error checking for duplicate workout:", error);
      // Fail silently - don't block the user
    }
  };

  // Check for duplicates on mount
  useEffect(() => {
    performDuplicateCheck();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Check for duplicates when date or time changes (with debouncing)
  useEffect(() => {
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      performDuplicateCheck();
    }, 300);

    // Cleanup on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workoutDate, workoutTime]);

  const handleUpdateSet = (exerciseIndex: number, setIndex: number, field: "kg" | "reps" | "completed", value: number | boolean) => {
    const updatedExercises = [...exercises];
    if (field === "kg" || field === "reps") {
      updatedExercises[exerciseIndex].sets[setIndex][field] = value as number;
    } else if (field === "completed") {
      updatedExercises[exerciseIndex].sets[setIndex].completed = value as boolean;
    }
    setExercises(updatedExercises);
    setProcessedExercises(updatedExercises);
  };

  const handleUpdateNotes = (exerciseIndex: number, notes: string) => {
    const updatedExercises = [...exercises];
    updatedExercises[exerciseIndex].notes = notes;
    setExercises(updatedExercises);
    setProcessedExercises(updatedExercises);
  };

  const handleAddSet = (exerciseIndex: number) => {
    const updatedExercises = [...exercises];
    const exercise = updatedExercises[exerciseIndex];
    const lastSet = exercise.sets[exercise.sets.length - 1];
    
    exercise.sets.push({
      set_number: exercise.sets.length + 1,
      kg: lastSet.kg,
      reps: lastSet.reps,
      previous_kg: lastSet.kg,
      previous_reps: lastSet.reps,
      completed: false,
    });
    
    setExercises(updatedExercises);
    setProcessedExercises(updatedExercises);
  };

  const handleDeleteSet = (exerciseIndex: number, setIndex: number) => {
    const updatedExercises = [...exercises];
    const exercise = updatedExercises[exerciseIndex];
    
    // Don't allow deleting the last set
    if (exercise.sets.length <= 1) {
      alert("Cannot delete the last set. Delete the exercise instead.");
      return;
    }
    
    // Remove the set
    exercise.sets.splice(setIndex, 1);
    
    // Renumber remaining sets
    exercise.sets.forEach((set, index) => {
      set.set_number = index + 1;
    });
    
    setExercises(updatedExercises);
    setProcessedExercises(updatedExercises);
  };

  const handleExerciseChange = (exerciseIndex: number, newExercise: Exercise) => {
    const updatedExercises = [...exercises];
    // Update exercise, keep all existing sets data
    updatedExercises[exerciseIndex].exercise = newExercise;
    setExercises(updatedExercises);
    setProcessedExercises(updatedExercises);
  };

  const handleDeleteExercise = (exerciseIndex: number) => {
    if (confirm("Delete this exercise?")) {
      const updated = exercises.filter((_, i) => i !== exerciseIndex);
      setExercises(updated);
      setProcessedExercises(updated);
    }
  };

  const handleAddExercise = (exercise: Exercise) => {
    const newExercise: WorkoutExercise = {
      exercise,
      sets: Array.from({ length: 3 }, (_, i) => ({
        set_number: i + 1,
        kg: 0,
        reps: 0,
        previous_kg: 0,
        previous_reps: 0,
        completed: false,
      })),
      notes: "",
      rest_timer_enabled: false,
    };
    
    const updated = [...exercises, newExercise];
    setExercises(updated);
    setProcessedExercises(updated);
    setIsAddingExercise(false);
  };

  const handleFinish = () => {
    // Combine date and time
    const [hours, minutes] = workoutTime.split(':').map(Number);
    const combinedDate = new Date(workoutDate);
    combinedDate.setHours(hours, minutes, 0, 0);
    
    // Calculate metrics
    const metrics = calculateWorkoutMetrics(exercises);
    
    // Create workout object
    const workout = {
      id: `workout-${Date.now()}`,
      duration_minutes: durationMinutes,
      total_volume_kg: metrics.total_volume_kg,
      total_sets: metrics.total_sets,
      exercises,
      date: combinedDate, // Now includes the time
      caption: caption,
      sync_to_hevy: true,
      share_to_instagram: false,
    };
    
    setCurrentWorkout(workout);
    router.push("/sync");
  };

  const handleDiscard = () => {
    if (confirm("Are you sure you want to discard this workout?")) {
      router.push("/");
    }
  };

  // Calculate current metrics
  const currentMetrics = calculateWorkoutMetrics(exercises);

  return (
    <div className="min-h-screen bg-muted pb-20 animate-fade-in">
      {/* Header */}
      <div className="bg-background border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10 safe-top">
        <div className="w-20"></div>
        <h1 className="text-lg font-semibold">Log Workout</h1>
        <div className="w-20"></div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 max-w-7xl mx-auto px-0">
        {/* Main Content - Left Side */}
        <div className="flex-1 p-4 lg:p-6 max-w-2xl mx-auto lg:mx-0 w-full min-w-0">
        
        {/* Duplicate Workout Warning Banner */}
        {duplicateWorkout && showDuplicateWarning && (
          <Alert className="mb-4 animate-slide-down">
            <AlertTriangle className="h-4 w-4" />
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <AlertTitle>Duplicate Workout Detected</AlertTitle>
                <AlertDescription>
                  A workout already exists for{" "}
                  <span className="font-semibold">
                    {format(duplicateWorkout.date, "MMM dd, yyyy")}
                  </span>{" "}
                  at{" "}
                  <span className="font-semibold">{duplicateWorkout.time}</span>{" "}
                  named{" "}
                  <span className="font-semibold">&ldquo;{duplicateWorkout.name}&rdquo;</span>
                </AlertDescription>
              </div>
              <button
                onClick={() => setShowDuplicateWarning(false)}
                className="p-1 rounded-md hover:bg-muted transition-colors"
                aria-label="Dismiss warning"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Alert>
        )}
        {/* Summary Cards - Top Row: Duration, Date, Time */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-4 mb-4">
          <div className="flex flex-col text-center min-w-0">
            <span className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Duration</span>
            {isEditingDuration ? (
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                onBlur={() => setIsEditingDuration(false)}
                className="text-xl sm:text-2xl font-semibold text-foreground text-center bg-transparent border-b-2 border-foreground focus:outline-none w-12 sm:w-16 mx-auto"
                autoFocus
              />
            ) : (
              <button
                onClick={() => setIsEditingDuration(true)}
                className="text-xl sm:text-2xl font-semibold text-foreground hover:text-foreground/80 truncate"
              >
                {durationMinutes}m
              </button>
            )}
          </div>
          <div className="flex flex-col text-center min-w-0">
            <span className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Date</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  className="text-xl sm:text-2xl font-semibold text-foreground hover:text-foreground/80 h-auto p-0 truncate"
                >
                  {format(workoutDate, "MMM dd")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="center">
                <Calendar
                  mode="single"
                  selected={workoutDate}
                  onSelect={(date) => date && setWorkoutDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex flex-col text-center min-w-0">
            <span className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Time</span>
            <div className="flex items-center justify-center gap-1 sm:gap-2">
              <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
              <Input
                type="time"
                value={workoutTime}
                onChange={(e) => setWorkoutTime(e.target.value)}
                className="w-20 sm:w-28 text-center text-sm sm:text-lg font-semibold text-foreground border-none p-0 h-auto focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          </div>
        </div>

        {/* Summary Cards - Bottom Row: Volume, Sets */}
        <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-6">
          <WorkoutSummaryCard
            label="Volume"
            value={formatVolume(currentMetrics.total_volume_kg)}
            unit="kg"
            className="text-center"
          />
          <WorkoutSummaryCard
            label="Sets"
            value={currentMetrics.total_sets}
            className="text-center"
          />
        </div>

        {/* Exercise Cards */}
        {exercises.map((exercise, index) => (
          <ExerciseCard
            key={index}
            workoutExercise={exercise}
            onUpdateSet={(setIndex, field, value) => handleUpdateSet(index, setIndex, field, value)}
            onUpdateNotes={(notes) => handleUpdateNotes(index, notes)}
            onAddSet={() => handleAddSet(index)}
            onExerciseChange={(newExercise) => handleExerciseChange(index, newExercise)}
            onDelete={() => handleDeleteExercise(index)}
            onDeleteSet={(setIndex) => handleDeleteSet(index, setIndex)}
          />
        ))}

        {/* Add Exercise Section */}
        {isAddingExercise ? (
          <Card className="p-4 mb-4 animate-slide-up">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-foreground">Add Exercise</h3>
              <button
                onClick={() => setIsAddingExercise(false)}
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>
            <ExerciseSearchCombobox
              currentExerciseTitle=""
              onExerciseSelect={handleAddExercise}
            />
          </Card>
        ) : (
          <Button
            onClick={() => setIsAddingExercise(true)}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 rounded-xl text-base font-semibold mb-4"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Exercise
          </Button>
        )}

        {/* Workout Caption */}
        <div className="mb-6">
          <label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
            Workout Description
          </label>
          <Textarea
            placeholder="Add a note about this workout..."
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="resize-none bg-background text-foreground placeholder:text-muted-foreground"
            rows={3}
          />
          <p className="text-xs text-muted-foreground mt-2">
            This will be synced to Hevy as your workout description
          </p>
        </div>

        {/* Finish Button */}
        <Button
          onClick={handleFinish}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 rounded-xl text-base font-semibold mb-4"
        >
          Finish Workout
        </Button>

        {/* Bottom Actions */}
        <div className="flex gap-4">
          <Button
            variant="destructive"
            onClick={handleDiscard}
            className="flex-1 py-6 rounded-xl bg-background text-base"
          >
            Discard Workout
          </Button>
        </div>
        </div>

        {/* Image Preview - Right Side (Desktop Only) */}
        {imagePreviewUrl && (
          <div className="hidden lg:block w-80 xl:w-96 p-4 pr-6">
            <div className="sticky top-20">
              <div className="bg-background rounded-lg shadow-lg overflow-hidden border border-border">
                <div className="p-3 bg-muted border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">Uploaded Image</h3>
                </div>
                <div className="aspect-[3/4] relative bg-secondary">
                  <TransformWrapper
                    initialScale={1}
                    minScale={0.5}
                    maxScale={4}
                    centerOnInit={true}
                    wheel={{ step: 0.3 }}
                    doubleClick={{ mode: "reset" }}
                  >
                    {({ zoomIn, zoomOut, resetTransform }) => (
                      <>
                        {/* Zoom Controls */}
                        <div className="absolute top-2 right-2 z-10 flex flex-col gap-1">
                          <button
                            onClick={() => zoomIn()}
                            className="w-8 h-8 bg-background/90 hover:bg-background rounded-md shadow-md flex items-center justify-center transition-colors border border-border"
                            title="Zoom In"
                          >
                            <ZoomIn className="w-4 h-4 text-foreground" />
                          </button>
                          <button
                            onClick={() => zoomOut()}
                            className="w-8 h-8 bg-background/90 hover:bg-background rounded-md shadow-md flex items-center justify-center transition-colors border border-border"
                            title="Zoom Out"
                          >
                            <ZoomOut className="w-4 h-4 text-foreground" />
                          </button>
                          <button
                            onClick={() => resetTransform()}
                            className="w-8 h-8 bg-background/90 hover:bg-background rounded-md shadow-md flex items-center justify-center transition-colors border border-border"
                            title="Reset Zoom"
                          >
                            <Maximize2 className="w-4 h-4 text-foreground" />
                          </button>
                        </div>
                        {/* Image */}
                        <TransformComponent
                          wrapperClass="!w-full !h-full"
                          contentClass="!w-full !h-full"
                        >
                          <img
                            src={imagePreviewUrl}
                            alt="Workout upload"
                            className="w-full h-full object-contain cursor-grab active:cursor-grabbing"
                          />
                        </TransformComponent>
                      </>
                    )}
                  </TransformWrapper>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

