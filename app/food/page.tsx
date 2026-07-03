"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Camera,
  AlignLeft,
  Search as SearchIcon,
  ScanBarcode,
  Package,
  Trash2,
  Pencil,
  Star,
  Plus,
  Copy,
  Check,
  ClipboardPaste,
  ClipboardX,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Lock,
  ReceiptText,
  Minus,
  CornerDownRight,
} from "lucide-react";
import { Overline } from "@/app/_components/overline";
import { useFoodLog, type CopiedMeal } from "@/app/_providers/food-log-provider";
import {
  useFoodLocale,
  FOOD_LOCALES,
  type FoodLocale,
} from "@/app/_providers/food-locale";
import type {
  FavoriteMeal,
  FmaAnalyzeResponse,
  FmaItem,
  FmaSearchHit,
  FmaOffSearchHit,
  FmaServing,
  FoodLogSource,
  MealItem,
  PendingItem,
} from "@/lib/food/types";
import { fromFmaItem, fromFmaAnalyzeItem, displayComponents, pendingRawResponse, defaultGramsForHit } from "@/lib/food/convert";
import { favoriteSignature } from "@/lib/food/favorite-signature";
import { MacroChips, KcalCell, iconBtnStyle } from "@/components/food/meal-row";
import { PhotoDropzone } from "@/app/_components/photo-dropzone";
import type { PreparedImage } from "@/lib/image-resize";
import {
  todayLocalStr,
  addDaysStr,
  formatDayLabel,
  defaultLoggedAtDate,
} from "@/lib/food/local-date";

type Mode = "search" | "off" | "text" | "snap" | "barcode" | "label" | "favorites";

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

/** Default log timestamp for the navigator's selected day (shared now-or-noon rule). */
function defaultLoggedAt(dateStr: string): string {
  return toIsoLocal(defaultLoggedAtDate(dateStr).toISOString());
}


