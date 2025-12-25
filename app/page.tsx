"use client";

import React, { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, AlertCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useWorkout } from "@/contexts/WorkoutContext";
import { processWorkoutImage } from "@/lib/mock-data";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  
  const {
    uploadedImage,
    setUploadedImage,
    setProcessedExercises,
    setExtractedWorkoutDate,
    setExtractedWorkoutTime,
  } = useWorkout();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedImage(file);
      setError(null); // Clear any previous errors
      setIsUsingFallback(false);
      // Clear previous extracted date/time - will be set from server response
      setExtractedWorkoutDate(null);
      setExtractedWorkoutTime(null);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleCompleteUpload = async () => {
    if (!uploadedImage) {
      setError("Please upload a photo first");
      return;
    }

    setIsProcessing(true);
    setError(null);
    setIsUsingFallback(false);
    
    try {
      // Process the image (server extracts date from EXIF)
      const result = await processWorkoutImage(uploadedImage);
      setProcessedExercises(result.exercises);
      
      // Set extracted date/time from server response
      if (result.workoutStartDate && result.workoutStartTime) {
        setExtractedWorkoutDate(result.workoutStartDate);
        setExtractedWorkoutTime(result.workoutStartTime);
      } else {
        setExtractedWorkoutDate(null);
        setExtractedWorkoutTime(null);
      }
      
      // Check if we're using fallback data
      if (result.exercises.length === 1 && result.exercises[0].exercise.title === "Push Press" && result.exercises[0].sets.length === 5) {
        setIsUsingFallback(true);
      }
      
      // Navigate to review page
      router.push("/review");
    } catch (error) {
      console.error("Error processing image:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      // Set user-friendly error message
      if (errorMessage.includes("API key") || errorMessage.includes("configuration")) {
        setError("API not configured. Please add your GROQ_API_KEY to continue, or use mock data.");
      } else if (errorMessage.includes("rate limit")) {
        setError("Rate limit exceeded. Please wait a moment and try again.");
      } else if (errorMessage.includes("network") || errorMessage.includes("fetch")) {
        setError("Network error. Please check your connection and try again.");
      } else if (errorMessage.includes("Invalid file")) {
        setError(errorMessage);
      } else if (errorMessage.includes("size exceeds")) {
        setError(errorMessage);
      } else {
        setError("Failed to process image: " + errorMessage);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDiscard = () => {
    setUploadedImage(null);
    setExtractedWorkoutDate(null);
    setExtractedWorkoutTime(null);
  };

  return (
    <div className="min-h-screen bg-muted animate-fade-in">
      {/* Header */}
      <div className="bg-background border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-10 safe-top">
        <div className="w-20"></div>
        <h1 className="text-lg font-semibold">Upload Photo</h1>
        <div className="w-20"></div>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {/* Error Message */}
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <div className="flex items-start justify-between gap-2">
              <AlertDescription>{error}</AlertDescription>
              <button
                onClick={() => setError(null)}
                className="p-1 rounded-md hover:bg-muted transition-colors"
                aria-label="Dismiss error"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Alert>
        )}

        {/* Fallback Warning */}
        {isUsingFallback && (
          <Alert className="mb-4">
            <Info className="h-4 w-4" />
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <AlertDescription>
                  Using sample data. Add your GROQ_API_KEY to process real workout images.{" "}
                  <a
                    href="https://console.groq.com/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:no-underline"
                  >
                    Get API Key →
                  </a>
                </AlertDescription>
              </div>
              <button
                onClick={() => setIsUsingFallback(false)}
                className="p-1 rounded-md hover:bg-muted transition-colors"
                aria-label="Dismiss warning"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </Alert>
        )}

        {/* Upload Area */}
        <div className="mb-6">
          <label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
            Workout Screenshot
          </label>
          
          <button
            onClick={handleUploadClick}
            className="w-full border-2 border-dashed border-input rounded-2xl bg-background p-12 flex flex-col items-center justify-center hover:border-border hover:bg-muted/50 transition-all active:scale-[0.98] min-h-[280px]"
          >
            <div className="w-20 h-20 rounded-full bg-secondary flex items-center justify-center mb-4">
              <Camera className="w-10 h-10 text-secondary-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Tap to upload</h3>
            <p className="text-sm text-muted-foreground">Take a photo or select from library</p>
            
            {uploadedImage && (
              <div className="mt-4 text-sm text-muted-foreground font-medium">
                ✓ {uploadedImage.name}
              </div>
            )}
          </button>
          
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <p className="text-xs text-muted-foreground text-center mt-3">
            Upload a screenshot or photo of your workout summary from the gym.
          </p>
        </div>

        {/* How it Works Section */}
        <div className="mb-6 p-6 bg-background rounded-2xl shadow-sm">
          <h3 className="font-semibold text-foreground mb-4">How it works</h3>
          <div className="space-y-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-semibold flex-shrink-0">
                1
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Upload a photo of your workout screen from the gym</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-semibold flex-shrink-0">
                2
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Review and edit exercises, add/remove sets, set date and time</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center font-semibold flex-shrink-0">
                3
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Add a caption and sync to your Hevy account with one tap</p>
              </div>
            </div>
          </div>
        </div>

        {/* Complete Upload Button */}
        <Button
          onClick={handleCompleteUpload}
          disabled={!uploadedImage || isProcessing}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-6 rounded-xl text-base font-semibold mb-4"
        >
          {isProcessing ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-xl animate-spin mr-2" />
              Processing...
            </>
          ) : (
            <>
              Upload
            </>
          )}
        </Button>

        {/* Discard */}
        {uploadedImage && (
          <Button
            onClick={handleDiscard}
            variant="destructive"
            className="w-full py-6 rounded-xl text-base font-semibold"
          >
            Discard
          </Button>
        )}
        </div>
    </div>
  );
}
