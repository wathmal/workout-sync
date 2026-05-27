import { searchExercisesScored } from "../hevy/matching";
import {
  convertHevyToExercise,
  getHevyTemplateById,
  HevyExerciseTemplate,
} from "../hevy/catalog";
import { SCORE_CAP } from "../hevy/scoring";
import { expandAbbreviations } from "../exercise-abbreviations";
import { Exercise, WorkoutExercise, WorkoutSet } from "../types";
import { buildWorkoutSet, CoercedSetInput } from "../workout-set-builder";
import {
  ToolDefinition,
  ToolHandlerResult,
  TerminalToolResult,
} from "./types";

interface ProposedSet {
  set_number?: number;
  kg?: number;
  weight_kg?: number;
  reps?: number;
  duration_seconds?: number;
  distance_meters?: number;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asInt(v: unknown): number | null {
  const n = asNumber(v);
  return n === null ? null : Math.round(n);
}

function compactExerciseSummary(ex: HevyExerciseTemplate) {
  return {
    id: ex.id,
    title: ex.title,
    type: ex.type,
    primary_muscle_group: ex.primary_muscle_group,
    equipment: ex.equipment,
    is_custom: ex.is_custom,
  };
}

async function searchCatalogHandler(args: unknown): Promise<ToolHandlerResult> {
  if (!isObject(args)) return { ok: false, error: "args must be an object" };
  const query = asString(args.query);
  if (!query) return { ok: false, error: "query (string) is required" };
  const limit = asInt(args.limit) ?? 10;
  const kindRaw = asString(args.kind) ?? "all";
  if (kindRaw !== "all" && kindRaw !== "official" && kindRaw !== "custom") {
    return {
      ok: false,
      error: `kind must be one of: all, official, custom (got: ${kindRaw})`,
    };
  }
  const scored = searchExercisesScored(query, {
    limit: Math.min(50, Math.max(1, limit)),
    kind: kindRaw,
  });
  return {
    ok: true,
    data: {
      query,
      results: scored.map((s) => ({
        ...compactExerciseSummary(s.exercise),
        score: Math.round(s.score),
      })),
    },
  };
}

async function getExerciseDetailsHandler(args: unknown): Promise<ToolHandlerResult> {
  if (!isObject(args)) return { ok: false, error: "args must be an object" };
  const id = asString(args.id);
  if (!id) return { ok: false, error: "id (string) is required" };
  const hevy = getHevyTemplateById(id);
  if (!hevy) return { ok: false, error: `exercise not found: ${id}` };
  return {
    ok: true,
    data: {
      id: hevy.id,
      title: hevy.title,
      type: hevy.type,
      primary_muscle_group: hevy.primary_muscle_group,
      secondary_muscle_groups: hevy.secondary_muscle_groups,
      equipment: hevy.equipment,
      is_custom: hevy.is_custom,
    },
  };
}

async function expandAbbreviationsHandler(args: unknown): Promise<ToolHandlerResult> {
  if (!isObject(args)) return { ok: false, error: "args must be an object" };
  const text = asString(args.text);
  if (!text) return { ok: false, error: "text (string) is required" };
  const expanded = expandAbbreviations(text);
  return { ok: true, data: { original: text, expanded } };
}

function buildSet(
  exerciseType: Exercise["type"],
  raw: ProposedSet,
  index: number,
): WorkoutSet {
  const setNumber =
    typeof raw.set_number === "number" && raw.set_number > 0
      ? raw.set_number
      : index + 1;
  const coerced: CoercedSetInput = {
    set_number: setNumber,
    weight_kg: asNumber(raw.weight_kg ?? raw.kg) ?? undefined,
    reps: asInt(raw.reps) ?? undefined,
    duration_seconds: asInt(raw.duration_seconds) ?? undefined,
    distance_meters: asNumber(raw.distance_meters) ?? undefined,
  };
  return buildWorkoutSet(exerciseType, coerced);
}

async function proposeWorkoutHandler(args: unknown): Promise<TerminalToolResult> {
  if (!isObject(args)) return { ok: false, error: "args must be an object" };
  const list = (args as { exercises?: unknown }).exercises;
  if (!Array.isArray(list) || list.length === 0) {
    return {
      ok: false,
      error: "exercises must be a non-empty array",
    };
  }

  const workout: WorkoutExercise[] = [];
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (!isObject(item)) {
      return { ok: false, error: `exercises[${i}] must be an object` };
    }
    const exerciseId = asString(item.exercise_id);
    if (!exerciseId) {
      return {
        ok: false,
        error: `exercises[${i}].exercise_id is required (string)`,
      };
    }
    const hevy = getHevyTemplateById(exerciseId);
    if (!hevy) {
      return {
        ok: false,
        error: `exercises[${i}].exercise_id not found in catalog: ${exerciseId}`,
      };
    }
    const exercise = convertHevyToExercise(hevy);
    const setsRaw = item.sets;
    if (!Array.isArray(setsRaw) || setsRaw.length === 0) {
      return {
        ok: false,
        error: `exercises[${i}].sets must be a non-empty array`,
      };
    }
    const sets: WorkoutSet[] = [];
    for (let j = 0; j < setsRaw.length; j++) {
      const s = setsRaw[j];
      if (!isObject(s)) {
        return {
          ok: false,
          error: `exercises[${i}].sets[${j}] must be an object`,
        };
      }
      sets.push(buildSet(exercise.type, s as ProposedSet, j));
    }
    workout.push({
      exercise,
      sets,
      notes: asString(item.notes) ?? "",
      rest_timer_enabled: false,
      matchScore: SCORE_CAP,
      rawDetection: asString(item.raw_detection) ?? exercise.title,
    });
  }

