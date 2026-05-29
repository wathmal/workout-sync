"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Camera,
  AlignLeft,
  Search as SearchIcon,
  ScanBarcode,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Loader2,
  CornerDownRight,
} from "lucide-react";
import { Overline } from "@/app/_components/overline";
import { useFoodLog } from "@/app/_providers/food-log-provider";
import {
  useFoodLocale,
  FOOD_LOCALES,
  type FoodLocale,
} from "@/app/_providers/food-locale";
import type {
  FmaAnalyzeResponse,
  FmaSearchHit,
  FmaItem,
  FoodLogSource,
  MealItem,
} from "@/lib/food/types";
import { PhotoDropzone } from "@/app/_components/photo-dropzone";
import type { PreparedImage } from "@/lib/image-resize";

type Mode = "search" | "text" | "snap" | "barcode";

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
    modeParam === "search" ||
      modeParam === "text" ||
      modeParam === "snap" ||
      modeParam === "barcode"
      ? modeParam
      : "text",
  );

  const { today, target, addMeal, deleteMeal, editGrams, error: ctxError } = useFoodLog();
  const { locale, setLocale } = useFoodLocale();

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
        barcode: "barcode",
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
      className="food-page-shell"
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
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "var(--space-md)",
            flexWrap: "wrap",
          }}
        >
          <div>
            <Overline>Log a meal</Overline>
            <h2
              className="text-headline-md"
              style={{ color: "var(--color-text-primary)", margin: "var(--space-2xs) 0 0" }}
            >
              Add to today.
            </h2>
          </div>
          <LocaleSelect value={locale} onChange={setLocale} />
        </div>

        <TabBar mode={mode} onChange={switchMode} />

        {mode === "search" && (
          <SearchPanel
            locale={locale}
            onPick={(items) => {
              setPending(items);
              setPendingMealName(null);
              setLoggedAtLocal(isoLocalNow());
            }}
          />
        )}
        {mode === "text" && (
          <TextPanel
            locale={locale}
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
            locale={locale}
            onResult={(items, loggedAtIso, mealName) => {
              setPending(items);
              setPendingMealName(mealName ?? null);
              setLoggedAtLocal(loggedAtIso ? toIsoLocal(loggedAtIso) : isoLocalNow());
            }}
            setError={setError}
          />
        )}
        {mode === "barcode" && (
          <BarcodePanel
            locale={locale}
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
  const totals = items.reduce(
    (acc, i) => ({
      kcal: acc.kcal + i.kcal,
      p: acc.p + i.proteinG,
      c: acc.c + i.carbsG,
      f: acc.f + i.fatG,
    }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
  const totalKcal = Math.round(totals.kcal);
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
      className="food-mealrow"
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
        className="food-mealrow-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "56px 1fr 140px 86px 28px",
          gap: 8,
          alignItems: "center",
        }}
      >
        <span
          className="font-mono-sm food-mealrow-time"
          style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}
        >
          {time}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="food-mealrow-name"
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
            minWidth: 0,
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {label}
          </span>
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
        <MacroChips p={totals.p} c={totals.c} f={totals.f} className="food-mealrow-macros" />
        <KcalCell kcal={totalKcal} className="food-mealrow-kcal" />
        <button
          type="button"
          onClick={onDelete}
          title="Delete meal"
          className="food-mealrow-delete"
          style={iconBtnStyle}
        >
          <Trash2 size={13} />
        </button>
      </div>

      {expanded && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            paddingLeft: 24,
            marginLeft: 32,
            borderLeft: "1px solid var(--color-outline)",
          }}
        >
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
      className="food-item-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "14px 1fr 56px 140px 86px 28px",
        gap: 8,
        alignItems: "center",
        fontSize: 12,
        color: "var(--color-text-secondary)",
      }}
    >
      <CornerDownRight size={12} color="var(--color-text-tertiary)" />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
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
      <MacroChips p={item.proteinG} c={item.carbsG} f={item.fatG} />
      <KcalCell kcal={item.kcal} size={12} />
      <button
        type="button"
        disabled={busy}
        onClick={() => (editing ? void save() : setEditing(true))}
        style={iconBtnStyle}
      >
        {busy ? <Loader2 size={12} className="spin" /> : <Pencil size={12} />}
      </button>
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
  border: 0,
  color: "var(--color-text-tertiary)",
  cursor: "pointer",
  padding: 0,
};