function fromSearchHit(hit: FmaSearchHit, grams: number): PendingItem {
  // Search rows are per_100g basis: `nutrients.macros` are the per-100g values.
  const m = hit.nutrients.macros;
  const k100 = m.kcal ?? 0;
  const p100 = m.protein_g ?? 0;
  const c100 = m.carbs_g ?? 0;
  const f100 = m.fat_g ?? 0;
  const scale = grams / 100;
  return {
    key: `search-${hit.source}-${hit.source_id}`,
    source: "search",
    name: hit.name,
    grams,
    kcal: k100 * scale,
    proteinG: p100 * scale,
    carbsG: c100 * scale,
    fatG: f100 * scale,
    basePerG: {
      kcal: k100 / 100,
      proteinG: p100 / 100,
      carbsG: c100 / 100,
      fatG: f100 / 100,
    },
    serving: hit.nutrients.serving ?? null,
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

// useSearchParams (date nav) requires a Suspense boundary for static prerender.
export default function FoodPage() {
  return (
    <Suspense fallback={null}>
      <FoodPageInner />
    </Suspense>
  );
}

function FoodPageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const modeParam = (params.get("mode") as Mode | null) ?? "text";
  const [mode, setMode] = useState<Mode>(
    modeParam === "search" ||
      modeParam === "off" ||
      modeParam === "text" ||
      modeParam === "snap" ||
      modeParam === "barcode" ||
      modeParam === "label" ||
      modeParam === "favorites"
      ? modeParam
      : "text",
  );

  const {
    dayMeals,
    target,
    selectedDate,
    setSelectedDate,
    dayLoading,
    addMeal,
    deleteMeal,
    editGrams,
    editServings,
    favorites,
    favoriteSignatures,
    toggleFavoriteForBatch,
    removeFavorite,
    logFavorite,
    copiedMeal,
    copyMeal,
    cancelCopy,
    pasteMeal,
    error: ctxError,
  } = useFoodLog();
  const { locale, setLocale } = useFoodLocale();

  const [pending, setPending] = useState<PendingItem[]>([]);
  const [pendingMealName, setPendingMealName] = useState<string | null>(null);
  const [loggedAtLocal, setLoggedAtLocal] = useState<string>(() =>
    defaultLoggedAt(selectedDate),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Monotonic counter so repeated foods get unique React keys (dupes allowed).
  const keyCounter = useRef(0);
  // First-write-wins for the log time: once a panel (EXIF) or the user sets it,
  // later appends must not move it.
  const loggedAtTouched = useRef(false);

  // New meals default to the day being viewed (now if today, noon otherwise).
  useEffect(() => {
    setLoggedAtLocal(defaultLoggedAt(selectedDate));
    loggedAtTouched.current = false;
  }, [selectedDate]);

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
    setLoggedAtLocal(defaultLoggedAt(selectedDate));
    loggedAtTouched.current = false;
  }, [selectedDate]);

  // Append a panel's result to the running meal instead of replacing it.
  // Meal name + log time are first-write-wins so later sources don't clobber them.
  const appendItems = useCallback(
    (
      items: PendingItem[],
      meta?: { mealName?: string | null; loggedAtIso?: string },
    ) => {
      if (!items.length) return;
      setError(null);
      const tagged = items.map((it) => ({
        ...it,
        key: `${it.key}#${keyCounter.current++}`,
      }));
      setPending((prev) => [...prev, ...tagged]);
      if (meta?.mealName) {
        setPendingMealName((prev) =>
          prev && prev.trim().length > 0 ? prev : meta.mealName ?? prev,
        );
      }
      if (meta?.loggedAtIso && !loggedAtTouched.current) {
        setLoggedAtLocal(toIsoLocal(meta.loggedAtIso));
        loggedAtTouched.current = true;
      }
    },
    [],
  );

  // The review "When" field — mark the time as user-touched so EXIF from a
  // later appended photo won't override it.
  const handleSetLoggedAt = useCallback((v: string) => {
    setLoggedAtLocal(v);
    loggedAtTouched.current = true;
  }, []);

  const onCommit = useCallback(async () => {
    setError(null);
    const items = pending.filter((p) => p.enabled);
    if (!items.length) return;
    setBusy(true);
    try {
      const loggedAtIso = new Date(loggedAtLocal).toISOString();
      const trimmedName = pendingMealName?.trim() ?? "";
      await addMeal({
        loggedAt: loggedAtIso,
        // Per-item `source` carries the true origin; batch source is a fallback only.
        source: items[0]?.source ?? "manual",
        mealName: trimmedName.length > 0 ? trimmedName : null,
        items: items.map((it) => ({
          name: it.name,
          grams: it.grams,
          kcal: it.kcal,
          proteinG: it.proteinG,
          carbsG: it.carbsG,
          fatG: it.fatG,
          source: it.source,
          fmaFoodId: it.fmaFoodId ?? null,
          fmaSource: it.fmaSource ?? null,
          fmaSourceId: it.fmaSourceId ?? null,
          confidence: it.confidence ?? null,
          warnings: it.warnings ?? null,
          // Portion axis (label items scale by servings, grams-free).
          unit: it.unit ?? "g",
          servings: it.servings,
          servingLabel: it.servingLabel ?? null,
          // For a grams-edited composite, rescale the stored breakdown to match.
          rawResponse: pendingRawResponse(it),
        })),
      });
      resetPending();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [pending, loggedAtLocal, pendingMealName, addMeal, resetPending]);

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
        meals={dayMeals}
        target={target}
        selectedDate={selectedDate}
        loading={dayLoading}
        canGoNext={selectedDate < todayLocalStr()}
        onPrev={() => setSelectedDate(addDaysStr(selectedDate, -1))}
        onNext={() => setSelectedDate(addDaysStr(selectedDate, 1))}
        onDelete={deleteMeal}
        onEditGrams={editGrams}
        onEditServings={editServings}
        favoriteSignatures={favoriteSignatures}
        onToggleFavorite={toggleFavoriteForBatch}
        copiedMeal={copiedMeal}
        onCopy={(items) => copyMeal(items, selectedDate)}
        onPaste={() => pasteMeal(selectedDate)}
        onCancelCopy={cancelCopy}
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
              {selectedDate === todayLocalStr()
                ? "Add to today."
                : `Add to ${formatDayLabel(selectedDate)}.`}
            </h2>
          </div>
          <LocaleSelect value={locale} onChange={setLocale} />
        </div>

        <TabBar mode={mode} onChange={switchMode} />

        {mode === "search" && (
          <SearchPanel
            locale={locale}
            onPick={(items) => appendItems(items)}
          />
        )}
        {mode === "off" && (
          <OffSearchPanel
            locale={locale}
            onResult={(items) => appendItems(items)}
            setError={setError}
          />
        )}
        {mode === "text" && (
          <TextPanel
            locale={locale}
            onResult={(items, mealName) => appendItems(items, { mealName })}
            setError={setError}
          />
        )}
        {mode === "snap" && (
          <PhotoPanel
            locale={locale}
            onResult={(items, loggedAtIso, mealName) =>
              appendItems(items, { mealName, loggedAtIso })
            }
            setError={setError}
          />
        )}
        {mode === "barcode" && (
          <BarcodePanel
            locale={locale}
            onResult={(items, loggedAtIso, mealName) =>
              appendItems(items, { mealName, loggedAtIso })
            }
            setError={setError}
          />
        )}
        {mode === "label" && (
          <LabelPanel
            locale={locale}
            onResult={(items, loggedAtIso) => appendItems(items, { loggedAtIso })}
            setError={setError}
          />
        )}
        {mode === "favorites" && (
          <FavoritesPanel
            favorites={favorites}
            onLog={logFavorite}
            onRemove={removeFavorite}
          />
        )}

        {pending.length > 0 && (
          <ReviewList
            items={pending}
            setItems={setPending}
            mealName={pendingMealName}
            setMealName={setPendingMealName}
            loggedAtLocal={loggedAtLocal}
            setLoggedAtLocal={handleSetLoggedAt}
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

function DayNavButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 26,
        height: 26,
        border: "none",
        background: "transparent",
        color: disabled ? "var(--color-text-muted)" : "var(--color-text-secondary)",
        borderRadius: "var(--radius-md)",
        cursor: disabled ? "default" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function TodayStrip({
  meals,
  target,
  selectedDate,
  loading,
  canGoNext,
  onPrev,
  onNext,
  onDelete,
  onEditGrams,
  onEditServings,
  favoriteSignatures,
  onToggleFavorite,
  copiedMeal,
  onCopy,
  onPaste,
  onCancelCopy,
}: {
  meals: MealItem[];
  target: { kcal: number } | null;
  selectedDate: string;
  loading: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onDelete: (batchId: string) => Promise<void>;
  onEditGrams: (itemId: string, grams: number) => Promise<MealItem | null>;
  onEditServings: (itemId: string, servings: number) => Promise<MealItem | null>;
  favoriteSignatures: Set<string>;
  onToggleFavorite: (batchId: string, signature: string) => Promise<void>;
  copiedMeal: CopiedMeal | null;
  onCopy: (items: MealItem[]) => void;
  onPaste: () => Promise<void>;
  onCancelCopy: () => void;
}) {
  const [pasting, setPasting] = useState(false);
  const canPasteHere = copiedMeal !== null && copiedMeal.sourceDate !== selectedDate;
  const isToday = selectedDate === todayLocalStr();
  const totalKcal = meals.reduce((s, m) => s + m.kcal, 0);
  const groups = useMemo(() => {
    const byBatch = new Map<string, MealItem[]>();
    for (const m of meals) {
      const arr = byBatch.get(m.batchId) ?? [];
      arr.push(m);
      byBatch.set(m.batchId, arr);
    }
    return Array.from(byBatch.entries())
      .map(([batchId, items]) => ({
        batchId,
        items: items.sort((a, b) => a.loggedAt.localeCompare(b.loggedAt)),
        signature: favoriteSignature(
          items[0]?.mealName ?? null,
          items.map((i) => i.name),
        ),
      }))
      .sort((a, b) =>
        b.items[0]?.loggedAt.localeCompare(a.items[0]?.loggedAt ?? "") ?? 0,
      );
  }, [meals]);

  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2xs)" }}>
            <DayNavButton label="Previous day" onClick={onPrev}>
              <ChevronLeft size={16} />
            </DayNavButton>
            <Overline>{formatDayLabel(selectedDate)}</Overline>
            <DayNavButton label="Next day" onClick={onNext} disabled={!canGoNext}>
              <ChevronRight size={16} />
            </DayNavButton>
          </div>
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
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          {canPasteHere && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
                background: "var(--color-surface-low)",
                border: "1px solid var(--color-outline)",
                borderRadius: "var(--radius-full)",
                padding: "1px 4px",
              }}
            >
              <button
                type="button"
                onClick={async () => {
                  if (pasting) return;
                  setPasting(true);
                  try {
                    await onPaste();
                  } finally {
                    setPasting(false);
                  }
                }}
                disabled={pasting}
                title="Paste meal here"
                style={{ ...iconBtnStyle, color: "var(--color-text-primary)" }}
              >
                <ClipboardPaste size={15} />
              </button>
              <span style={{ width: 1, height: 14, background: "var(--color-outline)" }} />
              <button
                type="button"
                onClick={onCancelCopy}
                disabled={pasting}
                title="Cancel copy"
                style={iconBtnStyle}
              >
                <ClipboardX size={15} />
              </button>
            </span>
          )}
          <span
            className="font-mono-sm"
            style={{ fontSize: 12, color: "var(--color-text-tertiary)" }}
          >
            {loading ? "…" : `${meals.length} item${meals.length === 1 ? "" : "s"}`}
          </span>
        </span>
      </div>

      {!loading && groups.length === 0 && (
        <div
          style={{
            padding: "var(--space-lg)",
            textAlign: "center",
            color: "var(--color-text-tertiary)",
            fontSize: 13,
          }}
        >
          {isToday ? "Nothing logged yet today." : "Nothing logged this day."}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
        {groups.map((g) => (
          <MealRow
            key={g.batchId}
            items={g.items}
            onDelete={() => onDelete(g.batchId)}
            onEditGrams={onEditGrams}
            onEditServings={onEditServings}
            isFavorited={favoriteSignatures.has(g.signature)}
            onToggleFavorite={() => onToggleFavorite(g.batchId, g.signature)}
            isCopied={copiedMeal?.items[0]?.batchId === g.batchId}
            onCopy={() => onCopy(g.items)}
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
  onEditServings,
  isFavorited,
  onToggleFavorite,
  isCopied,
  onCopy,
}: {
  items: MealItem[];
  onDelete: () => Promise<void>;
  onEditGrams: (itemId: string, grams: number) => Promise<MealItem | null>;
  onEditServings: (itemId: string, servings: number) => Promise<MealItem | null>;
  isFavorited: boolean;
  onToggleFavorite: () => Promise<void>;
  isCopied: boolean;
  onCopy: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
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
          gridTemplateColumns: "56px 1fr 140px 86px 28px 28px 28px",
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
          onClick={onCopy}
          title={isCopied ? "Copied" : "Copy meal"}
          aria-pressed={isCopied}
          className="food-mealrow-copy"
          style={{
            ...iconBtnStyle,
            color: isCopied ? "var(--color-text-primary)" : undefined,
          }}
        >
          {isCopied ? <Check size={13} /> : <Copy size={13} />}
        </button>
        <button
          type="button"
          onClick={async () => {
            if (favBusy) return;
            setFavBusy(true);
            try {
              await onToggleFavorite();
            } finally {
              setFavBusy(false);
            }
          }}
          disabled={favBusy}
          title={isFavorited ? "Remove from favorites" : "Save as favorite"}
          aria-pressed={isFavorited}
          className="food-mealrow-fav"
          style={{
            ...iconBtnStyle,
            color: isFavorited ? "var(--color-brand-accent)" : undefined,
          }}
        >
          <Star size={13} fill={isFavorited ? "currentColor" : "none"} />
        </button>
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
            <EditableItemRow key={it.id} item={it} onEditGrams={onEditGrams} onEditServings={onEditServings} />
          ))}
        </div>
      )}
    </div>
  );
}

