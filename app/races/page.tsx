"use client";

import { useState } from "react";
import {
  Clock,
  MapPin,
  Pencil,
  Plus,
  StickyNote,
  Target,
  Timer,
  Trash2,
  Trophy,
} from "lucide-react";
import { Overline } from "@/app/_components/overline";
import { useRaces } from "@/app/_providers/race-provider";
import { categoryColor, categoryLabel, type RaceView } from "@/lib/race/types";
import { RaceFormDialog } from "./_components/RaceFormDialog";
import { ResultDialog } from "./_components/ResultDialog";
import { PrimaryButton } from "./_components/form-bits";

type Dialog =
  | { kind: "add" }
  | { kind: "edit"; race: RaceView }
  | { kind: "result"; race: RaceView }
  | null;

export default function RacesPage() {
  const {
    yearViews,
    years,
    year,
    setYear,
    addRace,
    editRace,
    setResult,
    removeRace,
    loading,
    error,
  } = useRaces();
  const [dialog, setDialog] = useState<Dialog>(null);

  const upcoming = yearViews.filter((v) => v.status !== "past");
  const past = [...yearViews.filter((v) => v.status === "past")].reverse();

  return (
    <>
      <div
      style={{
        maxWidth: 920,
        margin: "0 auto",
        padding: "var(--space-xl) clamp(var(--space-md), 4vw, var(--space-2xl)) var(--space-3xl)",
        display: "flex",
        flexDirection: "column",
          gap: "var(--space-xl)",
        }}
      >
        {/* header */}
        <header
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "var(--space-lg)",
            flexWrap: "wrap",
          }}
        >
          <div>
            <Overline>Race calendar</Overline>
            <h1
              className="text-headline-md"
              style={{
                color: "var(--color-text-primary)",
                margin: "var(--space-2xs) 0 0",
              }}
            >
              Races {year}.
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)" }}>
            <YearPicker years={years} value={year} onChange={setYear} />
            <PrimaryButton onClick={() => setDialog({ kind: "add" })}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Plus size={14} /> Add race
              </span>
            </PrimaryButton>
          </div>
        </header>

        {error && (
          <div className="text-body-sm" style={{ color: "var(--color-semantic-error)" }}>{error}</div>
        )}

        {loading && yearViews.length === 0 ? (
          <Empty label="Loading races…" />
        ) : yearViews.length === 0 ? (
          <Empty label={`No races for ${year}. Add your first one.`} />
        ) : (
          <>
            <Group title="Upcoming" count={upcoming.length}>
              {upcoming.map((r) => (
                <RaceRow
                  key={r.id}
                  race={r}
                  onEdit={() => setDialog({ kind: "edit", race: r })}
                  onResult={() => setDialog({ kind: "result", race: r })}
                  onDelete={() => removeRace(r.id)}
                />
              ))}
              {upcoming.length === 0 && <Empty label="Nothing upcoming this year." small />}
            </Group>

            <Group title="Past" count={past.length}>
              {past.map((r) => (
                <RaceRow
                  key={r.id}
                  race={r}
                  onEdit={() => setDialog({ kind: "edit", race: r })}
                  onResult={() => setDialog({ kind: "result", race: r })}
                  onDelete={() => removeRace(r.id)}
                />
              ))}
              {past.length === 0 && <Empty label="No past races this year." small />}
            </Group>
          </>
        )}
      </div>

      {dialog?.kind === "add" && (
        <RaceFormDialog
          defaultYear={year}
          onClose={() => setDialog(null)}
          onSubmit={(input) => addRace(input)}
        />
      )}
      {dialog?.kind === "edit" && (
        <RaceFormDialog
          initial={dialog.race}
          defaultYear={year}
          onClose={() => setDialog(null)}
          onSubmit={(input) => editRace(dialog.race.id, input)}
        />
      )}
      {dialog?.kind === "result" && (
        <ResultDialog
          race={dialog.race}
          onClose={() => setDialog(null)}
          onSubmit={(result) => setResult(dialog.race.id, result)}
        />
      )}
    </>
  );
}

