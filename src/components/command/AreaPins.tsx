"use client";

import { useEffect, useRef } from "react";
import { Marker, type Map as MapInstance } from "maplibre-gl";
import type { PriorityArea } from "./model/areas";

// Numbered pins of the priority areas: one marker layer owned by the new
// screen. Each pin is a button built from text nodes (no innerHTML).
export default function AreaPins({
  map,
  areas,
  selected,
  onSelect,
}: {
  map: MapInstance | null;
  areas: PriorityArea[];
  selected: number | null;
  onSelect: (rank: number) => void;
}) {
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!map) return;
    const made = buttons.current;
    const markers = areas.flatMap((a) => {
      if (!a.at) return [];
      const el = document.createElement("button");
      el.type = "button";
      el.className = "cc-pin";
      el.dataset.class = a.cls;
      el.textContent = String(a.rank);
      el.setAttribute(
        "aria-label",
        `Priority area ${a.rank}: ${a.name}, ${a.cls || "class not published"}`
      );
      el.setAttribute("aria-pressed", "false");
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        select.current(a.rank);
      });
      made.set(a.rank, el);
      return [new Marker({ element: el, anchor: "center" }).setLngLat(a.at).addTo(map)];
    });
    return () => {
      markers.forEach((m) => m.remove());
      made.clear();
    };
  }, [map, areas]);

  useEffect(() => {
    buttons.current.forEach((el, rank) =>
      el.setAttribute("aria-pressed", String(rank === selected))
    );
  }, [selected, areas, map]);

  return null;
}
