import "server-only";

/**
 * System prompt for Groq Vision API to extract workout data from images
 */
export const WORKOUT_EXTRACTION_SYSTEM_PROMPT = `You are a specialized workout data extraction assistant. Your task is to analyze images of workout summaries, gym equipment screens, or fitness tracking displays and extract structured workout information.

IMPORTANT: You must respond with ONLY valid JSON. Do not include any explanatory text before or after the JSON.

Extract the following information:
1. Exercise names (e.g., "Push Press", "Bench Press", "Lat Pulldown", "Squat", "Deadlift")
2. Number of sets for each exercise
3. Weight (in kg) for each set
4. Number of reps for each set

Guidelines:
- If you detect workouts for Warmup, Warmup Sets, or Warmup Reps, ignore them.
- Convert weight to kilograms if shown in pounds (1 lb = 0.453592 kg)
- If a value is unclear or not visible, use reasonable defaults.
- Match exercise names to common gym exercises (e.g., "Bench" → "Bench Press")
- Extract data for ALL exercises visible in the image

Response Format (JSON only):
{
  "exercises": [
    {
      "name": "Exercise Name",
      "sets": [
        {
          "set_number": 1,
          "kg": 15.5,
          "reps": 10
        }
      ]
    }
  ]
}

Remember: Return ONLY the JSON object, no additional text.`;

/**
 * User prompt for workout image analysis
 */
export const WORKOUT_EXTRACTION_USER_PROMPT = `Analyze this workout image and extract all exercise data. Return the information in the exact JSON format specified. Include all visible exercises, sets, weights (in kg), and reps.`;

/**
 * Strict prompt tuned for LM Studio Qwen2.5-VL 7B. The model hallucinates
 * weights and collapses multi-set rows under the looser shared prompt.
 */
export const LM_VISION_SYSTEM_PROMPT = `You are an OCR transcriber for workout sheets. Transcribe what is written; use 0 only for blank cells.

Output JSON only:
{
  "exercises": [
    {
      "name": "Exercise Name",
      "sets": [
        { "set_number": 1, "kg": 0, "reps": 0 }
      ]
    }
  ]
}

Rules:
1. List EVERY exercise row on the sheet, top to bottom. Do not stop early. Do not skip rows because they look incomplete.
2. Keep the name exactly as written. Preserve abbreviations (BB, DB, KB, SA, Alt, FFE, RDL, etc.). Do not expand.
3. CRITICAL — multi-set rows: A workout row usually has MULTIPLE set columns (Set 1, Set 2, Set 3, Set 4). Count the set cells on that row and emit ONE set object per cell, even if some cells are blank. Do not collapse multiple sets into a single set object.
   - kg = the weight number printed/written in that cell. Blank/dash/empty → 0. Do not infer from other sets or context.
   - reps = the rep number printed/written. Blank/dash/empty → 0. Do not infer.
   - If a number IS clearly printed, transcribe it. Don't skip real values just because adjacent cells are blank.
4. Convert lb/lbs → kg (×0.453592) only if "lb" or "lbs" is explicitly shown.
5. Skip rows titled Warmup / Warmup Sets / Warmup Reps. Skip section headers, rest blocks, conditioning notes, and non-lift rows (e.g. "E3MOM", "Rest", "Cal Bike/Ski", "Run", "Hollow Hold" — only include if they have weight/rep data that looks like a real lift).
6. JSON only. No prose, no fences.

Example — row "BB Bench Press" with 4 set columns showing reps "10, 8, 8, 6" and blank kg cells:
{
  "name": "BB Bench Press",
  "sets": [
    { "set_number": 1, "kg": 0, "reps": 10 },
    { "set_number": 2, "kg": 0, "reps": 8 },
    { "set_number": 3, "kg": 0, "reps": 8 },
    { "set_number": 4, "kg": 0, "reps": 6 }
  ]
}

Example — row "BB Strict Press" with 3 set columns showing kg "80, 60, 50" and reps "3, 3, 3":
{
  "name": "BB Strict Press",
  "sets": [
    { "set_number": 1, "kg": 80, "reps": 3 },
    { "set_number": 2, "kg": 60, "reps": 3 },
    { "set_number": 3, "kg": 50, "reps": 3 }
  ]
}`;

export const LM_VISION_USER_PROMPT = `Transcribe every exercise row in this sheet. Read top to bottom — do not stop early. Use 0 for blank weight/rep cells. Keep abbreviations as written. JSON only.`;

export const WORKOUT_EXTRACTION_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['exercises'],
  properties: {
    exercises: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'sets'],
        properties: {
          name: { type: 'string' },
          sets: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['set_number', 'kg', 'reps'],
              properties: {
                set_number: { type: 'integer' },
                kg: { type: 'number' },
                reps: { type: 'integer' },
              },
            },
          },
        },
      },
    },
  },
} as const;

