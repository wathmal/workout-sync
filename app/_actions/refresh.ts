"use server";

import { updateTag } from "next/cache";
import { HEVY_WORKOUTS_TAG } from "@/lib/hevy/workouts-since";

export async function refreshDashboard(): Promise<void> {
  updateTag(HEVY_WORKOUTS_TAG);
}
