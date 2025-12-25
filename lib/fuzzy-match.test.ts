/**
 * Test suite for fuzzy matching utilities
 * Tests equipment reordering, abbreviation expansion, and exercise matching
 */

import {
  expandAbbreviations,
  normalizeExerciseName,
  reorderEquipmentToEnd,
  calculateSimilarity,
  calculateWordOverlap,
  hasSameStartingWord,
  containsEquipment,
} from './fuzzy-match';

describe('Equipment Reordering', () => {
  describe('reorderEquipmentToEnd', () => {
    it('should move dumbbell to end', () => {
      expect(reorderEquipmentToEnd('dumbbell curl')).toBe('curl dumbbell');
    });

    it('should move barbell to end', () => {
      expect(reorderEquipmentToEnd('barbell bench press')).toBe('bench press barbell');
    });

    it('should handle kettlebell exercises', () => {
      expect(reorderEquipmentToEnd('kettlebell swing')).toBe('swing kettlebell');
    });

    it('should not reorder if equipment is in middle or end', () => {
      expect(reorderEquipmentToEnd('bicep curl dumbbell')).toBe('bicep curl dumbbell');
    });

    it('should handle exercises without equipment', () => {
      expect(reorderEquipmentToEnd('push up')).toBe('push up');
    });

    it('should handle cable exercises', () => {
      expect(reorderEquipmentToEnd('cable row')).toBe('row cable');
    });

    it('should handle machine exercises', () => {
      expect(reorderEquipmentToEnd('machine chest press')).toBe('chest press machine');
    });

    it('should handle band exercises', () => {
      expect(reorderEquipmentToEnd('band pull apart')).toBe('pull apart band');
    });

    it('should handle ez bar exercises', () => {
      expect(reorderEquipmentToEnd('ez curl')).toBe('curl ez');
    });

    it('should handle smith machine exercises', () => {
      expect(reorderEquipmentToEnd('smith squat')).toBe('squat smith');
    });
  });

  describe('expandAbbreviations', () => {
    it('should expand DB to dumbbell', () => {
      expect(expandAbbreviations('DB Curl')).toBe('dumbbell curl');
    });

    it('should expand BB to barbell', () => {
      expect(expandAbbreviations('BB Bench Press')).toBe('barbell bench press');
    });

    it('should expand KB to kettlebell', () => {
      expect(expandAbbreviations('KB Swing')).toBe('kettlebell swing');
    });

    it('should handle slash-separated abbreviations (take first)', () => {
      expect(expandAbbreviations('BB/DB Curl')).toBe('barbell curl');
    });

    it('should handle EZ bar abbreviation', () => {
      expect(expandAbbreviations('EZ Bar Curl')).toBe('ez bar curl');
    });

    it('should handle mixed case', () => {
      expect(expandAbbreviations('Db CuRl')).toBe('dumbbell curl');
    });

    it('should handle SZ bar abbreviation', () => {
      expect(expandAbbreviations('SZ Bar Curl')).toBe('sz bar curl');
    });

    it('should handle multiple abbreviations', () => {
      expect(expandAbbreviations('DB and BB')).toBe('dumbbell and barbell');
    });

    it('should preserve non-abbreviated words', () => {
      expect(expandAbbreviations('Regular Curl')).toBe('regular curl');
    });
  });

  describe('normalizeExerciseName', () => {
    it('should normalize and reorder DB Curl', () => {
      expect(normalizeExerciseName('DB Curl')).toBe('curl dumbbell');
    });

    it('should normalize and reorder BB Bench Press', () => {
      expect(normalizeExerciseName('BB Bench Press')).toBe('bench press barbell');
    });

    it('should handle parentheses from Hevy format', () => {
      expect(normalizeExerciseName('Bicep Curl (Dumbbell)')).toBe('bicep curl dumbbell');
    });

    it('should handle slash-separated equipment', () => {
      expect(normalizeExerciseName('BB/DB Curl')).toBe('curl barbell');
    });

    it('should normalize special characters', () => {
      expect(normalizeExerciseName('Cable Row - Seated')).toBe('row seated cable');
    });

    it('should handle KB exercises', () => {
      expect(normalizeExerciseName('KB Swing')).toBe('swing kettlebell');
    });

    it('should handle exercises with multiple words', () => {
      expect(normalizeExerciseName('DB Incline Bench Press')).toBe('incline bench press dumbbell');
    });

    it('should handle uppercase input', () => {
      expect(normalizeExerciseName('BARBELL SQUAT')).toBe('squat barbell');
    });
  });
});

