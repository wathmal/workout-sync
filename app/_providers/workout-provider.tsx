"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";
import { Workout, WorkoutExercise } from "@/lib/types";

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