function MacroChips({ p, c, f, className }: { p: number; c: number; f: number; className?: string }) {
  // padStart to 2 chars + white-space: pre keeps the leading space so single-
  // and double-digit values align under each other in the monospace font.
  const fmt = (n: number) => String(Math.round(n)).padStart(3, " ");
  const sep = <span style={{ color: "var(--color-outline)" }}>·</span>;
  const cell: React.CSSProperties = { whiteSpace: "pre" };
  return (
    <span
      className={`font-mono-sm food-macros ${className ?? ""}`}
      style={{
        fontSize: 11,
        color: "var(--color-text-tertiary)",
        display: "inline-flex",
        alignItems: "baseline",
        justifyContent: "flex-end",
        gap: 6,
        width: 140,
      }}
    >
      <span style={cell}>P {fmt(p)}</span>
      <span className="food-macros-extra" style={{ display: "inline-flex", alignItems: "baseline", gap: 6 }}>
        {sep}
        <span style={cell}>C {fmt(c)}</span>
        {sep}
        <span style={cell}>F {fmt(f)}</span>
      </span>
    </span>
  );
}

function KcalCell({ kcal, size = 13, className }: { kcal: number; size?: number; className?: string }) {
  return (
    <span
      className={`font-mono-sm ${className ?? ""}`}
      style={{
        fontSize: size,
        color: "var(--color-text-secondary)",
        display: "inline-block",
        width: 86,
        textAlign: "right",
        whiteSpace: "nowrap",
      }}
    >
      {Math.round(kcal)}
      <small style={{ color: "var(--color-text-tertiary)" }}> kcal</small>
    </span>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────

function TabBar({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const tabs: Array<{ id: Mode; label: string; icon: React.ReactNode }> = [
    { id: "search", label: "Search", icon: <SearchIcon size={13} /> },
    { id: "text", label: "Type", icon: <AlignLeft size={13} /> },
    { id: "snap", label: "Snap", icon: <Camera size={13} /> },
    { id: "barcode", label: "Barcode", icon: <ScanBarcode size={13} /> },
  ];
  return (
    <div
      role="tablist"
      className="food-tabbar"
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
            className="food-tab-btn"
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
              whiteSpace: "nowrap",
              flex: "1 1 0",
              justifyContent: "center",
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

// ── Shared panel primitives ──────────────────────────────────────────────

const panelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "var(--space-sm)",
};

const panelTextareaStyle: React.CSSProperties = {
  background: "var(--color-surface-elevated)",
  color: "var(--color-text-primary)",
  border: "1px solid var(--color-outline)",
  borderRadius: "var(--radius-md)",
  padding: "8px 10px",
  fontFamily: "var(--font-body)",
  fontSize: 13,
  resize: "vertical",
  minHeight: 56,
};

const previewImgStyle: React.CSSProperties = {
  maxHeight: 180,
  maxWidth: "100%",
  width: "auto",
  alignSelf: "flex-start",
  borderRadius: "var(--radius-md)",
  objectFit: "contain",
};

function PanelLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="text-label-md"
      style={{
        color: "var(--color-text-tertiary)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {children}
    </label>
  );
}

function ActionRow({
  busy,
  disabled,
  onClick,
  label = "Analyze",
}: {
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <button
        type="button"
        onClick={onClick}
        disabled={busy || disabled}
        style={primaryBtnStyle}
      >
        {busy ? <Loader2 size={13} className="spin" /> : label}
      </button>
    </div>
  );
}

// ── Search panel ──────────────────────────────────────────────────────────

function SearchPanel({
  locale,
  onPick,
}: {
  locale: FoodLocale;
  onPick: (items: PendingItem[]) => void;
}) {
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
        const url = new URL("/api/food/search", window.location.origin);
        url.searchParams.set("q", q);
        url.searchParams.set("limit", "8");
        if (locale && locale !== "en") url.searchParams.set("locale", locale);
        const res = await fetch(url.pathname + url.search);
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
  }, [q, locale]);

  const [pickGrams, setPickGrams] = useState<Record<string, string>>({});

  return (
    <div style={panelStyle}>
      <PanelLabel>Find food</PanelLabel>
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
              className="food-search-row"
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
  locale,
  onResult,
  setError,
}: {
  locale: FoodLocale;
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
        body: JSON.stringify({ text, locale: locale === "en" ? undefined : locale }),
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
    <div style={panelStyle}>
      <PanelLabel>Describe meal</PanelLabel>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="3 scrambled eggs and a banana"
        rows={3}
        style={{ ...panelTextareaStyle, minHeight: 72 }}
      />
      <ActionRow busy={busy} disabled={!text.trim()} onClick={submit} />
    </div>
  );
}

// ── Photo panel ──────────────────────────────────────────────────────────

function PhotoPanel({
  locale,
  onResult,
  setError,
}: {
  locale: FoodLocale;
  onResult: (
    items: PendingItem[],
    loggedAtIso?: string,
    mealName?: string | null,
  ) => void;
  setError: (msg: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const contextRef = useRef(context);
  contextRef.current = context;

  const handlePrepared = async (prepared: PreparedImage) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/food/analyze/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: prepared.base64,
          filename: prepared.filename,
          mimeType: prepared.mimeType,
          capturedAt: prepared.capturedAt ? prepared.capturedAt.toISOString() : null,
          locale: locale === "en" ? undefined : locale,
          context: contextRef.current.trim() || undefined,
        }),
      });
      const body = (await res.json()) as FmaAnalyzeResponse & {
        exifDate?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setPreviewUrl(`data:${prepared.mimeType};base64,${prepared.base64}`);
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
    <div style={panelStyle}>
      <PanelLabel>Context (optional)</PanelLabel>
      <textarea
        value={context}
        onChange={(e) => setContext(e.target.value)}
        rows={2}
        placeholder="e.g. 'two eggs, sourdough toast, butter'"
        style={panelTextareaStyle}
      />
      <PanelLabel>Meal photo</PanelLabel>
      <PhotoDropzone
        icon={<Camera size={14} />}
        label="Tap to pick a photo · or paste"
        busyLabel="Analyzing…"
        busy={busy}
        onPrepared={handlePrepared}
        onError={setError}
      />
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="meal" style={previewImgStyle} />
      )}
    </div>
  );
}

