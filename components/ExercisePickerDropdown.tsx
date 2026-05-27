"use client";

import React, { useMemo, useState } from "react";
import { Search, Plus, Check, ChevronRight, Edit2 } from "lucide-react";
import { searchExercisesScored } from "@/lib/hevy/matching";
import {
  convertHevyToExercise,
  type HevyExerciseTemplate,
} from "@/lib/hevy/catalog";
import type { ScoredExercise } from "@/lib/hevy/scoring";
import type { Exercise } from "@/lib/types";

type FilterId = "both" | "fuzzy" | "vector" | "official" | "custom";

const FILTERS: Array<{ id: FilterId; label: string }> = [
  { id: "both", label: "All" },
  { id: "fuzzy", label: "Fuzzy" },
  { id: "vector", label: "Vector" },
  { id: "official", label: "Official" },
  { id: "custom", label: "Custom" },
];

export interface ExercisePickerDropdownProps {
  currentTitle?: string;
  readText?: string;
  onSelect: (exercise: Exercise) => void;
  onCancel?: () => void;
}

export function ExercisePickerDropdown({
  currentTitle = "",
  readText = "",
  onSelect,
  onCancel,
}: ExercisePickerDropdownProps) {
  const [query, setQuery] = useState(readText || currentTitle || "");
  const [filter, setFilter] = useState<FilterId>("both");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [readingText, setReadingText] = useState(readText);
  const [editingRead, setEditingRead] = useState(false);

  const results: ScoredExercise[] = useMemo(() => {
    const kind: "all" | "official" | "custom" =
      filter === "official" ? "official" : filter === "custom" ? "custom" : "all";
    return searchExercisesScored(query, { kind, limit: 50 });
    // fuzzy/vector chips are presentational here; both modes hit the fuzzy
    // search until vector search is wired client-side.
  }, [query, filter]);

  const selected = results.find((r) => r.exercise.id === selectedId) ?? results[0];

  return (
    <div
      style={{
        width: 460,
        background: "var(--color-card)",
        borderRadius: "var(--radius-md)",
        boxShadow:
          "0 16px 40px -10px rgba(28,27,27,0.20), 0 0 0 1px rgba(28,27,27,0.06)",
        overflow: "hidden",
        fontFamily: "var(--font-body)",
        display: "flex",
        flexDirection: "column",
        maxHeight: 520,
      }}
    >
      {/* Header — search + read pill + filters */}
      <div style={{ padding: "10px 12px 8px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "var(--color-low)",
            borderRadius: "var(--radius-sm)",
            padding: "7px 10px",
            boxShadow: "0 0 0 2px color-mix(in srgb, var(--color-primary) 60%, transparent)",
          }}
        >
          <Search size={14} color="var(--color-text-tertiary)" strokeWidth={1.7} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search 453 exercises…"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--color-text-primary)",
            }}
          />
          <span
            className="text-label-sm"
            style={{ color: "var(--color-text-tertiary)", fontSize: 9 }}
          >
            {results.length} RESULTS
          </span>
        </div>

        {readingText && (
          <div
            style={{
              marginTop: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 10px",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-low)",
            }}
          >
            <span
              className="text-label-sm"
              style={{ color: "var(--color-text-tertiary)", flexShrink: 0, fontSize: 9 }}
            >
              WE READ
            </span>
            {editingRead ? (
              <input
                autoFocus
                value={readingText}
                onChange={(e) => setReadingText(e.target.value)}
                onBlur={() => {
                  setEditingRead(false);
                  setQuery(readingText);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setEditingRead(false);
                    setQuery(readingText);
                  }
                }}
                className="text-title-sm"
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--color-text-primary)",
                }}
              />
            ) : (
              <span
                className="text-title-sm"
                style={{ color: "var(--color-text-primary)", flex: 1, minWidth: 0 }}
              >
                &ldquo;{readingText}&rdquo;
              </span>
            )}
            <button
              onClick={() => setEditingRead(true)}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--color-primary)",
                fontWeight: 500,
                fontSize: 12,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: 0,
              }}
            >
              <Edit2 size={11} /> Edit
            </button>
          </div>
        )}

        <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
          {FILTERS.map(({ id, label }) => {
            const active = id === filter;
            return (
              <button
                key={id}
                onClick={() => setFilter(id)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  padding: "3px 10px",
                  borderRadius: "var(--radius-full)",
                  background: active ? "var(--color-text-primary)" : "var(--color-low)",
                  color: active ? "var(--color-base)" : "var(--color-text-secondary)",
                  fontFamily: "var(--font-body)",
                  fontSize: 11,
                  fontWeight: 500,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Column header strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "16px 1fr 56px",
          gap: 10,
          padding: "5px 12px",
          alignItems: "center",
          background: "var(--color-low)",
        }}
      >
        <div />
        <div
          className="text-label-sm"
          style={{ color: "var(--color-text-tertiary)", fontSize: 9 }}
        >
          EXERCISE
        </div>
        <div
          className="text-label-sm"
          style={{ color: "var(--color-text-tertiary)", textAlign: "right", fontSize: 9 }}
        >
          MATCH
        </div>
      </div>

      {/* Results list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 4px 0" }}>
        {results.map((row) => (
          <PickerRow
            key={row.exercise.id}
            row={row}
            selected={selected?.exercise.id === row.exercise.id}
            onClick={() => setSelectedId(row.exercise.id)}
          />
        ))}

        {/* Create custom CTA */}
        {query.trim().length > 0 && (
          <div
            style={{
              margin: "6px 4px",
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              background: "var(--color-low)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: 999,
                background: "rgba(145,0,208,0.10)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Plus size={12} color="var(--color-primary)" strokeWidth={1.8} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                className="text-title-sm"
                style={{ color: "var(--color-text-primary)", fontWeight: 500, fontSize: 13 }}
              >
                Create &ldquo;{query}&rdquo; as custom
              </div>
              <div
                className="text-body-sm"
                style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 1 }}
              >
                Adds it to your Hevy library for future matches.
              </div>
            </div>
            <ChevronRight size={12} color="var(--color-text-tertiary)" />
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "8px 12px",
          background: "var(--color-card)",
          boxShadow: "inset 0 1px 0 var(--color-outline)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div
          className="text-body-sm"
          style={{
            fontSize: 11,
            color: "var(--color-text-tertiary)",
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {selected ? (
            <>
              <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
                {selected.exercise.title}
              </span>
              <span style={{ color: "var(--color-text-muted)" }}>
                {" "}
                · {selected.exercise.equipment?.toUpperCase() || "OTHER"}
              </span>
            </>
          ) : (
            <span>No selection</span>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
          <button
            onClick={onCancel}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--color-text-tertiary)",
              fontWeight: 500,
              fontSize: 13,
              padding: "6px 12px",
              borderRadius: "var(--radius-full)",
              fontFamily: "var(--font-body)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => selected && onSelect(convertHevyToExercise(selected.exercise))}
            disabled={!selected}
            style={{
              border: "none",
              cursor: selected ? "pointer" : "not-allowed",
              background: "var(--gradient-primary)",
              color: "#fff",
              padding: "7px 14px",
              borderRadius: "var(--radius-full)",
              fontWeight: 500,
              fontSize: 13,
              fontFamily: "var(--font-body)",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              boxShadow: "0 4px 12px -4px rgba(145,0,208,0.40)",
              opacity: selected ? 1 : 0.5,
            }}
          >
            <Check size={13} color="#fff" strokeWidth={2} /> Use this
          </button>
        </div>
      </div>
    </div>
  );
}

function PickerRow({
  row,
  selected,
  onClick,
}: {
  row: ScoredExercise;
  selected: boolean;
  onClick: () => void;
}) {
  const ex: HevyExerciseTemplate = row.exercise;
  const pct = row.score > 0 ? Math.round((row.score / 150) * 100) : null;
  const low = pct !== null && pct < 60;
  const fg = low ? "var(--color-warning)" : "var(--color-secondary)";

  return (
    <div
      onClick={onClick}
      style={{
        display: "grid",
        gridTemplateColumns: "16px 1fr 56px",
        gap: 10,
        alignItems: "center",
        padding: "7px 12px",
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        background: selected ? "rgba(145,0,208,0.06)" : "transparent",
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: 999,
          background: selected ? "var(--color-primary)" : "transparent",
          boxShadow: selected ? "none" : "inset 0 0 0 1.5px var(--color-outline)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {selected && <Check size={9} color="#fff" strokeWidth={2.4} />}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            className="text-title-sm"
            style={{ color: "var(--color-text-primary)", fontWeight: 500 }}
          >
            {ex.title}
          </span>
          {ex.is_custom && (
            <span
              className="text-label-sm"
              style={{
                color: "var(--color-warning)",
                background: "rgba(184,134,11,0.10)",
                padding: "1px 6px",
                borderRadius: "var(--radius-full)",
                fontSize: 8,
              }}
            >
              CUSTOM
            </span>
          )}
        </div>
        <div
          className="text-body-sm"
          style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 1 }}
        >
          <span
            className="text-label-sm"
            style={{ color: "var(--color-text-secondary)", fontSize: 8 }}
          >
            {ex.equipment?.toUpperCase() || "OTHER"}
          </span>
          <span style={{ margin: "0 5px", color: "var(--color-text-muted)" }}>·</span>
          <span>
            {capitalize(ex.primary_muscle_group)}
            {ex.secondary_muscle_groups?.length > 0 && (
              <span style={{ color: "var(--color-text-muted)" }}>
                {" "}
                · {ex.secondary_muscle_groups.slice(0, 2).join(" · ")}
              </span>
            )}
          </span>
        </div>
      </div>

      <div style={{ textAlign: "right" }}>
        {pct !== null ? (
          <div
            className="text-title-md"
            style={{ color: fg, fontWeight: 500, fontSize: 14 }}
          >
            {pct}
            <span style={{ fontWeight: 500, fontSize: 10, marginLeft: 1 }}>
              %
            </span>
          </div>
        ) : (
          <span className="text-label-sm" style={{ color: "var(--color-text-muted)" }}>
            —
          </span>
        )}
      </div>
    </div>
  );
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
