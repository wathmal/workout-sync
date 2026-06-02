/**
 * Body measurement fields that sync 1:1 with Hevy's bodyMeasurements API.
 * Keys mirror Hevy snake_case (converted to camelCase here) so a payload
 * round-trip is a straight rename.
 *
 * Hevy spec keys (reference):
 *   date, weight_kg, lean_mass_kg, fat_percent,
 *   neck_cm, shoulder_cm, chest_cm,
 *   left_bicep_cm, right_bicep_cm,
 *   left_forearm_cm, right_forearm_cm,
 *   abdomen, waist, hips,
 *   left_thigh, right_thigh,
 *   left_calf, right_calf
 */
export interface BodyMeasurementsInput {
  weightKg: number | null;
  leanMassKg: number | null;
  fatPercent: number | null;

  neckCm: number | null;
  shoulderCm: number | null;
  chestCm: number | null;

  leftBicepCm: number | null;
  rightBicepCm: number | null;
  leftForearmCm: number | null;
  rightForearmCm: number | null;

  abdomenCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;

  leftThighCm: number | null;
  rightThighCm: number | null;
  leftCalfCm: number | null;
  rightCalfCm: number | null;

  measuredAt: string;
}

export const SAMPLE_BASELINE_INPUT: BodyMeasurementsInput = {
  weightKg: 68.0,
  leanMassKg: 49.6,
  fatPercent: 27.0,
  neckCm: 38,
  shoulderCm: 115,
  chestCm: 95,
  leftBicepCm: 35,
  rightBicepCm: 35.5,
  leftForearmCm: 28,
  rightForearmCm: 28.5,
  abdomenCm: 85,
  waistCm: 80,
  hipsCm: 95,
  leftThighCm: 55,
  rightThighCm: 55.5,
  leftCalfCm: 37,
  rightCalfCm: 37.5,
  measuredAt: new Date().toISOString().slice(0, 10),
};