// ── Barcode panel ────────────────────────────────────────────────────────

function BarcodePanel({
  locale,
  onResult,
  setError,
}: {
  locale: FoodLocale;
  onResult: (
    items: PendingItem[],
    loggedAtIso?: string,
    mealName?: string | null,
  ) => void;
  setError: (msg: string | null) => void;
}) {
  const [code, setCode] = useState("");
  const [busyCode, setBusyCode] = useState(false);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const submitCode = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusyCode(true);
    setError(null);
    try {
      const res = await fetch("/api/food/analyze/barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: trimmed,
          locale: locale === "en" ? undefined : locale,
        }),
      });
      const body = (await res.json()) as FmaAnalyzeResponse & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      onResult(body.items.map(fromFmaItem), undefined, body.meal_name ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyCode(false);
    }
  };

  const handlePrepared = async (prepared: PreparedImage) => {
    setBusyPhoto(true);
    setError(null);
    try {
      const res = await fetch("/api/food/analyze/barcode-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: prepared.base64,
          filename: prepared.filename,
          mimeType: prepared.mimeType,
          capturedAt: prepared.capturedAt ? prepared.capturedAt.toISOString() : null,
          locale: locale === "en" ? undefined : locale,
        }),
      });
      const body = (await res.json()) as FmaAnalyzeResponse & {
        exifDate?: string | null;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setPreviewUrl(`data:${prepared.mimeType};base64,${prepared.base64}`);
      onResult(
        body.items.map(fromFmaItem),
        body.exifDate ?? undefined,
        body.meal_name ?? null,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyPhoto(false);
    }
  };

  return (
    <div style={panelStyle}>
      <PanelLabel>Type a barcode</PanelLabel>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void submitCode();
        }}
        placeholder="0123456789012"
        style={inputStyle}
      />
      <ActionRow busy={busyCode} disabled={!code.trim()} onClick={submitCode} />

      <Divider label="or snap a barcode" />

      <PanelLabel>Barcode photo</PanelLabel>
      <PhotoDropzone
        icon={<ScanBarcode size={14} />}
        label="Tap to pick a barcode photo · or paste"
        busyLabel="Decoding…"
        busy={busyPhoto}
        onPrepared={handlePrepared}
        onError={setError}
      />
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="barcode" style={previewImgStyle} />
      )}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-sm)",
        color: "var(--color-text-tertiary)",
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      <span style={{ flex: 1, height: 1, background: "var(--color-outline)" }} />
      {label}
      <span style={{ flex: 1, height: 1, background: "var(--color-outline)" }} />
    </div>
  );
}

// ── Locale select ────────────────────────────────────────────────────────

function LocaleSelect({
  value,
  onChange,
}: {
  value: FoodLocale;
  onChange: (v: FoodLocale) => void;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 32,
        padding: "0 8px 0 12px",
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface-elevated)",
        color: "var(--color-text-primary)",
        boxShadow: "inset 0 0 0 1px var(--color-outline)",
        fontSize: 12,
        cursor: "pointer",
      }}
      title="Preferred food data source"
    >
      <span style={{ color: "var(--color-text-tertiary)" }}>Source</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as FoodLocale)}
        style={{
          appearance: "none",
          background: "transparent",
          color: "var(--color-text-primary)",
          border: 0,
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          padding: "0 16px 0 4px",
          cursor: "pointer",
        }}
      >
        {FOOD_LOCALES.map((l) => (
          <option key={l.value} value={l.value}>
            {l.label} · {l.hint}
          </option>
        ))}
      </select>
      <ChevronDown size={12} style={{ marginLeft: -14, pointerEvents: "none" }} />
    </label>
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
        className="food-review-row-grid"
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