function YearPicker({
  years,
  value,
  onChange,
}: {
  years: number[];
  value: number;
  onChange: (y: number) => void;
}) {
  return (
    <div
      style={{
        display: "inline-flex",
        background: "var(--color-surface-elevated)",
        borderRadius: "var(--radius-sm)",
        padding: 2,
        gap: 2,
      }}
    >
      {years.map((y) => {
        const active = y === value;
        return (
          <button
            key={y}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(y)}
            className="font-mono-sm"
            style={{
              padding: "6px 12px",
              borderRadius: "var(--radius-sm)",
              background: active ? "var(--color-surface-card)" : "transparent",
              color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
              border: 0,
              cursor: "pointer",
            }}
          >
            {y}
          </button>
        );
      })}
    </div>
  );
}

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
      <div
        className="text-label-md"
        style={{
          color: "var(--color-text-tertiary)",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {title}
        <span style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
          {count}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
        {children}
      </div>
    </section>
  );
}

function RaceRow({
  race,
  onEdit,
  onResult,
  onDelete,
}: {
  race: RaceView;
  onEdit: () => void;
  onResult: () => void;
  onDelete: () => void;
}) {
  const color = race.completed ? "var(--color-semantic-success)" : categoryColor(race.category);
  const hasMeta = !!(race.eventTarget || race.location || race.note);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-md)",
        padding: "var(--space-sm) var(--space-md)",
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface-card)",
        border: "1px solid var(--color-outline)",
      }}
    >
      {/* date */}
      <div style={{ width: 64, flexShrink: 0 }}>
        <div
          className="font-mono-sm"
          style={{ color: "var(--color-text-primary)", fontSize: 13 }}
        >
          {race.dateLabel}
        </div>
        <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
          {race.status === "past"
            ? `${Math.abs(race.daysUntil)}d ago`
            : race.daysUntil === 0
            ? "today"
            : `${race.daysUntil}d`}
        </div>
      </div>

      {/* category dot */}
      <span
        aria-hidden
        style={{
          width: 9,
          height: 9,
          borderRadius: 999,
          background: color,
          flexShrink: 0,
        }}
      />

      {/* category + name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="text-label-sm" style={{ color }}>
          {categoryLabel(race.category)}
        </div>
        <div
          className="text-title-sm"
          style={{
            color: "var(--color-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {race.name}
        </div>
        {hasMeta && (
          <div
            className="font-mono-sm"
            style={{
              color: "var(--color-text-tertiary)",
              display: "grid",
              gridTemplateColumns: "90px max-content 1fr",
              alignItems: "center",
              columnGap: 8,
              rowGap: 4,
            }}
          >
            <MetaBit icon={<MapPin size={11} />} text={race.location} />
            <MetaBit icon={<StickyNote size={11} />} text={race.note} />
            <MetaBit icon={<Target size={11} />} text={race.eventTarget} />
          </div>
        )}
        {race.completed && (
          <div
            className="font-mono-sm"
            style={{
              color: "var(--color-semantic-success)",
              display: "inline-flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <MetaBit icon={<Clock size={11} />} text={race.resultTime ?? ""} />
            {race.resultPlacement && (
              <MetaBit icon={<Trophy size={11} />} text={race.resultPlacement} />
            )}
          </div>
        )}
      </div>

      {/* actions */}
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        <IconBtn label="Enter result" onClick={onResult}>
          <Timer size={14} />
        </IconBtn>
        <IconBtn label="Edit" onClick={onEdit}>
          <Pencil size={14} />
        </IconBtn>
        <IconBtn label="Delete" onClick={onDelete} danger>
          <Trash2 size={14} />
        </IconBtn>
      </div>
    </div>
  );
}

function MetaBit({ icon, text }: { icon: React.ReactNode; text: string | null }) {
  if (!text) return <span />;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, minWidth: 0 }}>
      <span style={{ display: "inline-flex", flexShrink: 0, opacity: 0.7 }}>{icon}</span>
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {text}
      </span>
    </span>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      style={{
        width: 28,
        height: 28,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        borderRadius: 8,
        border: 0,
        background: "transparent",
        color: danger ? "var(--color-semantic-error)" : "var(--color-text-tertiary)",
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function Empty({ label, small }: { label: string; small?: boolean }) {
  return (
    <div
      className="text-body-sm"
      style={{
        padding: small ? "var(--space-md)" : "var(--space-2xl)",
        textAlign: "center",
        color: "var(--color-text-muted)",
        border: "1px dashed var(--color-outline)",
        borderRadius: "var(--radius-md)",
      }}
    >
      {label}
    </div>
  );
}
