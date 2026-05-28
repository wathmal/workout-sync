"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Camera,
  AlignLeft,
  Search as SearchIcon,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Overline } from "@/app/_components/overline";
import { useFoodLog } from "@/app/_providers/food-log-provider";
import type {
  FmaAnalyzeResponse,
  FmaSearchHit,
  FmaItem,
  FoodLogSource,
  MealItem,
} from "@/lib/food/types";

type Mode = "search" | "text" | "snap";

interface PendingItem {
  /** stable local key */
  key: string;
  name: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fmaFoodId?: number | null;
  fmaSource?: string | null;
  fmaSourceId?: string | null;
  confidence?: number | null;
  warnings?: string[];
  rationale?: string;
  rawResponse?: unknown;
  enabled: boolean;
}

const LOW_CONF = 0.7;

function isoLocalNow(): string {
  // YYYY-MM-DDTHH:MM in local time for <input type=datetime-local>
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toIsoLocal(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return isoLocalNow();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromFmaItem(it: FmaItem, idx: number): PendingItem {
  return {
    key: `fma-${idx}-${it.matched.source_id}`,
    name: it.matched.name,
    grams: it.grams,
    kcal: it.macros.kcal,
    proteinG: it.macros.protein_g,
    carbsG: it.macros.carbs_g,
    fatG: it.macros.fat_g,
    fmaFoodId: it.matched.food_id,
    fmaSource: it.matched.source,
    fmaSourceId: it.matched.source_id,
    confidence: it.confidence,
    warnings: it.warnings,
    rationale: it.rationale,
    rawResponse: it,
    enabled: true,
  };
}

function fromSearchHit(hit: FmaSearchHit, grams: number): PendingItem {
  const k100 = hit.kcal_per_100g ?? 0;
  const p100 = hit.protein_g_per_100g ?? 0;
  const c100 = hit.carbs_g_per_100g ?? 0;
  const f100 = hit.fat_g_per_100g ?? 0;
  const scale = grams / 100;
  return {
    key: `search-${hit.source}-${hit.source_id}`,
    name: hit.name,
    grams,
    kcal: k100 * scale,
    proteinG: p100 * scale,
    carbsG: c100 * scale,
    fatG: f100 * scale,
    fmaFoodId: hit.food_id,
    fmaSource: hit.source,
    fmaSourceId: hit.source_id,
    confidence: null,
    warnings: [],
    rationale: undefined,
    rawResponse: hit,
    enabled: true,
  };
}

export default function FoodPage() {
  const router = useRouter();
  const params = useSearchParams();
  const modeParam = (params.get("mode") as Mode | null) ?? "text";
  const [mode, setMode] = useState<Mode>(
    modeParam === "search" || modeParam === "text" || modeParam === "snap" ? modeParam : "text",
  );

  const { today, target, addMeal, deleteMeal, editGrams, error: ctxError } = useFoodLog();

  const [pending, setPending] = useState<PendingItem[]>([]);
  const [pendingMealName, setPendingMealName] = useState<string | null>(null);
  const [loggedAtLocal, setLoggedAtLocal] = useState<string>(isoLocalNow());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const switchMode = useCallback(
    (m: Mode) => {
      setMode(m);
      const sp = new URLSearchParams(params.toString());
      sp.set("mode", m);
      router.replace(`/food?${sp.toString()}`, { scroll: false });
    },
    [router, params],
  );

  const resetPending = useCallback(() => {
    setPending([]);
    setPendingMealName(null);
    setLoggedAtLocal(isoLocalNow());
  }, []);

  const onCommit = useCallback(async () => {
    setError(null);
    const items = pending.filter((p) => p.enabled);
    if (!items.length) return;
    setBusy(true);
    try {
      const sourceMap: Record<Mode, FoodLogSource> = {
        search: "search",
        text: "text",
        snap: "photo",
      };
      const loggedAtIso = new Date(loggedAtLocal).toISOString();
      const trimmedName = pendingMealName?.trim() ?? "";
      await addMeal({
        loggedAt: loggedAtIso,
        source: sourceMap[mode],
        mealName: trimmedName.length > 0 ? trimmedName : null,
        items: items.map((it) => ({
          name: it.name,
          grams: it.grams,
          kcal: it.kcal,
          proteinG: it.proteinG,
          carbsG: it.carbsG,
          fatG: it.fatG,
          fmaFoodId: it.fmaFoodId ?? null,
          fmaSource: it.fmaSource ?? null,
          fmaSourceId: it.fmaSourceId ?? null,
          confidence: it.confidence ?? null,
          warnings: it.warnings ?? null,
          rawResponse: it.rawResponse,
        })),
      });
      resetPending();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [pending, mode, loggedAtLocal, pendingMealName, addMeal, resetPending]);

  return (
    <div
      style={{
        padding: "var(--space-xl) var(--space-2xl)",
        maxWidth: 900,
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-xl)",
      }}
    >
      <TodayStrip
        today={today}
        target={target}
        onDelete={deleteMeal}
        onEditGrams={editGrams}
      />

      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <Overline>Log a meal</Overline>
            <h2
              className="text-headline-md"
              style={{ color: "var(--color-text-primary)", margin: "var(--space-2xs) 0 0" }}
            >
              Add to today.
            </h2>
          </div>
        </div>

        <TabBar mode={mode} onChange={switchMode} />

        {mode === "search" && (
          <SearchPanel
            onPick={(items) => {
              setPending(items);
              setPendingMealName(null);
              setLoggedAtLocal(isoLocalNow());
            }}
          />
        )}
        {mode === "text" && (
          <TextPanel
            onResult={(items, mealName) => {
              setPending(items);
              setPendingMealName(mealName ?? null);
              setLoggedAtLocal(isoLocalNow());
            }}
            setError={setError}
          />
        )}
        {mode === "snap" && (
          <PhotoPanel
            onResult={(items, loggedAtIso, mealName) => {
              setPending(items);
              setPendingMealName(mealName ?? null);
              setLoggedAtLocal(loggedAtIso ? toIsoLocal(loggedAtIso) : isoLocalNow());
            }}
            setError={setError}
          />
        )}

        {pending.length > 0 && (
          <ReviewList
            items={pending}
            setItems={setPending}
            mealName={pendingMealName}
            setMealName={setPendingMealName}
            loggedAtLocal={loggedAtLocal}
            setLoggedAtLocal={setLoggedAtLocal}
            onCommit={onCommit}
            onCancel={resetPending}
            busy={busy}
          />
        )}

        {(error ?? ctxError) && <ErrorBanner message={(error ?? ctxError)!} />}
      </Card>
    </div>
  );
}

// ── Today strip ────────────────────────────────────────────────────────────

function TodayStrip({
  today,
  target,
  onDelete,
  onEditGrams,
}: {
  today: MealItem[];
  target: { kcal: number } | null;
  onDelete: (batchId: string) => Promise<void>;
  onEditGrams: (itemId: string, grams: number) => Promise<MealItem | null>;
}) {
  const totalKcal = today.reduce((s, m) => s + m.kcal, 0);
  const groups = useMemo(() => {
    const byBatch = new Map<string, MealItem[]>();
    for (const m of today) {
      const arr = byBatch.get(m.batchId) ?? [];
      arr.push(m);
      byBatch.set(m.batchId, arr);
    }
    return Array.from(byBatch.entries())
      .map(([batchId, items]) => ({
        batchId,
        items: items.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)),
      }))
      .sort((a, b) =>
        b.items[0]?.loggedAt.localeCompare(a.items[0]?.loggedAt ?? "") ?? 0,
      );
  }, [today]);

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <Overline>Today</Overline>
          <h2
            className="text-headline-md"
            style={{ color: "var(--color-text-primary)", margin: "var(--space-2xs) 0 0" }}
          >
            {Math.round(totalKcal).toLocaleString()}
            <small style={{ color: "var(--color-text-tertiary)", fontWeight: 400 }}>
              {" "}/ {target ? target.kcal.toLocaleString() : "—"} kcal
            </small>
          </h2>
        </div>
        <span
          className="font-mono-sm"
          style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}
        >
          {today.length} item{today.length === 1 ? "" : "s"}
        </span>
      </div>

      {groups.length === 0 && (
        <div
          style={{
            padding: "var(--space-lg)",
            textAlign: "center",
            color: "var(--color-text-tertiary)",
            fontSize: 13,
          }}
        >
          Nothing logged yet today.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
        {groups.map((g) => (
          <MealRow
            key={g.batchId}
            items={g.items}
            onDelete={() => onDelete(g.batchId)}
            onEditGrams={onEditGrams}
          />
        ))}
      </div>
    </Card>
  );
}

function MealRow({
  items,
  onDelete,
  onEditGrams,
}: {
  items: MealItem[];
  onDelete: () => Promise<void>;
  onEditGrams: (itemId: string, grams: number) => Promise<MealItem | null>;
}) {
  const [expanded, setExpanded] = useState(false);
  const totalKcal = Math.round(items.reduce((s, i) => s + i.kcal, 0));
  const time = new Date(items[0]?.loggedAt ?? Date.now()).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const mealName = items[0]?.mealName ?? null;
  const label = mealName
    ? mealName
    : items.length === 1
    ? items[0].name
    : `${items[0].name} + ${items.length - 1} more`;

  return (
    <div
      style={{
        background: "var(--color-surface-low)",
        borderRadius: "var(--radius-md)",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "56px 1fr auto auto",
          gap: "var(--space-sm)",
          alignItems: "center",
        }}
      >
        <span
          className="font-mono-sm"
          style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}
        >
          {time}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: "transparent",
            border: 0,
            color: "var(--color-text-primary)",
            fontSize: 13,
            textAlign: "left",
            cursor: "pointer",
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {label}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <span
          className="font-mono-sm"
          style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
        >
          {totalKcal}
          <small style={{ color: "var(--color-text-tertiary)" }}> kcal</small>
        </span>
        <button
          type="button"
          onClick={onDelete}
          title="Delete meal"
          style={{
            background: "transparent",
            border: 0,
            color: "var(--color-text-tertiary)",
            cursor: "pointer",
            padding: 4,
          }}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4, paddingLeft: 56 }}>
          {items.map((it) => (
            <EditableItemRow key={it.id} item={it} onEditGrams={onEditGrams} />
          ))}
        </div>
      )}
    </div>
  );
}

