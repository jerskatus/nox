import { SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  catalogFiltersActive,
  DEFAULT_FILTERS,
  KIND_PRESETS,
  matchingYearPreset,
  RATING_PRESETS,
  RUNTIME_PRESETS,
  SORT_PRESETS,
  YEAR_MAX,
  YEAR_OPTIONS,
  YEAR_PRESETS,
  type CatalogFilters,
  type FilterSort,
} from "@/lib/catalog-filter";
import { cn } from "@/lib/utils";

type Panel = "kind" | "genre" | "year" | "rating" | "runtime" | "sort";

export function FilterBar({
  value,
  onChange,
  genres,
  showRuntime = true,
  showKind = false,
  shown,
  total,
}: {
  value: CatalogFilters;
  onChange: (next: CatalogFilters) => void;
  genres: string[];
  showRuntime?: boolean;
  showKind?: boolean;
  shown?: number;
  total?: number;
}) {
  const [open, setOpen] = useState<Panel | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const latest = useRef(value);
  latest.current = value;
  const active = catalogFiltersActive(value);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (root.current?.contains(target as Node)) return;
      const active = document.activeElement;
      if (active instanceof HTMLSelectElement || active instanceof HTMLInputElement) return;
      if (target instanceof Element && (target.tagName === "OPTION" || target.tagName === "SELECT")) return;
      setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(null);
    };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function set(patch: Partial<CatalogFilters>) {
    const next = { ...latest.current, ...patch };
    latest.current = next;
    onChange(next);
  }

  const yearPreset = matchingYearPreset(value.yearFrom, value.yearTo);
  const yearLabel = yearPreset
    ? (YEAR_PRESETS.find((p) => p.id === yearPreset)?.label ?? "Year")
    : value.yearFrom || value.yearTo
      ? `${value.yearFrom || "…"}–${value.yearTo || "…"}`
      : "Year";
  const ratingLabel = value.rating ? `${Number(value.rating).toFixed(1)}+` : "IMDb";
  const runtimeLabel = RUNTIME_PRESETS.find((p) => p.id === value.runtime)?.label ?? "Length";
  const sortLabel = SORT_PRESETS.find((p) => p.id === value.sort)?.label ?? "Popular";
  const kindLabel = KIND_PRESETS.find((p) => p.id === value.kind)?.label ?? "Type";

  return (
    <div ref={root} className="mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-subtle uppercase">
          <SlidersHorizontal className="size-3.5" />
          Filter
        </span>
        {showKind ? (
          <FilterPill
            label={value.kind ? kindLabel : "Type"}
            active={Boolean(value.kind)}
            open={open === "kind"}
            onClick={() => setOpen(open === "kind" ? null : "kind")}
            onClear={() => set({ kind: "" })}
          />
        ) : null}
        <FilterPill
          label={value.genre || "Category"}
          active={Boolean(value.genre)}
          open={open === "genre"}
          onClick={() => setOpen(open === "genre" ? null : "genre")}
          onClear={() => set({ genre: "" })}
        />
        <FilterPill
          label={yearLabel}
          active={Boolean(value.yearFrom || value.yearTo)}
          open={open === "year"}
          onClick={() => setOpen(open === "year" ? null : "year")}
          onClear={() => set({ yearFrom: "", yearTo: "" })}
        />
        <FilterPill
          label={ratingLabel}
          active={Boolean(value.rating)}
          open={open === "rating"}
          onClick={() => setOpen(open === "rating" ? null : "rating")}
          onClear={() => set({ rating: "" })}
        />
        {showRuntime ? (
          <FilterPill
            label={runtimeLabel}
            active={Boolean(value.runtime)}
            open={open === "runtime"}
            onClick={() => setOpen(open === "runtime" ? null : "runtime")}
            onClear={() => set({ runtime: "" })}
          />
        ) : null}
        <FilterPill
          label={sortLabel}
          active={value.sort !== "popular"}
          open={open === "sort"}
          onClick={() => setOpen(open === "sort" ? null : "sort")}
          onClear={() => set({ sort: "popular" })}
        />
        {active ? (
          <button
            type="button"
            onClick={() => {
              latest.current = { ...DEFAULT_FILTERS };
              onChange({ ...DEFAULT_FILTERS });
              setOpen(null);
            }}
            className="inline-flex h-11 items-center gap-1 rounded-full px-3 text-sm text-muted touch-manipulation hover:text-fg"
          >
            <X className="size-3.5" />
            Clear
          </button>
        ) : null}
        {shown !== undefined && total !== undefined ? (
          <span className="ml-auto text-xs tabular-nums text-subtle">
            {shown === total ? `${shown} titles` : `${shown} of ${total}`}
          </span>
        ) : null}
      </div>

      {open === "kind" && showKind ? (
        <Panel>
          {KIND_PRESETS.map((preset) => (
            <Chip
              key={preset.id || "all"}
              on={value.kind === preset.id}
              onClick={() => {
                set({ kind: preset.id });
                setOpen(null);
              }}
            >
              {preset.label}
            </Chip>
          ))}
        </Panel>
      ) : null}

      {open === "genre" ? (
        <Panel>
          <Chip
            on={value.genre === ""}
            onClick={() => {
              set({ genre: "" });
              setOpen(null);
            }}
          >
            All
          </Chip>
          {genres.map((genre) => (
            <Chip
              key={genre}
              on={value.genre === genre}
              onClick={() => {
                set({ genre: value.genre === genre ? "" : genre });
                setOpen(null);
              }}
            >
              {genre}
            </Chip>
          ))}
        </Panel>
      ) : null}

      {open === "year" ? (
        <Panel>
          <Chip
            on={!value.yearFrom && !value.yearTo}
            onClick={() => set({ yearFrom: "", yearTo: "" })}
          >
            Any
          </Chip>
          {YEAR_PRESETS.map((preset) => (
            <Chip
              key={preset.id}
              on={yearPreset === preset.id}
              onClick={() => set({ yearFrom: String(preset.from), yearTo: String(preset.to) })}
            >
              {preset.label}
            </Chip>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
          <YearJump
            onPick={(year) => {
              set({ yearFrom: year, yearTo: year });
              setOpen(null);
            }}
          />
          <YearSelect
            label="From"
            value={value.yearFrom}
            onChange={(yearFrom) => {
              const cur = latest.current;
              let yearTo = cur.yearTo;
              if (yearFrom && !yearTo) yearTo = yearFrom;
              else if (yearFrom && yearTo && Number(yearTo) < Number(yearFrom)) yearTo = yearFrom;
              set({ yearFrom, yearTo });
            }}
          />
          <YearSelect
            label="To"
            value={value.yearTo}
            onChange={(yearTo) => {
              const cur = latest.current;
              let yearFrom = cur.yearFrom;
              if (yearTo && !yearFrom) yearFrom = yearTo;
              else if (yearTo && yearFrom && Number(yearFrom) > Number(yearTo)) yearFrom = yearTo;
              set({ yearFrom, yearTo });
            }}
          />
        </Panel>
      ) : null}

      {open === "rating" ? (
        <Panel>
          <Chip
            on={!value.rating}
            onClick={() => {
              set({ rating: "" });
              setOpen(null);
            }}
          >
            Any
          </Chip>
          {RATING_PRESETS.map((preset) => (
            <Chip
              key={preset.id}
              on={value.rating === preset.id}
              onClick={() => {
                set({ rating: value.rating === preset.id ? "" : preset.id });
                setOpen(null);
              }}
            >
              {preset.label}
            </Chip>
          ))}
        </Panel>
      ) : null}

      {open === "runtime" && showRuntime ? (
        <Panel>
          <Chip
            on={!value.runtime}
            onClick={() => {
              set({ runtime: "" });
              setOpen(null);
            }}
          >
            Any
          </Chip>
          {RUNTIME_PRESETS.map((preset) => (
            <Chip
              key={preset.id}
              on={value.runtime === preset.id}
              onClick={() => {
                set({ runtime: value.runtime === preset.id ? "" : preset.id });
                setOpen(null);
              }}
            >
              {preset.label}
              <span className="ml-1 text-2xs opacity-70">{preset.hint}</span>
            </Chip>
          ))}
        </Panel>
      ) : null}

      {open === "sort" ? (
        <Panel>
          {SORT_PRESETS.map((preset) => (
            <Chip
              key={preset.id}
              on={value.sort === preset.id}
              onClick={() => {
                set({ sort: preset.id as FilterSort });
                setOpen(null);
              }}
            >
              {preset.label}
            </Chip>
          ))}
        </Panel>
      ) : null}
    </div>
  );
}

function FilterPill({
  label,
  active,
  open,
  onClick,
  onClear,
}: {
  label: string;
  active: boolean;
  open: boolean;
  onClick: () => void;
  onClear?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        "inline-flex h-11 min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium touch-manipulation transition-colors duration-150",
        open || active ? "bg-fg text-bg" : "bg-elevated text-muted hover:text-fg",
      )}
    >
      {label}
      {active && onClear ? (
        <span
          data-clear=""
          aria-label={`Clear ${label}`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onClear();
          }}
          className="grid size-5 place-items-center rounded-full hover:bg-bg/15"
        >
          <X className="size-3" />
        </span>
      ) : null}
    </button>
  );
}

