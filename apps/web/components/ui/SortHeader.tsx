"use client";

import { useState, useMemo } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

export type SortDir = "asc" | "desc";

export interface SortState<K extends string> {
  key: K | null;
  dir: SortDir;
}

/** Sorting state + a comparator that handles strings, numbers, and dates. */
export function useSort<T, K extends string>(
  items: T[],
  getValue: (item: T, key: K) => unknown,
  initial: SortState<K> = { key: null, dir: "asc" },
) {
  const [sort, setSort] = useState<SortState<K>>(initial);

  const toggle = (key: K) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );

  const sorted = useMemo(() => {
    if (!sort.key) return items;
    const key = sort.key;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const av = getValue(a, key);
      const bv = getValue(b, key);
      // Nulls always sort last regardless of direction.
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * factor;
      const as = String(av);
      const bs = String(bv);
      const ad = Date.parse(as);
      const bd = Date.parse(bs);
      if (!Number.isNaN(ad) && !Number.isNaN(bd)) return (ad - bd) * factor;
      return as.localeCompare(bs, undefined, { sensitivity: "base" }) * factor;
    });
  }, [items, sort, getValue]);

  return { sort, toggle, sorted };
}

interface SortHeaderProps<K extends string> {
  label: string;
  sortKey: K;
  sort: SortState<K>;
  onToggle: (key: K) => void;
  className?: string;
}

export function SortHeader<K extends string>({ label, sortKey, sort, onToggle, className = "" }: SortHeaderProps<K>) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={() => onToggle(sortKey)}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
      className={`group inline-flex items-center gap-1 text-left transition-colors ${
        active ? "text-[var(--text-primary)]" : "hover:text-[var(--text-secondary)]"
      } ${className}`}
    >
      {label}
      <Icon className={`w-3 h-3 transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover:opacity-60"}`} />
    </button>
  );
}
