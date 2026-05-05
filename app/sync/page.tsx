"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ExternalLink, Check } from "lucide-react";
import { useWorkout } from "@/app/_providers/workout-provider";
import { Overline } from "@/app/_components/overline";
import { WPrimary, WGhost, WText } from "@/app/_components/web-button";
import { EquipBadge } from "@/app/_components/equip-badge";
import { formatVolume } from "@/lib/mock-data";

function fmtTime12(timeHHMM: string | null) {
  if (!timeHHMM) return "";
  const [h, m] = timeHHMM.split(":").map(Number);
  const period = h >= 12 ? "p" : "a";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, "0")}${period}`;
}

function guessEquipment(title: string): string {
  const m = title.match(/\(([^)]+)\)/);
  if (m) return m[1].toUpperCase();
  if (/barbell/i.test(title)) return "BARBELL";
  if (/dumbbell/i.test(title)) return "DUMBBELL";
  if (/kettlebell/i.test(title)) return "KETTLEBELL";
  if (/machine/i.test(title)) return "MACHINE";
  if (/cable/i.test(title)) return "CABLE";
  return "BODYWEIGHT";
}

export default function SyncPage() {
  const router = useRouter();
  const { lastSyncedWorkout, setLastSyncedWorkout, setProcessedExercises, setUploadedImage, setCaption } =
    useWorkout();

  useEffect(() => {
    if (!lastSyncedWorkout) router.push("/");
  }, [lastSyncedWorkout, router]);

  if (!lastSyncedWorkout) return null;

  const { date, time, duration_minutes, total_volume_kg, total_sets, exercises } = lastSyncedWorkout;
  const dateStr = format(date, "MMM dd");
  const timeStr = fmtTime12(time);

  const handleSyncAnother = () => {
    setLastSyncedWorkout(null);
    setProcessedExercises([]);
    setUploadedImage(null);
    setCaption("");
    router.push("/");
  };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 40px" }}>
      {/* Hero */}
      <div
        className="web-grid-6040"
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: 28,
          alignItems: "start",
          marginBottom: 16,
        }}
      >
        <div>
          <Overline color="var(--color-tertiary)">STEP 03 · SYNCED</Overline>

          <h1
            className="text-display-md"
            style={{
              fontSize: 80,
              lineHeight: 0.92,
              letterSpacing: "-2.4px",
              margin: "10px 0 10px",
              color: "var(--color-text-primary)",
            }}
          >
            Synced.
          </h1>
          <p
            className="text-body-md"
            style={{ color: "var(--color-text-secondary)", margin: 0, maxWidth: 440 }}
          >
            Your workout is in your training log. Logged at{" "}
            <span style={{ color: "var(--color-text-primary)", fontWeight: 500 }}>
              {dateStr}
              {timeStr && ` · ${timeStr}`}
            </span>
            .
          </p>

          <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
            <WPrimary
              icon={<ExternalLink size={14} color="#fff" strokeWidth={1.6} />}
              onClick={() => window.open("https://hevy.com", "_blank")}
            >
              Open in Hevy
            </WPrimary>
            <WGhost onClick={handleSyncAnother}>Sync another</WGhost>
          </div>
        </div>

        {/* Stat tile */}
        <div
          style={{
            background: "var(--color-low)",
            borderRadius: "var(--radius-lg)",
            padding: 14,
          }}
        >
          <Overline>THIS WORKOUT</Overline>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginTop: 10,
            }}
          >
            {(
              [
                ["DURATION", `${duration_minutes}m`],
                ["VOLUME", `${formatVolume(total_volume_kg)} kg`],
                ["TOTAL SETS", String(total_sets)],
                ["EXERCISES", String(exercises.length)],
              ] as const
            ).map(([k, v]) => (
              <div
                key={k}
                style={{
                  background: "var(--color-card)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 12px",
                }}
              >
                <Overline style={{ fontSize: 9 }}>{k}</Overline>
                <div
                  className="text-headline-md"
                  style={{ color: "var(--color-text-primary)", marginTop: 2 }}
                >
                  {v}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Logged exercises */}
      <div
        style={{
          background: "var(--color-low)",
          borderRadius: "var(--radius-lg)",
          padding: 16,
          marginTop: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 10,
          }}
        >
          <Overline>LOGGED EXERCISES · {exercises.length}</Overline>
          <WText onClick={() => router.push("/review")}>Edit workout</WText>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {exercises.map((we, i) => {
            const ex = we.exercise;
            const setsCount = we.sets.length;
            const summary = `${setsCount} ${setsCount === 1 ? "set" : "sets"}`;
            let volume = "";
            switch (ex.type) {
              case "weight_reps": {
                const vol = we.sets.reduce(
                  (acc, s) => acc + (s.weight_kg ?? s.kg ?? 0) * (s.reps ?? 0),
                  0,
                );
                volume = `${formatVolume(vol)} kg`;
                break;
              }
              case "reps_only": {
                const reps = we.sets.reduce((acc, s) => acc + (s.reps ?? 0), 0);
                volume = `${reps} reps`;
                break;
              }
              case "duration": {
                const sec = we.sets.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);
                const mins = Math.floor(sec / 60);
                volume = `${mins}m`;
                break;
              }
              case "distance_duration": {
                const dist = we.sets.reduce((acc, s) => acc + (s.distance_meters ?? 0), 0);
                volume = `${dist} m`;
                break;
              }
            }
            const muscleSecondary = ex.secondary_muscle_groups?.length
              ? ex.secondary_muscle_groups.slice(0, 2).join(" · ")
              : null;
            return (
              <div
                key={i}
                style={{
                  background: "var(--color-card)",
                  borderRadius: "var(--radius-md)",
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 120px 22px",
                  gap: 14,
                  alignItems: "center",
                  padding: "10px 14px",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <EquipBadge official={!ex.is_custom}>{guessEquipment(ex.title)}</EquipBadge>
                    <span
                      className="text-body-sm"
                      style={{ color: "var(--color-text-tertiary)", fontSize: 12 }}
                    >
                      {capitalize(ex.primary_muscle_group)}
                      {muscleSecondary && (
                        <span style={{ color: "var(--color-text-muted)" }}>
                          {" "}· {muscleSecondary}
                        </span>
                      )}
                    </span>
                  </div>
                  <div
                    className="text-title-md"
                    style={{ color: "var(--color-text-primary)", marginTop: 2, fontWeight: 500 }}
                  >
                    {ex.title}
                  </div>
                </div>
                <div
                  className="text-body-sm"
                  style={{ color: "var(--color-text-tertiary)", fontWeight: 500, fontSize: 12 }}
                >
                  {summary}
                </div>
                <div
                  className="font-mono-sm"
                  style={{ color: "var(--color-text-primary)", fontWeight: 500 }}
                >
                  {volume}
                </div>
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: "var(--color-secondary)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Check size={10} color="#fff" strokeWidth={2.4} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
