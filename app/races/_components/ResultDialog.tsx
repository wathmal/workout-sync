"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { Field, GhostButton, PrimaryButton, inputStyle } from "./form-bits";
import type { RaceView } from "@/lib/race/types";
import type { ResultPatch } from "@/app/_providers/race-provider";

export function ResultDialog({
  race,
  onClose,
  onSubmit,
}: {
  race: RaceView;
  onClose: () => void;
  onSubmit: (result: ResultPatch) => Promise<unknown>;
}) {
  const [resultTime, setResultTime] = useState(race.resultTime ?? "");
  const [resultPlacement, setResultPlacement] = useState(race.resultPlacement ?? "");
  const [resultNote, setResultNote] = useState(race.resultNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({
        resultTime: resultTime.trim() || null,
        resultPlacement: resultPlacement.trim() || null,
        resultNote: resultNote.trim() || null,
      });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <Modal
      title={`Result · ${race.name}`}
      onClose={onClose}
      footer={
        <>
          <GhostButton onClick={onClose}>Cancel</GhostButton>
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save result"}
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
        <Field label="Finish time" hint="e.g. 1:25:00">
          <input
            style={inputStyle}
            value={resultTime}
            onChange={(e) => setResultTime(e.target.value)}
            placeholder="h:mm:ss"
            autoFocus
          />
        </Field>
        <Field label="Placement" hint="e.g. 5/120 or 5th">
          <input
            style={inputStyle}
            value={resultPlacement}
            onChange={(e) => setResultPlacement(e.target.value)}
            placeholder="Optional"
          />
        </Field>
        <Field label="Note">
          <input
            style={inputStyle}
            value={resultNote}
            onChange={(e) => setResultNote(e.target.value)}
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