  return { ok: true, data: { count: workout.length }, workout };
}

export const AGENT_TOOLS: ToolDefinition[] = [
  {
    name: "searchCatalog",
    description:
      "Search the Hevy exercise catalog by name. Returns top candidates with fuzzy match scores (0-150). Always call this before guessing an exercise_id.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Exercise name to search for (e.g. 'BB Bench Press', 'barbell bench'). Expand abbreviations first if helpful.",
        },
        limit: {
          type: "integer",
          description: "Max results to return (default 10, max 50).",
        },
        kind: {
          type: "string",
          enum: ["all", "official", "custom"],
          description:
            "Filter to all exercises, official Hevy templates only, or user customs only. Default 'all'.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
    handler: searchCatalogHandler,
  },
  {
    name: "getExerciseDetails",
    description:
      "Get full details (equipment, type, muscles, custom flag) for a specific exercise id from the Hevy catalog. Use to disambiguate close matches.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The exercise id (UUID) returned by searchCatalog.",
        },
      },
      required: ["id"],
      additionalProperties: false,
    },
    handler: getExerciseDetailsHandler,
  },
  {
    name: "expandAbbreviations",
    description:
      "Expand gym abbreviations in a string. BB→barbell, DB→dumbbell, KB→kettlebell, RDL→romanian deadlift, OHP→overhead press, etc.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Text to expand (e.g. 'BB Bench Press').",
        },
      },
      required: ["text"],
      additionalProperties: false,
    },
    handler: expandAbbreviationsHandler,
  },
  {
    name: "proposeWorkout",
    description:
      "Submit the final extracted workout. Call this exactly once at the end. Each exercise must include a valid exercise_id from the catalog and at least one set. Set fields must match exercise type: weight_reps→{kg,reps}, reps_only→{reps}, duration→{duration_seconds}, distance_duration→{distance_meters,duration_seconds}.",
    parameters: {
      type: "object",
      properties: {
        exercises: {
          type: "array",
          items: {
            type: "object",
            properties: {
              exercise_id: { type: "string" },
              raw_detection: {
                type: "string",
                description:
                  "The original name as written on the workout sheet, before matching.",
              },
              notes: { type: "string" },
              sets: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    set_number: { type: "integer" },
                    kg: { type: "number" },
                    weight_kg: { type: "number" },
                    reps: { type: "integer" },
                    duration_seconds: { type: "integer" },
                    distance_meters: { type: "number" },
                  },
                  additionalProperties: true,
                },
              },
            },
            required: ["exercise_id", "sets"],
            additionalProperties: false,
          },
        },
      },
      required: ["exercises"],
      additionalProperties: false,
    },
    handler: proposeWorkoutHandler,
    terminal: true,
  },
];

export type AgentToolName =
  | "searchCatalog"
  | "getExerciseDetails"
  | "expandAbbreviations"
  | "proposeWorkout";

export async function dispatchTool(
  name: string,
  args: unknown,
): Promise<ToolHandlerResult | TerminalToolResult> {
  const tool = AGENT_TOOLS.find((t) => t.name === name);
  if (!tool) return { ok: false, error: `unknown tool: ${name}` };
  try {
    return await tool.handler(args);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `tool handler threw: ${msg}` };
  }
}

export function isTerminalCall(name: string): boolean {
  return AGENT_TOOLS.find((t) => t.name === name)?.terminal === true;
}

interface OpenAIToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export function toOpenAITools(tools: ToolDefinition[] = AGENT_TOOLS): OpenAIToolDef[] {
  return tools.map((t) => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

interface AnthropicToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export function toAnthropicTools(tools: ToolDefinition[] = AGENT_TOOLS): AnthropicToolDef[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

export function toCliBashAllowlist(): string[] {
  return AGENT_TOOLS.map(
    (t) => `Bash(node scripts/agent-tools/${kebab(t.name)}.ts:*)`,
  );
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/^-/, "");
}