function EditableItemRow({
  item,
  onEditGrams,
  onEditServings,
}: {
  item: MealItem;
  onEditGrams: (itemId: string, grams: number) => Promise<MealItem | null>;
  onEditServings: (itemId: string, servings: number) => Promise<MealItem | null>;
}) {
  // Label items edit on the servings axis (grams-free); everything else on grams.
  const isServing = item.unit === "serving";
  const current = isServing ? item.servings ?? 1 : item.grams;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(current.toString());
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isComposite = item.kind === "composite" && (item.components?.length ?? 0) > 0;
  // Composite logged before the unified-nutrients migration: its raw_response is
  // the old flat shape, so the breakdown can't be rebuilt or rescaled. Lock edits.
  const locked = item.kind === "composite" && (item.components?.length ?? 0) === 0;

  const save = async () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return;
    if (n === current) {
      setEditing(false);
      return;
    }
    setBusy(true);
    try {
      if (isServing) await onEditServings(item.id, n);
      else await onEditGrams(item.id, n);
      setEditing(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
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
        {isComposite ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            title="Show ingredients"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 3,
              minWidth: 0,
              background: "transparent",
              border: 0,
              padding: 0,
              cursor: "pointer",
              color: "var(--color-text-secondary)",
              font: "inherit",
              textAlign: "left",
            }}
          >
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.name}
            </span>
          </button>
        ) : (
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>
            {item.name}
          </span>
        )}
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
            title={isServing && item.servingLabel ? item.servingLabel : undefined}
          >
            {isServing ? `×${fmtServingNum(item.servings ?? 1)}` : `${Math.round(item.grams)}g`}
          </span>
        )}
        <MacroChips p={item.proteinG} c={item.carbsG} f={item.fatG} />
        <KcalCell kcal={item.kcal} size={12} />
        {locked ? (
          <span
            title="Legacy item — grams can't be edited (pre-migration format)"
            style={{
              ...iconBtnStyle,
              opacity: 0.4,
              cursor: "default",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Lock size={12} />
          </span>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (editing) {
                void save();
              } else {
                setValue(current.toString());
                setEditing(true);
              }
            }}
            style={iconBtnStyle}
          >
            {busy ? <Loader2 size={12} className="spin" /> : <Pencil size={12} />}
          </button>
        )}
      </div>
      {isComposite && expanded && (
        <div style={{ paddingLeft: 22, display: "flex", flexDirection: "column", gap: 2, margin: "2px 0 4px" }}>
          {(item.components ?? []).map((c, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--color-text-tertiary)" }}
            >
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.matched ? `${c.inputName} → ${c.name}` : `${c.inputName} → (no match)`}
              </span>
              <span className="font-mono-sm" style={{ flexShrink: 0 }}>{Math.round(c.grams)}g</span>
              <span className="font-mono-sm" style={{ flexShrink: 0 }}>{Math.round(c.kcal)} kcal</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtServingNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, "");
}

/** "1 slice · 30 g" / "30 g" / "1 slice" / null — for the review serving sub-line. */
function formatServing(s: FmaServing | null | undefined): string | null {
  if (!s) return null;
  const size =
    s.amount !== null && s.amount !== undefined && s.unit
      ? `${fmtServingNum(s.amount)} ${s.unit}`
      : null;
  if (s.label && size) return `${s.label} · ${size}`;
  return s.label ?? size ?? null;
}

/** Tiny muted icon showing which tab an item came from. */
function SourceBadge({ source }: { source: FoodLogSource }) {
  const icon: Record<FoodLogSource, React.ReactNode> = {
    search: <SearchIcon size={11} />,
    text: <AlignLeft size={11} />,
    photo: <Camera size={11} />,
    barcode: <ScanBarcode size={11} />,
    off: <Package size={11} />,
    manual: <Pencil size={11} />,
    label: <ReceiptText size={11} />,
  };
  return (
    <span
      title={source}
      style={{
        display: "inline-flex",
        alignItems: "center",
        color: "var(--color-text-tertiary)",
        flexShrink: 0,
      }}
    >
      {icon[source]}
    </span>
  );
}

// ── Favorites ─────────────────────────────────────────────────────────────

function favoriteLabel(fav: FavoriteMeal): string {
  if (fav.mealName) return fav.mealName;
  const first = fav.items[0]?.name ?? "Meal";
  return fav.items.length > 1 ? `${first} + ${fav.items.length - 1} more` : first;
}

function FavoritesPanel({
  favorites,
  onLog,
  onRemove,
}: {
  favorites: FavoriteMeal[];
  onLog: (fav: FavoriteMeal) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  if (favorites.length === 0) {
    return (
      <div
        style={{
          padding: "var(--space-lg)",
          textAlign: "center",
          color: "var(--color-text-tertiary)",
          fontSize: 13,
        }}
      >
        No favorites yet. Star a meal in the log above to pin it here for one-tap re-logging.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-xs)" }}>
      {favorites.map((fav) => {
        const totals = fav.items.reduce(
          (acc, i) => ({
            kcal: acc.kcal + i.kcal,
            p: acc.p + i.proteinG,
            c: acc.c + i.carbsG,
            f: acc.f + i.fatG,
          }),
          { kcal: 0, p: 0, c: 0, f: 0 },
        );
        const busy = busyId === fav.id;
        return (
          <div
            key={fav.id}
            className="food-favrow"
            style={{
              background: "var(--color-surface-low)",
              borderRadius: "var(--radius-md)",
              padding: "8px 10px",
              display: "grid",
              gridTemplateColumns: "1fr 140px 86px 28px 28px",
              gap: 8,
              alignItems: "center",
            }}
          >
            <span
              className="food-favrow-name"
              style={{
                color: "var(--color-text-primary)",
                fontSize: 13,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                minWidth: 0,
              }}
            >
              {favoriteLabel(fav)}
            </span>
            <MacroChips p={totals.p} c={totals.c} f={totals.f} className="food-favrow-macros" />
            <KcalCell kcal={Math.round(totals.kcal)} className="food-favrow-kcal" />
            <button
              type="button"
              onClick={async () => {
                if (busy) return;
                setBusyId(fav.id);
                try {
                  await onLog(fav);
                } finally {
                  setBusyId(null);
                }
              }}
              disabled={busy}
              title="Log this meal now"
              className="food-favrow-log"
              style={iconBtnStyle}
            >
              <Plus size={14} />
            </button>
            <button
              type="button"
              onClick={async () => {
                if (busy) return;
                setBusyId(fav.id);
                try {
                  await onRemove(fav.id);
                } finally {
                  setBusyId(null);
                }
              }}
              disabled={busy}
              title="Remove favorite"
              className="food-favrow-del"
              style={iconBtnStyle}
            >
              <Trash2 size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────

function TabBar({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const tabs: Array<{ id: Mode; label: string; icon: React.ReactNode }> = [
    { id: "search", label: "Search", icon: <SearchIcon size={13} /> },
    { id: "off", label: "Brands", icon: <Package size={13} /> },
    { id: "text", label: "Type", icon: <AlignLeft size={13} /> },
    { id: "snap", label: "Snap", icon: <Camera size={13} /> },
    { id: "barcode", label: "Barcode", icon: <ScanBarcode size={13} /> },
    { id: "label", label: "Label", icon: <ReceiptText size={13} /> },
    { id: "favorites", label: "Favorites", icon: <Star size={13} /> },
  ];
  return (
    <div
      role="tablist"
      className="food-tabbar"
      style={{
        // One row on desktop; the phone media query collapses this to 3 columns (2 rows).
        display: "grid",
        gridTemplateColumns: "repeat(7, 1fr)",
        gap: 4,
        padding: 4,
        background: "var(--color-surface-low)",
        borderRadius: "var(--radius-md)",
        width: "100%",
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
              minWidth: 0,
              justifyContent: "center",
            }}
          >
            <span style={{ display: "inline-flex", flexShrink: 0 }}>{t.icon}</span>
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

// ── Pager ─────────────────────────────────────────────────────────────────

/**
 * Bottom page-control for the Search & Brands result lists. Both FMA endpoints
 * now share a page-based contract (`page`/`limit` → `total`/`page`/`limit`), so
 * one control drives both. Page-replace (not accumulate) keeps the list short
 * enough that the pager stays thumb-reachable without scrolling on a phone.
 * Render only when there's a sibling page to reach — callers gate on hasPrev||hasNext.
 */
function Pager({
  page,
  hasPrev,
  hasNext,
  loading,
  onPrev,
  onNext,
}: {
  page: number;
  hasPrev: boolean;
  hasNext: boolean;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const navBtn = (
    dir: "prev" | "next",
    enabled: boolean,
    onClick: () => void,
  ) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled || loading}
      aria-label={dir === "prev" ? "Previous page" : "Next page"}
      className="food-pager-btn"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        height: 40,
        minWidth: 44,
        padding: "0 14px",
        borderRadius: "var(--radius-md)",
        background: "var(--color-surface-elevated)",
        border: "1px solid var(--color-outline)",
        color: enabled ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
        fontSize: 13,
        fontWeight: 500,
        cursor: enabled && !loading ? "pointer" : "default",
        opacity: enabled ? 1 : 0.4,
        transition: "border-color 120ms ease, background 120ms ease",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      {dir === "prev" ? (
        <>
          <ChevronLeft size={16} />
          <span className="food-pager-label">Prev</span>
        </>
      ) : (
        <>
          <span className="food-pager-label">Next</span>
          <ChevronRight size={16} />
        </>
      )}
    </button>
  );

  return (
    <div
      className="food-pager"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 8,
        marginTop: 4,
        paddingTop: 10,
        borderTop: "1px solid var(--color-outline)",
      }}
    >
      {navBtn("prev", hasPrev, onPrev)}
      <span
        aria-live="polite"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          fontSize: 12,
          color: "var(--color-text-tertiary)",
          fontFamily: "var(--font-mono)",
          whiteSpace: "nowrap",
        }}
      >
        {loading ? (
          <Loader2 size={12} className="spin" />
        ) : (
          <span
            aria-hidden
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--color-brand-primary)",
            }}
          />
        )}
        Page{" "}
        <span style={{ color: "var(--color-text-primary)", fontWeight: 600 }}>
          {page}
        </span>
      </span>
      {navBtn("next", hasNext, onNext)}
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
  const [page, setPage] = useState(1);
  const [hits, setHits] = useState<FmaSearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE = 8;

  // A new query or locale restarts paging from the first page. The fetch effect
  // below also depends on `page`, so the timer-clear there cancels any in-flight
  // request for a stale page before this reset's page-1 fetch fires.
  useEffect(() => {
    setPage(1);
  }, [q, locale]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setHits([]);
      setTotal(0);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        const url = new URL("/api/food/search", window.location.origin);
        url.searchParams.set("q", q);
        url.searchParams.set("limit", String(PAGE_SIZE));
        url.searchParams.set("page", String(page));
        if (locale && locale !== "en") url.searchParams.set("locale", locale);
        const res = await fetch(url.pathname + url.search);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? `${res.status}`);
        setHits((body.items ?? []) as FmaSearchHit[]);
        setTotal(typeof body.total === "number" ? body.total : 0);
      } catch (e) {
        setErr((e as Error).message);
        setHits([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, locale, page]);

  // hits.length === PAGE_SIZE guards against a short final page; total guards the
  // common case. Search's `total` is a bounded relevance-pool size (creeps up as
  // you page deeper) — the full-page check keeps Next honest regardless.
  const hasPrev = page > 1;
  const hasNext = hits.length === PAGE_SIZE && page * PAGE_SIZE < total;

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
          const gStr = pickGrams[key] ?? String(defaultGramsForHit(h.nutrients.serving));
          const grams = Number(gStr) || 100;
          const servingLabel = formatServing(h.nutrients.serving);
          const scale = grams / 100;
          const m = h.nutrients.macros;
          const kcal = (m.kcal ?? 0) * scale;
          const protein = (m.protein_g ?? 0) * scale;
          const carbs = (m.carbs_g ?? 0) * scale;
          const fat = (m.fat_g ?? 0) * scale;
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
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, alignItems: "flex-start" }}>
                <span style={{ fontSize: 13 }}>{h.name}</span>
                {servingLabel && (
                  <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                    {servingLabel}
                  </span>
                )}
                <MacroChips p={protein} c={carbs} f={fat} />
              </div>
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
      {hits.length > 0 && (hasPrev || hasNext) && (
        <Pager
          page={page}
          hasPrev={hasPrev}
          hasNext={hasNext}
          loading={loading}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      )}
    </div>
  );
}

// ── Brands (Open Food Facts) panel ────────────────────────────────────────

function OffSearchPanel({
  locale,
  onResult,
  setError,
}: {
  locale: FoodLocale;
  onResult: (items: PendingItem[]) => void;
  setError: (msg: string | null) => void;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [hits, setHits] = useState<FmaOffSearchHit[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // barcode currently being resolved via /analyze/barcode (per-row spinner)
  const [resolving, setResolving] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const PAGE_SIZE = 10;

  // A new query restarts paging (OFF search ignores locale — upstream takes only
  // q/limit/page). The fetch effect's timer-clear cancels any stale-page request.
  useEffect(() => {
    setPage(1);
  }, [q]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) {
      setHits([]);
      setTotal(0);
      return;
    }
    timer.current = setTimeout(async () => {
      setLoading(true);
      setErr(null);
      try {
        const url = new URL("/api/food/off-search", window.location.origin);
        url.searchParams.set("q", q);
        url.searchParams.set("limit", String(PAGE_SIZE));
        url.searchParams.set("page", String(page));
        const res = await fetch(url.pathname + url.search);
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? `${res.status}`);
        setHits((body.items ?? []) as FmaOffSearchHit[]);
        setTotal(typeof body.total === "number" ? body.total : 0);
      } catch (e) {
        setErr((e as Error).message);
        setHits([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, page]);

  // OFF `total` is the upstream match count (stable across pages).
  const hasPrev = page > 1;
  const hasNext = hits.length === PAGE_SIZE && page * PAGE_SIZE < total;

  // Resolve a chosen barcode into a loggable item (serving + complete macros),
  // then append it. Locale flows into the resolve, not the OFF search.
  const resolve = async (hit: FmaOffSearchHit) => {
    if (!hit.barcode) return;
    setResolving(hit.barcode);
    setError(null);
    try {
      const res = await fetch("/api/food/analyze/barcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: hit.barcode,
          locale: locale === "en" ? undefined : locale,
        }),
      });
      const body = (await res.json()) as FmaAnalyzeResponse & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      if (!body.items?.length) {
        throw new Error("No product data for that barcode.");
      }
      onResult(body.items.map((it, i) => fromFmaItem(it, i, "off")));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setResolving(null);
    }
  };

  return (
    <div style={panelStyle}>
      <PanelLabel>Search brands &amp; packaged foods</PanelLabel>
      <input
        type="text"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ferrero rocher"
        style={inputStyle}
      />
      {loading && <Loader />}
      {err && <ErrorBanner message={err} />}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {hits.map((h, i) => {
          const brand = h.brands.length ? h.brands.join(", ") : null;
          const per100 = h.nutrients.per_100g === null ? null : h.nutrients.macros.kcal;
          const busyRow = resolving === h.barcode;
          return (
            <div
              key={`${h.barcode}-${i}`}
              className="food-brand-row"
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: 8,
                alignItems: "center",
                padding: "8px 10px",
                background: "var(--color-surface-low)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, alignItems: "flex-start" }}>
                <span
                  style={{
                    fontSize: 13,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "100%",
                  }}
                >
                  {h.name ?? h.barcode}
                </span>
                {brand && (
                  <span style={{ fontSize: 11, color: "var(--color-text-tertiary)" }}>
                    {brand}
                  </span>
                )}
              </div>
              <span
                className="font-mono-sm"
                style={{ fontSize: 12, color: "var(--color-text-tertiary)", textAlign: "right", whiteSpace: "nowrap" }}
              >
                {per100 !== null ? `${Math.round(per100)} kcal/100g` : "—"}
              </span>
              <button
                type="button"
                onClick={() => resolve(h)}
                disabled={!h.barcode || busyRow}
                title={!h.barcode ? "No barcode — can't resolve" : undefined}
                style={{
                  ...primaryBtnStyle,
                  opacity: !h.barcode ? 0.5 : 1,
                  cursor: !h.barcode ? "default" : "pointer",
                }}
              >
                {busyRow ? <Loader2 size={13} className="spin" /> : "Add"}
              </button>
            </div>
          );
        })}
      </div>
      {hits.length > 0 && (hasPrev || hasNext) && (
        <Pager
          page={page}
          hasPrev={hasPrev}
          hasNext={hasNext}
          loading={loading}
          onPrev={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => p + 1)}
        />
      )}
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
      onResult(
        body.items.map((it, i) => fromFmaItem(it, i, "text")),
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
  const [staged, setStaged] = useState<PreparedImage | null>(null);
  const [context, setContext] = useState("");

  // Stage the prepared image and show a thumbnail; defer the FMA call until the
  // user clicks Analyze so they can add context first. Upload/paste no longer
  // auto-analyzes (parity with the Type tab's explicit submit).
  const handleStaged = (prepared: PreparedImage) => {
    setError(null);
    setStaged(prepared);
    setPreviewUrl(`data:${prepared.mimeType};base64,${prepared.base64}`);
  };

  const analyze = async () => {
    if (!staged || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/food/analyze/photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: staged.base64,
          filename: staged.filename,
          mimeType: staged.mimeType,
          capturedAt: staged.capturedAt ? staged.capturedAt.toISOString() : null,
          locale: locale === "en" ? undefined : locale,
          context: context.trim() || undefined,
        }),
      });
      const body = (await res.json()) as FmaAnalyzeResponse & {
        exifDate?: string | null;
        convertedImageBase64?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      // HEIC can't render in <img>; swap to the server's transcoded JPEG.
      if (body.convertedImageBase64) {
        setPreviewUrl(`data:image/jpeg;base64,${body.convertedImageBase64}`);
      }
      onResult(
        body.items.map((it, i) => fromFmaItem(it, i, "photo")),
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
        label={staged ? "Tap to replace · or paste" : "Tap to pick a photo · or paste"}
        busyLabel="Analyzing…"
        busy={busy}
        // Plate photos don't need OCR fidelity — shrink to ~1280px / ~400KB to
        // cut FMA vision token cost (cost scales with pixels). Barcode photo and
        // workout upload keep the default high-fidelity path.
        prepareOpts={{
          maxBase64Bytes: 550_000,
          maxDim: 1280,
          qualitySteps: [0.8, 0.7, 0.6, 0.5],
          bestEffort: true,
        }}
        onPrepared={handleStaged}
        onError={setError}
      />
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="meal" style={previewImgStyle} />
      )}
      <ActionRow busy={busy} disabled={!staged} onClick={analyze} />
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
      onResult(
        body.items.map((it, i) => fromFmaItem(it, i, "barcode")),
        undefined,
        body.meal_name ?? null,
      );
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
        convertedImageBase64?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      // HEIC can't render in <img>; prefer the server's transcoded JPEG.
      setPreviewUrl(
        body.convertedImageBase64
          ? `data:image/jpeg;base64,${body.convertedImageBase64}`
          : `data:${prepared.mimeType};base64,${prepared.base64}`,
      );
      onResult(
        body.items.map((it, i) => fromFmaItem(it, i, "barcode")),
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

      <Divider label="or type the code" />

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
    </div>
  );
}

// ── Label panel (nutrition-panel transcription) ──────────────────────────

function LabelPanel({
  locale,
  onResult,
  setError,
}: {
  locale: FoodLocale;
  onResult: (items: PendingItem[], loggedAtIso?: string) => void;
  setError: (msg: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [staged, setStaged] = useState<PreparedImage | null>(null);
  const [context, setContext] = useState("");

  const handleStaged = (prepared: PreparedImage) => {
    setError(null);
    setStaged(prepared);
    setPreviewUrl(`data:${prepared.mimeType};base64,${prepared.base64}`);
  };

  const analyze = async () => {
    if (!staged || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/food/analyze/label", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: staged.base64,
          filename: staged.filename,
          mimeType: staged.mimeType,
          capturedAt: staged.capturedAt ? staged.capturedAt.toISOString() : null,
          locale: locale === "en" ? undefined : locale,
          context: context.trim() || undefined,
        }),
      });
      const body = (await res.json()) as FmaAnalyzeResponse & {
        exifDate?: string | null;
        convertedImageBase64?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      if (body.convertedImageBase64) {
        setPreviewUrl(`data:image/jpeg;base64,${body.convertedImageBase64}`);
      }
      if (!body.items?.length) {
        throw new Error("No nutrition table detected — try a clearer crop or add a product-name hint.");
      }
      // basis-dispatch: per_serving → servings item; other bases → grams item.
      onResult(
        body.items.map((it, i) => fromFmaAnalyzeItem(it, i, "label")),
        body.exifDate ?? undefined,
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={panelStyle}>
      <PanelLabel>Product name (optional)</PanelLabel>
      <textarea
        value={context}
        onChange={(e) => setContext(e.target.value)}
        rows={1}
        placeholder="e.g. 'Big Arch Maccas' (helps find the table)"
        style={panelTextareaStyle}
      />
      <PanelLabel>Nutrition label</PanelLabel>
      <PhotoDropzone
        icon={<ReceiptText size={14} />}
        label={staged ? "Tap to replace · or paste" : "Tap to pick a label image · or paste"}
        busyLabel="Reading label…"
        busy={busy}
        // Labels are text — keep OCR fidelity (higher dim/quality than plate photos).
        prepareOpts={{
          maxBase64Bytes: 1_400_000,
          maxDim: 2000,
          qualitySteps: [0.92, 0.85, 0.8, 0.7],
          bestEffort: true,
        }}
        onPrepared={handleStaged}
        onError={setError}
      />
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previewUrl} alt="nutrition label" style={previewImgStyle} />
      )}
      <ActionRow busy={busy} disabled={!staged} onClick={analyze} />
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
  // Serving (label) items are grams-free — their portion is `servings`, so the
  // grams-> 0 guard only applies to gram items.
  const hasInvalidGrams = items.some(
    (i) => i.enabled && i.unit !== "serving" && (!Number.isFinite(i.grams) || i.grams <= 0),
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
            onRemove={() => setItems(items.filter((_, i) => i !== idx))}
          />
        ))}
      </div>

      <div
        style={{
          display: "flex",
          gap: "var(--space-sm)",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
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
          style={{ ...inputStyle, padding: "6px 8px", width: "fit-content", maxWidth: "100%" }}
        />
        <div style={{ display: "flex", gap: "var(--space-sm)", marginLeft: "auto" }}>
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
      </div>
      {hasInvalidGrams && (
        <ErrorBanner message="One or more items have grams = 0. Set grams or untick the row before committing." />
      )}
    </div>
  );
}

