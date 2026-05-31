"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { Field, GhostButton, PrimaryButton, inputStyle } from "./form-bits";
import {
  RACE_CATEGORIES,
  RACE_CATEGORY_LABELS,
  type RaceEventInput,
  type RaceView,
} from "@/lib/race/types";

function defaultDate(year: number): string {
  return `${year}-01-01`;
}

export function RaceFormDialog({
  initial,
  defaultYear,
  onClose,
  onSubmit,
}: {
  initial?: RaceView | null;
  defaultYear: number;
  onClose: () => void;
  onSubmit: (input: RaceEventInput) => Promise<unknown>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [date, setDate] = useState(initial?.date ?? defaultDate(defaultYear));
  const [category, setCategory] = useState(initial?.category ?? RACE_CATEGORIES[0]);
  const [eventTarget, setEventTarget] = useState(initial?.eventTarget ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = name.trim() !== "" && /^\d{4}-\d{2}-\d{2}$/.test(date) && category.trim() !== "";

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        name: name.trim(),
        date,
        category,
        eventTarget: eventTarget.trim() || null,
        location: location.trim() || null,
        note: note.trim() || null,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={initial ? "Edit race" : "Add race"}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save} disabled={!valid || saving}>
            {saving ? "Saving…" : initial ? "Save" : "Add race"}
          </PrimaryButton>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        style={{ display: "flex", flexDirection: "column", gap: "var(--space-md)" }}
      >
        <Field label="Name">
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Bay 2 Bay Run"
            autoFocus
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-md)" }}>
          <Field label="Date">
            <input
              type="date"
              style={inputStyle}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Category">
            <select
              style={inputStyle}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {RACE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {RACE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Target" hint="goal, e.g. sub 50:00">
          <input
            style={inputStyle}
            value={eventTarget}
            onChange={(e) => setEventTarget(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <Field label="Location">
          <input
            style={inputStyle}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        <Field label="Note">
          <input
            style={inputStyle}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </Field>

        {error && (
          <span style={{ color: "var(--color-semantic-error)", fontSize: 13 }}>{error}</span>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