function EditableItemRow({
  item,
  onEditGrams,
}: {
  item: MealItem;
  onEditGrams: (itemId: string, grams: number) => Promise<MealItem | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(item.grams.toString());
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const g = Number(value);
    if (!Number.isFinite(g) || g <= 0) return;
    if (g === item.grams) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      await onEditGrams(item.id, g);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto auto auto",
        gap: 8,
        alignItems: "center",
        fontSize: 12,
        color: "var(--color-text-secondary)",
      }}
    >
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {item.name}
      </span>
      {editing ? (
        <input
          type="number"
          value={value}
          min={0}
          step={1}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
            if (e.key === "Escape") setEditing(false);
          }}
          autoFocus
          style={{
            width: 56,
            background: "var(--color-surface-elevated)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-outline)",
            borderRadius: 4,
            padding: "2px 4px",
            fontSize: 12,
            textAlign: "right",
            fontFamily: "var(--font-mono)",
          }}
        />
      ) : (
        <span
          className="font-mono-sm"
          style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}
        >
          {Math.round(item.grams)}g
        </span>
      )}
      <span className="font-mono-sm" style={{ fontSize: 12 }}>
        {Math.round(item.kcal)} kcal
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => (editing ? void save() : setEditing(true))}
        style={{
          background: "transparent",
          border: 0,
          color: "var(--color-text-tertiary)",
          cursor: "pointer",
          padding: 2,
        }}
      >
        {busy ? <Loader2 size={12} className="spin" /> : <Pencil size={12} />}
      </button>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────

