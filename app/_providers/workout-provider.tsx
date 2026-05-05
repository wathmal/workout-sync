"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { Workout, WorkoutExercise } from "@/lib/types";

export interface SyncedWorkoutSummary {
  date: Date;
  time: string | null;
  duration_minutes: number;
  total_volume_kg: number;
  total_sets: number;
  exercises: WorkoutExercise[];
  caption?: string;
  hevy_url?: string;
}

interface WorkoutContextType {
  currentWorkout: Workout | null;
  setCurrentWorkout: (workout: Workout | null) => void;
  uploadedImage: File | null;
  setUploadedImage: (image: File | null) => void;
  processedExercises: WorkoutExercise[];
  setProcessedExercises: (exercises: WorkoutExercise[]) => void;
  caption: string;
  setCaption: (caption: string) => void;
  extractedWorkoutDate: Date | null;
  setExtractedWorkoutDate: (date: Date | null) => void;
  extractedWorkoutTime: string | null;
  setExtractedWorkoutTime: (time: string | null) => void;
  detectionModel: string | null;
  setDetectionModel: (m: string | null) => void;
  detectionConfidence: number | null;
  setDetectionConfidence: (c: number | null) => void;
  lastSyncedWorkout: SyncedWorkoutSummary | null;
  setLastSyncedWorkout: (s: SyncedWorkoutSummary | null) => void;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [currentWorkout, setCurrentWorkout] = useState<Workout | null>(null);
  const [uploadedImage, setUploadedImage] = useState<File | null>(null);
  const [processedExercises, setProcessedExercises] = useState<WorkoutExercise[]>([]);
  const [caption, setCaption] = useState("");
  const [extractedWorkoutDate, setExtractedWorkoutDate] = useState<Date | null>(null);
  const [extractedWorkoutTime, setExtractedWorkoutTime] = useState<string | null>(null);
  const [detectionModel, setDetectionModel] = useState<string | null>(null);
  const [detectionConfidence, setDetectionConfidence] = useState<number | null>(null);
  const [lastSyncedWorkout, setLastSyncedWorkout] = useState<SyncedWorkoutSummary | null>(null);

  return (
    <WorkoutContext.Provider
      value={{
        currentWorkout,
        setCurrentWorkout,
        uploadedImage,
        setUploadedImage,
        processedExercises,
        setProcessedExercises,
        caption,
        setCaption,
        extractedWorkoutDate,
        setExtractedWorkoutDate,
        extractedWorkoutTime,
        setExtractedWorkoutTime,
        detectionModel,
        setDetectionModel,
        detectionConfidence,
        setDetectionConfidence,
        lastSyncedWorkout,
        setLastSyncedWorkout,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const context = useContext(WorkoutContext);
  if (context === undefined) {
    throw new Error("useWorkout must be used within a WorkoutProvider");
  }
  return context;
}
