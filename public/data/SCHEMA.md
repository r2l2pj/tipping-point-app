# Data contract — `data/`

Everything the app reads comes from this directory. Pipelines write it; the app never computes.
All rasters are Cloud-Optimized GeoTIFF (COG), GeoJSON is EPSG:4326, JSON is UTF-8.

## Layout

```
data/
├── events.json                  # index the app loads first
└── <event-id>/                  # one dir per case (e.g. wa-2025-12, rs-2024-05)
    ├── manifest.json            # layers[] {id, type, path, legend, source, date}
    ├── cog/                     # rasters, clipped to AOI, keep each <= ~20 MB
    ├── geojson/                 # polygons/points
    ├── series/                  # time series JSON for charts
    └── metrics.json             # validation + impact numbers
```

## events.json (index)

```json
{ "schema": "tipping-point/events-index@1",
  "events": [ { "id": "wa-2025-12", "title": "...", "bbox": [w,s,e,n],
                "reference_date": "YYYY-MM-DD", "layers": ["tpi", "flood", "slides"] } ] }
```

## <event>/manifest.json

```json
{ "event": "wa-2025-12",
  "layers": [
    { "id": "tpi_slide_series", "type": "cog",     "path": "cog/tpi_slide_series.tif",
      "legend": "tpi",           "source": "GEE: IMERG+SMAP+NASADEM", "bands": "one per day" },
    { "id": "flood_nisar",      "type": "cog",     "path": "cog/flood_nisar.tif",
      "legend": "water",         "source": "NISAR GCOV", "date": "YYYY-MM-DD" },
    { "id": "flood_confirmed",  "type": "geojson", "path": "geojson/flood_confirmed.geojson",
      "legend": "water",         "source": "NISAR GCOV" },
    { "id": "landslide_candidates", "type": "geojson", "path": "geojson/landslide_candidates.geojson",
      "legend": "slides",        "source": "NISAR GUNW coherence" },
    { "id": "imerg_smap_daily", "type": "series",  "path": "series/imerg_smap_daily.json" },
    { "id": "swot_river",       "type": "series",  "path": "series/swot_river.json" }
  ] }
```

Legends: `tpi` = 4 classes (Baixo/Moderado/Alto/Critico, palette ffffb2→fecc5c→fd8d3c→bd0026),
`water` = blue, `slides` = orange.

## metrics.json

```json
{ "event": "wa-2025-12",
  "flood":    { "iou": 0.0, "f1": 0.0, "area_km2": 0.0 },
  "alert":    { "lead_hours_median": 0.0, "warned_before_pct": 0.0 },
  "cloud":    { "cloud_pct_during_event": 0.0 },
  "impact":   { "people_exposed": 0, "lights_out_pct": 0.0 } }
```

## Conventions

- Filenames are stable: the app must never have to glob.
- Nodata: rasters use a written nodata value; GeoJSON omits empty geometries.
- `data/raw/` is gitignored — never commit downloads; commit only clipped outputs.
