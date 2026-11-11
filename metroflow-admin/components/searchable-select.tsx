"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/cn";

export type SearchableOption = { value: number; label: string };

type SearchableSelectProps = {
  id?: string;
  options: SearchableOption[];
  value: number | null;
  onChange: (value: number) => void;
  placeholder?: string;
  "aria-label"?: string;
  /** Matches the surrounding chrome: "light" for a white form, "dark" for the map's console panels. */
  variant?: "light" | "dark";
  /** Results are a plain list, not virtualised, so this caps the DOM to a cheap size on a large network. */
  maxResults?: number;
};

const INPUT_CLASS = {
  light:
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none",
  dark: "w-full rounded border border-slate-700 bg-brand-primary px-1.5 py-1 text-[11px] text-slate-100 placeholder:text-slate-500 focus:border-sky-500 focus:outline-none",
};

const LIST_CLASS = {
  light: "border-slate-200 bg-white shadow-lg",
  dark: "border-slate-700 bg-slate-900 shadow-lg",
};

const OPTION_CLASS = {
  light: { base: "text-slate-700 hover:bg-slate-50", active: "bg-slate-900 text-white" },
  dark: { base: "text-slate-200 hover:bg-slate-800", active: "bg-sky-700 text-white" },
};

/**
 * A type-to-filter stand-in for a native `<select>` with thousands of options
 * (the real OSM network has ~8,950 nodes / ~10,876 edges — rendering that many
 * `<option>` elements, twice over for a from/to pair, is the single biggest
 * cause of the portal's post-import lag). Only the matched slice is ever in
 * the DOM, so the list stays cheap regardless of how large `options` is.
 */
export function SearchableSelect({
  id,
  options,
  value,
  onChange,
  placeholder = "Type to search…",
  "aria-label": ariaLabel,
  variant = "light",
  maxResults = 50,
}: SearchableSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selectedLabel = useMemo(
    () => options.find((option) => option.value === value)?.label ?? "",
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = q
      ? options.filter((option) => option.label.toLowerCase().includes(q))
      : options;
    return matches.slice(0, maxResults);
  }, [options, query, maxResults]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <input
        id={id}
        type="text"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listboxId}
        role="combobox"
        aria-autocomplete="list"
        autoComplete="off"
        value={open ? query : selectedLabel}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => {
          setQuery("");
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            setOpen(false);
            setQuery("");
          }
        }}
        placeholder={placeholder}
        className={INPUT_CLASS[variant]}
      />
      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          className={cn(
            "absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border py-1",
            LIST_CLASS[variant],
          )}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-1.5 text-[11px] text-slate-400">No matches</li>
          ) : (
            filtered.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => {
                    onChange(option.value);
                    setQuery("");
                    setOpen(false);
                  }}
                  className={cn(
                    "block w-full truncate px-3 py-1.5 text-left text-[11px]",
                    option.value === value
                      ? OPTION_CLASS[variant].active
                      : OPTION_CLASS[variant].base,
                  )}
                >
                  {option.label}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