/** Compact −/+ servings control. Buttons step ±1; the field accepts decimals (min > 0). */
function ServingsStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [text, setText] = useState(String(value));
  // Reset the field when the committed value changes (without an effect — avoids
  // the cascading-render warning): adjust state during render on a value change.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(String(value));
  }
  const fire = (n: number) => {
    if (Number.isFinite(n) && n > 0) onChange(Number(n.toFixed(2)));
  };
  const stepBtn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 20,
    height: 24,
    flexShrink: 0,
    background: "var(--color-surface-elevated)",
    color: "var(--color-text-primary)",
    border: "1px solid var(--color-outline)",
    borderRadius: 4,
    cursor: "pointer",
  };
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
      <button
        type="button"
        aria-label="Fewer servings"
        onClick={() => fire(value - 1)}
        disabled={value <= 1}
        style={{ ...stepBtn, opacity: value <= 1 ? 0.4 : 1, cursor: value <= 1 ? "default" : "pointer" }}
      >
        <Minus size={11} />
      </button>
      <input
        type="number"
        value={text}
        min={0}
        step={1}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          const n = Number(text);
          if (Number.isFinite(n) && n > 0) fire(n);
          else setText(String(value));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        aria-label="Servings"
        style={{ ...inputStyle, width: 34, padding: "4px 2px", textAlign: "center" }}
      />
      <button type="button" aria-label="More servings" onClick={() => fire(value + 1)} style={stepBtn}>
        <Plus size={11} />
      </button>
    </div>
  );
}