describe('Integration Tests - Exercise Matching', () => {
  it('should normalize DB Curl and Bicep Curl (Dumbbell) to similar format', () => {
    const detected = normalizeExerciseName('DB Curl');
    const hevy = normalizeExerciseName('Bicep Curl (Dumbbell)');
    
    // Both should end with "dumbbell" and contain "curl"
    expect(detected).toContain('curl');
    expect(detected).toContain('dumbbell');
    expect(hevy).toContain('curl');
    expect(hevy).toContain('dumbbell');
  });

  it('should have high word overlap for DB Curl vs Bicep Curl (Dumbbell)', () => {
    const overlap = calculateWordOverlap('DB Curl', 'Bicep Curl (Dumbbell)');
    expect(overlap).toBeGreaterThanOrEqual(2); // curl + dumbbell
  });

  it('should detect equipment match for DB Curl', () => {
    expect(containsEquipment('DB Curl', 'dumbbell')).toBe(true);
  });

  it('should have reasonable similarity between DB Curl and Bicep Curl (Dumbbell)', () => {
    const similarity = calculateSimilarity('DB Curl', 'Bicep Curl (Dumbbell)');
    expect(similarity).toBeGreaterThanOrEqual(50);
  });

  it('should match BB Bench Press with Bench Press (Barbell)', () => {
    const detected = normalizeExerciseName('BB Bench Press');
    const hevy = normalizeExerciseName('Bench Press (Barbell)');
    
    // Both should contain "bench press barbell"
    expect(detected).toContain('bench');
    expect(detected).toContain('press');
    expect(detected).toContain('barbell');
    expect(hevy).toContain('bench');
    expect(hevy).toContain('press');
    expect(hevy).toContain('barbell');
  });

  it('should have same starting word after normalization for DB Curl variants', () => {
    // After normalization, both should start with "curl"
    const detected = normalizeExerciseName('DB Curl');
    const hevy = normalizeExerciseName('Curl (Dumbbell)');
    
    expect(detected.split(' ')[0]).toBe('curl');
    expect(hevy.split(' ')[0]).toBe('curl');
  });

  it('should match KB Swing with Kettlebell Swing', () => {
    const detected = normalizeExerciseName('KB Swing');
    const hevy = normalizeExerciseName('Kettlebell Swing');
    
    expect(detected).toBe('swing kettlebell');
    expect(hevy).toBe('swing kettlebell'); // Also reordered since kettlebell is at start
    
    const similarity = calculateSimilarity('KB Swing', 'Kettlebell Swing');
    expect(similarity).toBeGreaterThanOrEqual(70);
  });

  it('should handle cable exercises', () => {
    const detected = normalizeExerciseName('Cable Row');
    const hevy = normalizeExerciseName('Row (Cable)');
    
    expect(detected).toContain('row');
    expect(detected).toContain('cable');
    expect(hevy).toContain('row');
    expect(hevy).toContain('cable');
  });

  it('should match BB/DB Curl to Barbell variant', () => {
    const detected = normalizeExerciseName('BB/DB Curl');
    const hevy = normalizeExerciseName('Bicep Curl (Barbell)');
    
    // Should take first option (BB) and normalize
    expect(detected).toBe('curl barbell');
    expect(hevy).toContain('curl');
    expect(hevy).toContain('barbell');
  });
});

describe('Edge Cases', () => {
  it('should handle empty strings', () => {
    expect(normalizeExerciseName('')).toBe('');
  });

  it('should handle single word exercises', () => {
    expect(normalizeExerciseName('Plank')).toBe('plank');
  });

  it('should handle multiple spaces', () => {
    expect(normalizeExerciseName('DB  Curl   Test')).toBe('curl test dumbbell');
  });

  it('should handle equipment-only names', () => {
    expect(normalizeExerciseName('Barbell')).toBe('barbell');
  });

  it('should handle exercises with numbers', () => {
    expect(normalizeExerciseName('21s Bicep Curl')).toBe('21s bicep curl');
  });

  it('should handle exercises with hyphens', () => {
    expect(normalizeExerciseName('T-Bar Row')).toBe('t bar row');
  });

  it('should handle exercises with apostrophes', () => {
    expect(normalizeExerciseName("Farmer's Walk")).toBe('farmer s walk');
  });

  it('should handle very long exercise names', () => {
    const longName = 'DB Incline Alternating Chest Press with Rotation';
    const normalized = normalizeExerciseName(longName);
    expect(normalized).toContain('incline');
    expect(normalized).toContain('dumbbell');
    expect(normalized.endsWith('dumbbell')).toBe(true);
  });
});

describe('Word Overlap Tests', () => {
  it('should calculate correct word overlap for exact matches', () => {
    const overlap = calculateWordOverlap('Bench Press', 'Bench Press');
    expect(overlap).toBe(2);
  });

  it('should calculate word overlap for partial matches', () => {
    const overlap = calculateWordOverlap('DB Curl', 'Dumbbell Bicep Curl');
    expect(overlap).toBeGreaterThan(0);
  });

  it('should return 0 for completely different exercises', () => {
    const overlap = calculateWordOverlap('Squat', 'Bench Press');
    expect(overlap).toBe(0);
  });
});

describe('Starting Word Tests', () => {
  it('should detect same starting word', () => {
    expect(hasSameStartingWord('Bench Press', 'Bench Fly')).toBe(true);
  });

  it('should detect different starting words', () => {
    expect(hasSameStartingWord('Squat', 'Deadlift')).toBe(false);
  });

  it('should handle normalized names', () => {
    // After normalization, both start with "curl"
    const result = hasSameStartingWord('DB Curl', 'Curl (Dumbbell)');
    expect(result).toBe(true);
  });
});

describe('Equipment Detection Tests', () => {
  it('should detect dumbbell equipment', () => {
    expect(containsEquipment('DB Curl', 'dumbbell')).toBe(true);
    expect(containsEquipment('Dumbbell Press', 'dumbbell')).toBe(true);
  });

  it('should detect barbell equipment', () => {
    expect(containsEquipment('BB Squat', 'barbell')).toBe(true);
    expect(containsEquipment('Barbell Row', 'barbell')).toBe(true);
  });

  it('should detect cable equipment', () => {
    expect(containsEquipment('Cable Fly', 'cable')).toBe(true);
  });

  it('should detect machine equipment', () => {
    expect(containsEquipment('Machine Press', 'machine')).toBe(true);
  });

  it('should return false for non-matching equipment', () => {
    expect(containsEquipment('Cable Row', 'barbell')).toBe(false);
    expect(containsEquipment('Push Up', 'dumbbell')).toBe(false);
  });
});

