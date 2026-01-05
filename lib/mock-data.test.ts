/**
 * Test suite for workout metrics calculation
 * Tests calculateWorkoutMetrics for all exercise types
 */

import { calculateWorkoutMetrics } from './mock-data';
import { WorkoutExercise, Exercise, WorkoutSet } from './types';

describe('Workout Metrics Calculation', () => {
  describe('weight_reps exercise type', () => {
    it('should calculate volume and count sets for weight_reps exercises', () => {
      const exercise: Exercise = {
        id: '1',
        title: 'Bench Press',
        type: 'weight_reps',
        primary_muscle_group: 'chest',
        secondary_muscle_groups: [],
        is_custom: false,
      };

      const sets: WorkoutSet[] = [
        { set_number: 1, weight_kg: 100, reps: 10, completed: false },
        { set_number: 2, weight_kg: 100, reps: 8, completed: false },
        { set_number: 3, weight_kg: 90, reps: 12, completed: false },
      ];

      const workoutExercise: WorkoutExercise = {
        exercise,
        sets,
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([workoutExercise]);

      expect(metrics.total_volume_kg).toBe(100 * 10 + 100 * 8 + 90 * 12); // 1000 + 800 + 1080 = 2880
      expect(metrics.total_sets).toBe(3);
    });

    it('should use legacy kg field for backward compatibility', () => {
      const exercise: Exercise = {
        id: '1',
        title: 'Squat',
        type: 'weight_reps',
        primary_muscle_group: 'legs',
        secondary_muscle_groups: [],
        is_custom: false,
      };

      const sets: WorkoutSet[] = [
        { set_number: 1, kg: 80, reps: 10, completed: false },
        { set_number: 2, kg: 80, reps: 8, completed: false },
      ];

      const workoutExercise: WorkoutExercise = {
        exercise,
        sets,
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([workoutExercise]);

      expect(metrics.total_volume_kg).toBe(80 * 10 + 80 * 8); // 800 + 640 = 1440
      expect(metrics.total_sets).toBe(2);
    });

    it('should prefer weight_kg over kg when both are present', () => {
      const exercise: Exercise = {
        id: '1',
        title: 'Deadlift',
        type: 'weight_reps',
        primary_muscle_group: 'back',
        secondary_muscle_groups: [],
        is_custom: false,
      };

      const sets: WorkoutSet[] = [
        { set_number: 1, weight_kg: 150, kg: 100, reps: 5, completed: false },
      ];

      const workoutExercise: WorkoutExercise = {
        exercise,
        sets,
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([workoutExercise]);

      expect(metrics.total_volume_kg).toBe(150 * 5); // 750, not 500
      expect(metrics.total_sets).toBe(1);
    });

    it('should exclude sets with zero weight or zero reps', () => {
      const exercise: Exercise = {
        id: '1',
        title: 'Bench Press',
        type: 'weight_reps',
        primary_muscle_group: 'chest',
        secondary_muscle_groups: [],
        is_custom: false,
      };

      const sets: WorkoutSet[] = [
        { set_number: 1, weight_kg: 100, reps: 10, completed: false },
        { set_number: 2, weight_kg: 0, reps: 8, completed: false },
        { set_number: 3, weight_kg: 90, reps: 0, completed: false },
        { set_number: 4, weight_kg: 0, reps: 0, completed: false },
        { set_number: 5, weight_kg: 80, reps: 12, completed: false },
      ];

      const workoutExercise: WorkoutExercise = {
        exercise,
        sets,
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([workoutExercise]);

      expect(metrics.total_volume_kg).toBe(100 * 10 + 80 * 12); // 1000 + 960 = 1960
      expect(metrics.total_sets).toBe(2);
    });
  });

  describe('reps_only exercise type', () => {
    it('should count sets with reps > 0 for reps_only exercises', () => {
      const exercise: Exercise = {
        id: '2',
        title: 'Push-ups',
        type: 'reps_only',
        primary_muscle_group: 'chest',
        secondary_muscle_groups: [],
        is_custom: false,
      };

      const sets: WorkoutSet[] = [
        { set_number: 1, reps: 20, completed: false },
        { set_number: 2, reps: 15, completed: false },
        { set_number: 3, reps: 12, completed: false },
      ];

      const workoutExercise: WorkoutExercise = {
        exercise,
        sets,
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([workoutExercise]);

      expect(metrics.total_volume_kg).toBe(0); // No volume for reps_only
      expect(metrics.total_sets).toBe(3);
    });

    it('should exclude sets with zero reps', () => {
      const exercise: Exercise = {
        id: '2',
        title: 'Pull-ups',
        type: 'reps_only',
        primary_muscle_group: 'back',
        secondary_muscle_groups: [],
        is_custom: false,
      };

      const sets: WorkoutSet[] = [
        { set_number: 1, reps: 10, completed: false },
        { set_number: 2, reps: 0, completed: false },
        { set_number: 3, reps: 8, completed: false },
      ];

      const workoutExercise: WorkoutExercise = {
        exercise,
        sets,
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([workoutExercise]);

      expect(metrics.total_volume_kg).toBe(0);
      expect(metrics.total_sets).toBe(2);
    });

    it('should handle undefined reps as zero', () => {
      const exercise: Exercise = {
        id: '2',
        title: 'Sit-ups',
        type: 'reps_only',
        primary_muscle_group: 'abdominals',
        secondary_muscle_groups: [],
        is_custom: false,
      };

      const sets: WorkoutSet[] = [
        { set_number: 1, reps: 20, completed: false },
        { set_number: 2, completed: false }, // reps undefined
      ];

      const workoutExercise: WorkoutExercise = {
        exercise,
        sets,
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([workoutExercise]);

      expect(metrics.total_volume_kg).toBe(0);
      expect(metrics.total_sets).toBe(1);
    });
  });

  describe('duration exercise type', () => {
    it('should count sets with duration > 0 for duration exercises', () => {
      const exercise: Exercise = {
        id: '3',
        title: 'Plank',
        type: 'duration',
        primary_muscle_group: 'core',
        secondary_muscle_groups: [],
        is_custom: false,
      };

      const sets: WorkoutSet[] = [
        { set_number: 1, duration_seconds: 60, completed: false },
        { set_number: 2, duration_seconds: 90, completed: false },
        { set_number: 3, duration_seconds: 45, completed: false },
      ];

      const workoutExercise: WorkoutExercise = {
        exercise,
        sets,
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([workoutExercise]);

      expect(metrics.total_volume_kg).toBe(0); // No volume for duration
      expect(metrics.total_sets).toBe(3);
    });

    it('should exclude sets with zero duration', () => {
      const exercise: Exercise = {
        id: '3',
        title: 'Wall Sit',
        type: 'duration',
        primary_muscle_group: 'legs',
        secondary_muscle_groups: [],
        is_custom: false,
      };

      const sets: WorkoutSet[] = [
        { set_number: 1, duration_seconds: 60, completed: false },
        { set_number: 2, duration_seconds: 0, completed: false },
        { set_number: 3, duration_seconds: 30, completed: false },
      ];

      const workoutExercise: WorkoutExercise = {
        exercise,
        sets,
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([workoutExercise]);

      expect(metrics.total_volume_kg).toBe(0);
      expect(metrics.total_sets).toBe(2);
    });

    it('should handle undefined duration_seconds as zero', () => {
      const exercise: Exercise = {
        id: '3',
        title: 'Hollow Hold',
        type: 'duration',
        primary_muscle_group: 'core',
        secondary_muscle_groups: [],
        is_custom: false,
      };

      const sets: WorkoutSet[] = [
        { set_number: 1, duration_seconds: 45, completed: false },
        { set_number: 2, completed: false }, // duration_seconds undefined
      ];

      const workoutExercise: WorkoutExercise = {
        exercise,
        sets,
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([workoutExercise]);

      expect(metrics.total_volume_kg).toBe(0);
      expect(metrics.total_sets).toBe(1);
    });
  });

  describe('distance_duration exercise type', () => {
    it('should count sets with distance or duration > 0', () => {
      const exercise: Exercise = {
        id: '4',
        title: 'Running',
        type: 'distance_duration',
        primary_muscle_group: 'cardio',
        secondary_muscle_groups: [],
        is_custom: false,
      };

      const sets: WorkoutSet[] = [
        { set_number: 1, distance_meters: 1000, duration_seconds: 300, completed: false },
        { set_number: 2, distance_meters: 500, duration_seconds: 180, completed: false },
        { set_number: 3, distance_meters: 0, duration_seconds: 120, completed: false }, // Only duration
        { set_number: 4, distance_meters: 200, duration_seconds: 0, completed: false }, // Only distance
      ];

      const workoutExercise: WorkoutExercise = {
        exercise,
        sets,
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([workoutExercise]);

      expect(metrics.total_volume_kg).toBe(0); // No volume for distance_duration
      expect(metrics.total_sets).toBe(4); // All sets have either distance or duration > 0
    });

    it('should exclude sets with both distance and duration zero', () => {
      const exercise: Exercise = {
        id: '4',
        title: 'Cycling',
        type: 'distance_duration',
        primary_muscle_group: 'cardio',
        secondary_muscle_groups: [],
        is_custom: false,
      };

      const sets: WorkoutSet[] = [
        { set_number: 1, distance_meters: 5000, duration_seconds: 900, completed: false },
        { set_number: 2, distance_meters: 0, duration_seconds: 0, completed: false },
        { set_number: 3, distance_meters: 3000, duration_seconds: 600, completed: false },
      ];

      const workoutExercise: WorkoutExercise = {
        exercise,
        sets,
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([workoutExercise]);

      expect(metrics.total_volume_kg).toBe(0);
      expect(metrics.total_sets).toBe(2);
    });

    it('should handle undefined distance_meters and duration_seconds', () => {
      const exercise: Exercise = {
        id: '4',
        title: 'Swimming',
        type: 'distance_duration',
        primary_muscle_group: 'cardio',
        secondary_muscle_groups: [],
        is_custom: false,
      };

      const sets: WorkoutSet[] = [
        { set_number: 1, distance_meters: 100, duration_seconds: 60, completed: false },
        { set_number: 2, completed: false }, // Both undefined
      ];

      const workoutExercise: WorkoutExercise = {
        exercise,
        sets,
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([workoutExercise]);

      expect(metrics.total_volume_kg).toBe(0);
      expect(metrics.total_sets).toBe(1);
    });
  });

  describe('Mixed exercise types', () => {
    it('should calculate metrics correctly for mixed exercise types', () => {
      const weightRepsExercise: WorkoutExercise = {
        exercise: {
          id: '1',
          title: 'Bench Press',
          type: 'weight_reps',
          primary_muscle_group: 'chest',
          secondary_muscle_groups: [],
          is_custom: false,
        },
        sets: [
          { set_number: 1, weight_kg: 100, reps: 10, completed: false },
          { set_number: 2, weight_kg: 100, reps: 8, completed: false },
        ],
        rest_timer_enabled: false,
      };

      const repsOnlyExercise: WorkoutExercise = {
        exercise: {
          id: '2',
          title: 'Push-ups',
          type: 'reps_only',
          primary_muscle_group: 'chest',
          secondary_muscle_groups: [],
          is_custom: false,
        },
        sets: [
          { set_number: 1, reps: 20, completed: false },
          { set_number: 2, reps: 15, completed: false },
        ],
        rest_timer_enabled: false,
      };

      const durationExercise: WorkoutExercise = {
        exercise: {
          id: '3',
          title: 'Plank',
          type: 'duration',
          primary_muscle_group: 'core',
          secondary_muscle_groups: [],
          is_custom: false,
        },
        sets: [
          { set_number: 1, duration_seconds: 60, completed: false },
          { set_number: 2, duration_seconds: 45, completed: false },
        ],
        rest_timer_enabled: false,
      };

      const distanceDurationExercise: WorkoutExercise = {
        exercise: {
          id: '4',
          title: 'Running',
          type: 'distance_duration',
          primary_muscle_group: 'cardio',
          secondary_muscle_groups: [],
          is_custom: false,
        },
        sets: [
          { set_number: 1, distance_meters: 1000, duration_seconds: 300, completed: false },
        ],
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([
        weightRepsExercise,
        repsOnlyExercise,
        durationExercise,
        distanceDurationExercise,
      ]);

      // Volume only from weight_reps: 100*10 + 100*8 = 1800
      expect(metrics.total_volume_kg).toBe(1800);
      // Total sets: 2 + 2 + 2 + 1 = 7
      expect(metrics.total_sets).toBe(7);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty exercises array', () => {
      const metrics = calculateWorkoutMetrics([]);

      expect(metrics.total_volume_kg).toBe(0);
      expect(metrics.total_sets).toBe(0);
    });

    it('should handle exercises with empty sets array', () => {
      const exercise: WorkoutExercise = {
        exercise: {
          id: '1',
          title: 'Bench Press',
          type: 'weight_reps',
          primary_muscle_group: 'chest',
          secondary_muscle_groups: [],
          is_custom: false,
        },
        sets: [],
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([exercise]);

      expect(metrics.total_volume_kg).toBe(0);
      expect(metrics.total_sets).toBe(0);
    });

    it('should always return duration_minutes as 72', () => {
      const exercise: WorkoutExercise = {
        exercise: {
          id: '1',
          title: 'Bench Press',
          type: 'weight_reps',
          primary_muscle_group: 'chest',
          secondary_muscle_groups: [],
          is_custom: false,
        },
        sets: [
          { set_number: 1, weight_kg: 100, reps: 10, completed: false },
        ],
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([exercise]);

      expect(metrics.duration_minutes).toBe(72);
    });

    it('should handle very large values', () => {
      const exercise: WorkoutExercise = {
        exercise: {
          id: '1',
          title: 'Deadlift',
          type: 'weight_reps',
          primary_muscle_group: 'back',
          secondary_muscle_groups: [],
          is_custom: false,
        },
        sets: [
          { set_number: 1, weight_kg: 500, reps: 1, completed: false },
          { set_number: 2, weight_kg: 300, reps: 10, completed: false },
        ],
        rest_timer_enabled: false,
      };

      const metrics = calculateWorkoutMetrics([exercise]);

      expect(metrics.total_volume_kg).toBe(500 * 1 + 300 * 10); // 500 + 3000 = 3500
      expect(metrics.total_sets).toBe(2);
    });
  });
});