function ReviewRow({
  item,
  onChange,
  onRemove,
}: {
  item: PendingItem;
  onChange: (next: PendingItem) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const lowConf = item.confidence !== null && item.confidence !== undefined && item.confidence < LOW_CONF;
  const hasWarnings = (item.warnings?.length ?? 0) > 0;
  const isServing = item.unit === "serving";
  const isTranscribed = (item.warnings ?? []).includes("label_transcription");
  const serving = formatServing(item.serving);
  const isComposite = item.kind === "composite";

  // Servings axis (label items): rescale from the immutable per-serving macros
  // held in rawResponse, so editing to 0 and back recovers (mirrors basePerG).
  const updateServings = (n: number) => {
    const s = Number.isFinite(n) && n > 0 ? n : 0;
    const base = (item.rawResponse as FmaItem | undefined)?.nutrients?.macros;
    if (base) {
      onChange({
        ...item,
        servings: s,
        kcal: base.kcal * s,
        proteinG: base.protein_g * s,
        carbsG: base.carbs_g * s,
        fatG: base.fat_g * s,
      });
      return;
    }
    const cur = item.servings && item.servings > 0 ? item.servings : 1;
    const f = s / cur;
    onChange({
      ...item,
      servings: s,
      kcal: item.kcal * f,
      proteinG: item.proteinG * f,
      carbsG: item.carbsG * f,
      fatG: item.fatG * f,
    });
  };
  // Components are derived from the immutable base by current grams, so editing
  // grams (below) needs no special handling — the breakdown rescales live.
  const components = isComposite ? displayComponents(item) : [];

  const updateGrams = (raw: number) => {
    const g = Number.isFinite(raw) && raw > 0 ? raw : 0;
    // Prefer the fixed per-gram basis — survives clearing the field to 0.
    const b = item.basePerG;
    if (b) {
      onChange({
        ...item,
        grams: g,
        kcal: b.kcal * g,
        proteinG: b.proteinG * g,
        carbsG: b.carbsG * g,
        fatG: b.fatG * g,
      });
      return;
    }
    // Legacy fallback (no basis): multiplicative rescale, can't recover from 0.
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
          item.enabled && !isServing && (!Number.isFinite(item.grams) || item.grams <= 0)
            ? "inset 0 0 0 1px var(--color-semantic-danger)"
            : undefined,
      }}
    >
      <div
        className="food-review-row-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "auto 1fr 88px 80px auto",
          gap: 8,
          alignItems: "center",
        }}
      >
        <input
          type="checkbox"
          checked={item.enabled}
          onChange={(e) => onChange({ ...item, enabled: e.target.checked })}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
            <SourceBadge source={item.source} />
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
            {isComposite && (
              <span
                title="decomposed estimate from ingredients"
                style={{
                  flexShrink: 0,
                  padding: "2px 6px",
                  background: "rgba(91,163,245,0.14)",
                  color: "var(--color-text-secondary)",
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 999,
                }}
              >
                est
              </span>
            )}
            {isTranscribed && (
              <span
                title="Macros transcribed from a label image — verify before trusting"
                style={{
                  flexShrink: 0,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "2px 6px",
                  background: "rgba(91,163,245,0.14)",
                  color: "var(--color-text-secondary)",
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 999,
                }}
              >
                <ReceiptText size={9} />
                label
              </span>
            )}
          </div>
          {serving && (
            <span
              style={{
                fontSize: 11,
                color: "var(--color-text-tertiary)",
                paddingLeft: 17,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {serving}
            </span>
          )}
        </div>
        {isServing ? (
          <ServingsStepper value={item.servings ?? 1} onChange={updateServings} />
        ) : (
          <input
            type="number"
            value={item.grams.toString()}
            min={0}
            step={1}
            onChange={(e) => updateGrams(Number(e.target.value))}
            style={{ ...inputStyle, padding: "4px 8px", textAlign: "right" }}
          />
        )}
        <span
          className="font-mono-sm"
          style={{ fontSize: 12, color: "var(--color-text-secondary)", textAlign: "right" }}
        >
          {Math.round(item.kcal)} kcal
        </span>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
          {(hasWarnings || item.rationale || isComposite) && (
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
          <button
            type="button"
            onClick={onRemove}
            title="Remove from meal"
            style={{
              background: "transparent",
              border: 0,
              color: "var(--color-text-tertiary)",
              cursor: "pointer",
              padding: 4,
              display: "inline-flex",
            }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ marginTop: 6, paddingLeft: 30, display: "flex", flexDirection: "column", gap: 4 }}>
          {isComposite &&
            components.map((c, i) => (
              <div
                key={`c-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: "var(--color-text-tertiary)",
                }}
              >
                <CornerDownRight size={10} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.matched ? `${c.inputName} → ${c.name}` : `${c.inputName} → (no match)`}
                </span>
                <span className="font-mono-sm" style={{ flexShrink: 0 }}>{Math.round(c.grams)}g</span>
                <span className="font-mono-sm" style={{ flexShrink: 0 }}>{Math.round(c.kcal)} kcal</span>
              </div>
            ))}
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