function TabBar({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const tabs: Array<{ id: Mode; label: string; icon: React.ReactNode }> = [
    { id: "search", label: "Search", icon: <SearchIcon size={13} /> },
    { id: "text", label: "Type", icon: <AlignLeft size={13} /> },
    { id: "snap", label: "Snap", icon: <Camera size={13} /> },
  ];
  return (
    <div
      role="tablist"
      style={{
        display: "inline-flex",
        gap: 4,
        padding: 4,
        background: "var(--color-surface-low)",
        borderRadius: "var(--radius-md)",
        width: "fit-content",
      }}
    >
      {tabs.map((t) => {
        const active = t.id === mode;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.id)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: "var(--radius-sm)",
              border: 0,
              background: active ? "var(--color-surface-elevated)" : "transparent",
              color: active ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
              fontSize: 13,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {t.icon}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Search panel ──────────────────────────────────────────────────────────

function SearchPanel({ onPick }: { onPick: (items: PendingItem[]) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<FmaSearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/food/search?q=${encodeURIComponent(q)}&limit=8`);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? `${res.status}`);
        setHits((body.items ?? []) as FmaSearchHit[]);
      } catch (e) {
        setErr((e as Error).message);
        setHits([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  const [pickGrams, setPickGrams] = useState<Record<string, string>>({});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="grilled chicken breast"
        style={inputStyle}
      />
      {loading && <Loader />}
      {err && <ErrorBanner message={err} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {hits.map((h) => {
          const key = `${h.source}:${h.source_id}`;
          const gStr = pickGrams[key] ?? "100";
          const grams = Number(gStr) || 100;
          const kcal = ((h.kcal_per_100g ?? 0) * grams) / 100;
          return (
            <div
              key={key}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 80px 80px auto",
                gap: 8,
                alignItems: "center",
                padding: "8px 10px",
                background: "var(--color-surface-low)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <span style={{ fontSize: 13 }}>{h.name}</span>
              <input
                type="number"
                value={gStr}
                min={1}
                step={1}
                onChange={(e) =>
                  setPickGrams((p) => ({ ...p, [key]: e.target.value }))
                }
                style={{ ...inputStyle, padding: "4px 8px", textAlign: "right" }}
              />
              <span
                className="font-mono-sm"
                style={{ fontSize: 12, color: "var(--color-text-tertiary)", textAlign: "right" }}
              >
                {Math.round(kcal)} kcal
              </span>
              <button
                type="button"
                onClick={() => onPick([fromSearchHit(h, grams)])}
                style={primaryBtnStyle}
              >
                Add
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Text panel ───────────────────────────────────────────────────────────

function TextPanel({
  onResult,
  setError,
}: {
  onResult: (items: PendingItem[], mealName?: string | null) => void;
  setError: (msg: string | null) => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/food/analyze/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = (await res.json()) as FmaAnalyzeResponse & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      onResult(body.items.map(fromFmaItem), body.meal_name ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="3 scrambled eggs and a banana"
        rows={3}
        style={{ ...inputStyle, padding: "10px", fontFamily: "var(--font-body)" }}
      />
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !text.trim()}
          style={primaryBtnStyle}
        >
          {busy ? <Loader2 size={13} className="spin" /> : "Analyze"}
        </button>
      </div>
    </div>
  );
}

// ── Photo panel ──────────────────────────────────────────────────────────

function PhotoPanel({
  onResult,
  setError,
}: {
  onResult: (
    items: PendingItem[],
    loggedAtIso?: string,
    mealName?: string | null,
  ) => void;
  setError: (msg: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const base64 = Buffer.from(buf).toString("base64");
      const res = await fetch("/api/food/analyze/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          filename: file.name,
          mimeType: file.type,
        }),
      });
      const body = (await res.json()) as FmaAnalyzeResponse & {
        exifDate?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setPreviewUrl(URL.createObjectURL(file));
      onResult(
        body.items.map(fromFmaItem),
        body.exifDate ?? undefined,
        body.meal_name ?? null,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-sm)" }}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--space-lg)",
          border: "1px dashed var(--color-outline)",
          borderRadius: "var(--radius-md)",
          cursor: "pointer",
          color: "var(--color-text-tertiary)",
          fontSize: 13,
          gap: 8,
        }}
      >
        {busy ? <Loader2 size={14} className="spin" /> : <Camera size={14} />}
        {busy ? "Analyzing…" : "Tap to pick a photo"}
        <input
          type="file"
          accept="image/*,.heic,.heif"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
          }}
        />
      </label>
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="meal"
          style={{ maxHeight: 200, borderRadius: "var(--radius-md)", objectFit: "cover" }}
        />
      )}
    </div>
  );
}

// ── Review list ──────────────────────────────────────────────────────────

function ReviewList({
  items,
  setItems,
  mealName,
  setMealName,
  loggedAtLocal,
  setLoggedAtLocal,
  onCommit,
  onCancel,
  busy,
}: {
  items: PendingItem[];
  setItems: (next: PendingItem[]) => void;
  mealName: string | null;
  setMealName: (next: string | null) => void;
  loggedAtLocal: string;
  setLoggedAtLocal: (v: string) => void;
  onCommit: () => Promise<void>;
  onCancel: () => void;
  busy: boolean;
}) {
  const totals = items
    .filter((i) => i.enabled)
    .reduce(
      (acc, i) => ({
        kcal: acc.kcal + i.kcal,
        proteinG: acc.proteinG + i.proteinG,
        carbsG: acc.carbsG + i.carbsG,
        fatG: acc.fatG + i.fatG,
      }),
      { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );
  const hasInvalidGrams = items.some(
    (i) => i.enabled && (!Number.isFinite(i.grams) || i.grams <= 0),
  );

  return (
    <div
      style={{
        marginTop: "var(--space-md)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-sm)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span className="text-label-md" style={{ color: "var(--color-text-tertiary)" }}>
          Review · {items.filter((i) => i.enabled).length} item(s)
        </span>
        <span className="font-mono-sm" style={{ fontSize: 13 }}>
          {Math.round(totals.kcal)} kcal · P {Math.round(totals.proteinG)} ·
          C {Math.round(totals.carbsG)} · F {Math.round(totals.fatG)}
        </span>
      </div>

      <input
        type="text"
        value={mealName ?? ""}
        onChange={(e) => setMealName(e.target.value || null)}
        placeholder="Meal name (optional)"
        style={{
          ...inputStyle,
          fontFamily: "var(--font-body)",
          fontSize: 14,
          fontWeight: 500,
        }}
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {items.map((it, idx) => (
          <ReviewRow
            key={it.key}
            item={it}
            onChange={(next) => {
              const copy = items.slice();
              copy[idx] = next;
              setItems(copy);
            }}
          />
        ))}
      </div>

      <div style={{ display: "flex", gap: "var(--space-sm)", alignItems: "center" }}>
        <label
          className="text-label-md"
          style={{ color: "var(--color-text-tertiary)", fontSize: 11 }}
        >
          When
        </label>
        <input
          type="datetime-local"
          value={loggedAtLocal}
          onChange={(e) => setLoggedAtLocal(e.target.value)}
          style={{ ...inputStyle, padding: "6px 8px", width: "fit-content" }}
        />
        <div style={{ flex: 1 }} />
        <button type="button" onClick={onCancel} style={secondaryBtnStyle}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onCommit}
          disabled={busy || !items.some((i) => i.enabled) || hasInvalidGrams}
          title={hasInvalidGrams ? "Set grams > 0 on every enabled item" : undefined}
          style={primaryBtnStyle}
        >
          {busy ? <Loader2 size={13} className="spin" /> : "Add to log"}
        </button>
      </div>
      {hasInvalidGrams && (
        <ErrorBanner message="One or more items have grams = 0. Set grams or untick the row before committing." />
      )}
    </div>
  );
}

function ReviewRow({
  item,
  onChange,
}: {
  item: PendingItem;
  onChange: (next: PendingItem) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const lowConf = item.confidence !== null && item.confidence !== undefined && item.confidence < LOW_CONF;
  const hasWarnings = (item.warnings?.length ?? 0) > 0;

  const updateGrams = (g: number) => {
    if (item.grams <= 0) {
      onChange({ ...item, grams: g });
      return;
    }
    const scale = g / item.grams;
    onChange({
      ...item,
      grams: g,
      kcal: item.kcal * scale,
      proteinG: item.proteinG * scale,
      carbsG: item.carbsG * scale,
      fatG: item.fatG * scale,
    });
  };

  return (
    <div
      style={{
        background: "var(--color-surface-low)",
        borderRadius: "var(--radius-md)",
        padding: "8px 10px",
        opacity: item.enabled ? 1 : 0.5,
        boxShadow:
          item.enabled && (!Number.isFinite(item.grams) || item.grams <= 0)
            ? "inset 0 0 0 1px var(--color-semantic-danger)"
            : undefined,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr 72px 80px auto",
          gap: 8,
          alignItems: "center",
        }}
      >
        <input
          type="checkbox"
          checked={item.enabled}
          onChange={(e) => onChange({ ...item, enabled: e.target.checked })}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            style={{
              fontSize: 13,
              color: "var(--color-text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {item.name}
          </span>
          {lowConf && (
            <span
              title={`confidence ${Math.round((item.confidence ?? 0) * 100)}%`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
                padding: "2px 6px",
                background: "rgba(255,201,74,0.14)",
                color: "var(--color-semantic-warning)",
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 999,
              }}
            >
              <AlertTriangle size={9} />
              low
            </span>
          )}
        </div>
        <input
          type="number"
          value={item.grams.toString()}
          min={0}
          step={1}
          onChange={(e) => updateGrams(Number(e.target.value))}
          style={{ ...inputStyle, padding: "4px 8px", textAlign: "right" }}
        />
        <span
          className="font-mono-sm"
          style={{ fontSize: 12, color: "var(--color-text-secondary)", textAlign: "right" }}
        >
          {Math.round(item.kcal)} kcal
        </span>
        {(hasWarnings || item.rationale) && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            style={{
              background: "transparent",
              border: 0,
              color: "var(--color-text-tertiary)",
              cursor: "pointer",
              padding: 4,
            }}
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        )}
      </div>
      {expanded && (
        <div style={{ marginTop: 6, paddingLeft: 30, display: "flex", flexDirection: "column", gap: 4 }}>
          {item.warnings?.map((w, i) => (
            <div
              key={i}
              style={{
                fontSize: 11,
                color: "var(--color-semantic-danger)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <AlertTriangle size={10} />
              {w}
            </div>
          ))}
          {item.rationale && (
            <div
              style={{
                fontSize: 11,
                color: "var(--color-text-tertiary)",
                fontStyle: "italic",
              }}
            >
              {item.rationale}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Bits ─────────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--color-surface-card)",
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-md)",
        width: "100%",
      }}
    >
      {children}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "rgba(255,99,108,0.12)",
        color: "var(--color-semantic-danger)",
        padding: "8px 12px",
        borderRadius: "var(--radius-md)",
        fontSize: 12,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <AlertTriangle size={12} />
      {message}
    </div>
  );
}

function Loader() {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        color: "var(--color-text-tertiary)",
        fontSize: 12,
      }}
    >
      <Loader2 size={12} className="spin" />
      Searching…
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface-elevated)",
  color: "var(--color-text-primary)",
  border: "1px solid var(--color-outline)",
  borderRadius: "var(--radius-md)",
  padding: "8px 12px",
  fontSize: 13,
  fontFamily: "var(--font-mono)",
};

const primaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  height: 32,
  padding: "0 12px",
  borderRadius: "var(--radius-md)",
  background: "var(--color-brand-primary)",
  color: "var(--color-text-on-brand)",
  border: 0,
  fontWeight: 500,
  fontSize: 13,
  cursor: "pointer",
};

const secondaryBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  height: 32,
  padding: "0 12px",
  borderRadius: "var(--radius-md)",
  background: "var(--color-surface-elevated)",
  color: "var(--color-text-primary)",
  border: 0,
  boxShadow: "inset 0 0 0 1px var(--color-outline)",
  fontSize: 13,
  cursor: "pointer",
};
