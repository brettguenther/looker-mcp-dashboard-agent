---
name: visualization-edit
description: Protocol for making surgical edits to existing Looker dashboard tiles and visualizations without full dashboard regeneration or invisible edit failures.
---

# Looker Visualization Surgical Edit Protocol

This skill provides rules and best practices for updating existing Looker dashboard elements and avoiding the **invisible edit** failure mode.

---

## 1. Golden Rule: Rendered Series Keys Only

When configuring `series_colors`, `series_types`, `series_labels`, or `hidden_series`:
* **Measures (or `<pivot_value> - <measure>` combinations) are the rendered series.**
* **Dimensions are NEVER series keys.** Dimensions label axes or category rows. Looker silently discards `series_colors` keyed by dimension names while returning HTTP 200.
* For Pie, Donut, or Funnel charts where wedges/slices represent dimension values, key `series_colors` by the **literal values** (e.g. `{"Search": "#27A745", "Organic": "#4285F4"}`), never the dimension field name (`users.traffic_source`).

---

## 2. Deep-Merge & Parameter Hygiene

* When calling `update_dashboard_element`, specify only the parameters and `vis_config` keys that need to be changed.
* Never pass `null` values as a way to "delete" a configuration (this can wipe all chart settings). Use `{}` or `[]` for resets.
* Never wrap a full config inside a nested `"vis_config"` key (e.g. `{"vis_config": {"vis_config": {...}}}`).

---

## 3. Surgical Mutations vs Re-imports

* Modifying titles, changing colors, toggling value labels, reordering axes, or updating query filters on existing tiles should ALWAYS use `update_dashboard_element`.
* Moving or resizing tiles should use `update_dashboard_layout_component`.
* Never delete and recreate a dashboard to modify 1 or 2 tiles. Preserving the dashboard ID keeps user bookmarks, schedules, and embed links valid.