function Panel({ children }: { children: ReactNode }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 rounded-md bg-surface p-3">
      {children}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 min-h-10 shrink-0 items-center rounded-full px-3 text-sm font-medium touch-manipulation transition-colors duration-150",
        on ? "bg-fg text-bg" : "bg-elevated text-muted hover:text-fg",
      )}
    >
      {children}
    </button>
  );
}

function YearSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label className="inline-flex h-10 items-center gap-1.5 rounded-full bg-elevated px-2.5 text-sm text-muted">
      <span className="text-2xs font-semibold tracking-wide uppercase">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        className="h-10 bg-transparent text-sm text-fg outline-none"
        aria-label={label}
      >
        <option value="">Any</option>
        {YEAR_OPTIONS.map((year) => (
          <option key={year} value={String(year)}>
            {year}
          </option>
        ))}
      </select>
    </label>
  );
}

function YearJump({ onPick }: { onPick: (year: string) => void }) {
  return (
    <label className="inline-flex h-10 items-center gap-1.5 rounded-full bg-elevated px-2.5 text-sm text-muted">
      <span className="text-2xs font-semibold tracking-wide uppercase">Jump</span>
      <input
        type="number"
        inputMode="numeric"
        min={1888}
        max={YEAR_MAX}
        placeholder="1995"
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          const n = Number((event.target as HTMLInputElement).value);
          if (!Number.isInteger(n) || n < 1888 || n > YEAR_MAX) return;
          onPick(String(n));
        }}
        className="h-10 w-16 bg-transparent text-sm text-fg outline-none"
        aria-label="Jump to year"
      />
    </label>
  );
}
