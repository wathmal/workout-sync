/**
 * Exercise & equipment abbreviation expansion. Cross-cutting domain text
 * utility used by both fuzzy and vector match paths.
 */

const EQUIPMENT_ABBREVIATIONS: Record<string, string> = {
  'bb': 'barbell',
  'db': 'dumbbell',
  'kb': 'kettlebell',
  'ez': 'ez bar',
  'sz': 'sz bar',
  'swiss': 'swiss bar',
  'trap': 'trap bar',
};

const EXERCISE_ABBREVIATIONS: Record<string, string> = {
  'tbt': 'toes to bar',
  'ttb': 'toes to bar',
  'tth': 'toe touch',
  'k2c': 'knee to chest',
  'k2k': 'knee to knee',
  'k2e': 'knee to elbow',
  'hkr': 'hanging knee raise',
  'lkr': 'lying knee raise',
  'bp': 'bench press',
  'sp': 'shoulder press',
  'ohp': 'overhead press',
  'rdl': 'romanian deadlift',
  'sldl': 'stiff leg deadlift',
  'dl': 'deadlift',
  'sq': 'squat',
  'row': 'row',
  'curl': 'curl',
  'ext': 'extension',
  'press': 'press',
};

/**
 * Expand equipment + exercise abbreviations in an exercise name.
 * "BB Bench Press" → "barbell bench press"
 */
export function expandAbbreviations(name: string): string {
  let expanded = name.toLowerCase().trim();

  // Handle slash-separated equipment abbreviations at the start (BB/DB Curl → BB Curl)
  const slashPattern = /^([a-z]+)\/([a-z]+)\s/i;
  const slashMatch = expanded.match(slashPattern);
  if (slashMatch) {
    const firstPart = slashMatch[1];
    const secondPart = slashMatch[2];

    const isFirstEquipment = firstPart in EQUIPMENT_ABBREVIATIONS;
    const isSecondEquipment = secondPart in EQUIPMENT_ABBREVIATIONS;

    if (isFirstEquipment && isSecondEquipment) {
      expanded = expanded.replace(slashPattern, '$1 ');
    }
  }

  // Handle slash-separated compound exercises (TBT/TTH/K2C → expand each part)
  const slashParts = expanded.split('/').map(p => p.trim()).filter(p => p.length > 0);
  if (slashParts.length > 1) {
    const expandedParts = slashParts.map(part => {
      let partExpanded = part;

      Object.entries(EXERCISE_ABBREVIATIONS).forEach(([abbr, full]) => {
        const regex = new RegExp(`^${abbr}$`, 'i');
        if (regex.test(partExpanded)) {
          partExpanded = full;
        }
      });

      Object.entries(EQUIPMENT_ABBREVIATIONS).forEach(([abbr, full]) => {
        if (abbr === 'ez' || abbr === 'sz') {
          const regex = new RegExp(`\\b${abbr}\\b(?!\\s+bar)`, 'gi');
          partExpanded = partExpanded.replace(regex, full);
        } else {
          const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
          partExpanded = partExpanded.replace(regex, full);
        }
      });

      return partExpanded;
    });

    expanded = expandedParts.join(' ');
  } else {
    // Multi-word equipment normalisation (EZ Bar, SZ Bar) before single-word swaps
    expanded = expanded.replace(/\bez\s+bar\b/gi, 'ez bar');
    expanded = expanded.replace(/\bsz\s+bar\b/gi, 'sz bar');

    Object.entries(EXERCISE_ABBREVIATIONS).forEach(([abbr, full]) => {
      const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
      expanded = expanded.replace(regex, full);
    });

    Object.entries(EQUIPMENT_ABBREVIATIONS).forEach(([abbr, full]) => {
      if (abbr === 'ez' || abbr === 'sz') {
        const regex = new RegExp(`\\b${abbr}\\b(?!\\s+bar)`, 'gi');
        expanded = expanded.replace(regex, full);
      } else {
        const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
        expanded = expanded.replace(regex, full);
      }
    });
  }

  return expanded;
}
