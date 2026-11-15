"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parsePlaces, searchPlaces, type Place, type Places } from "./model/places";

// City search (Lucas): accent-insensitive, fuzzy, keyboard (↑ ↓ Enter Esc,
// "/" focuses). places.json (~0.6 MB) loads on first focus, or at once for a
// ?city= link.
export default function CitySearch({
  url,
  initialCityId,
  onSelect,
  className = "",
}: {
  url?: string;
  initialCityId?: string;
  onSelect: (place: Place, all: Places) => void;
  className?: string;
}) {
  const [data, setData] = useState<Places | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const linked = useRef(false);

  const load = () => {
    if (!url || data || state === "loading") return;
    setState("loading");
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((raw) => {
        const p = parsePlaces(raw);
        if (!p) throw new Error("schema");
        setData(p);
        setState("idle");
      })
      .catch(() => setState("error"));
  };

  // ?city=<IBGE id>: load and select once.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deep link: one fetch after mount
    if (initialCityId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialCityId, url]);
  useEffect(() => {
    if (!data || !initialCityId || linked.current) return;
    linked.current = true;
    const p = data.places.find((x) => x.id === initialCityId);
    if (p) onSelect(p, data);
  }, [data, initialCityId, onSelect]);

  // "/" focuses the box (not while typing elsewhere).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && !(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable))) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const results = useMemo(() => (data ? searchPlaces(data.places, q) : []), [data, q]);
  if (!url) return null;
  const pick = (p: Place) => {
    if (!data) return;
    onSelect(p, data);
    setQ(`${p.name} (${p.uf})`);
    setOpen(false);
    input.current?.blur();
  };
  const listId = "city-search-list";
  return (
    <div className={`relative ${className}`} data-city-search>
      <input
        ref={input}
        type="search"
        role="combobox"
        aria-label="Search a city"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-activedescendant={open && results[active] ? `city-opt-${results[active].id}` : undefined}
        placeholder="Search a city ( / )"
        value={q}
        onFocus={() => { load(); setOpen(true); }}
        onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, Math.max(0, results.length - 1))); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
          else if (e.key === "Enter" && results[active]) { e.preventDefault(); pick(results[active]); }
          else if (e.key === "Escape") { setOpen(false); input.current?.blur(); }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="h-[38px] w-full rounded-[10px] border border-cc-line-strong bg-cc-surface px-3 text-sm text-cc-ink placeholder:text-cc-faint"
      />
      {open && q.trim() && (
        <ul id={listId} role="listbox" aria-label="Cities"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-lg border border-cc-line bg-cc-surface p-1 text-sm shadow-lg">
          {state === "loading" && <li className="px-2 py-1 text-cc-faint">Loading cities…</li>}
          {state === "error" && <li className="px-2 py-1 text-cc-faint">City list not available right now.</li>}
          {state === "idle" && data && results.length === 0 && <li className="px-2 py-1 text-cc-faint">No city in the monitored area matches.</li>}
          {results.map((p, i) => (
            <li key={p.id} id={`city-opt-${p.id}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); pick(p); }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 ${i === active ? "bg-cc-accent-soft" : ""}`}>
              <span className="font-semibold">{p.name} <span className="font-normal text-cc-muted">{p.uf}</span></span>
              {p.alert && <span className="rounded bg-[#bd0026] px-1.5 text-xs font-semibold text-white">alert</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
