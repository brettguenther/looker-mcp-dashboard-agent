---
name: looker-color-management
description: Guidelines for managing color palettes, series_colors mappings, hex formats, and preventing Looker palette override conflicts in vis_config.
---

# Looker Color Management & Palette Guidelines

---

## 1. Never Combine `colors` and `series_colors`

When configuring colors in `vis_config`:
* **Do NOT provide both a positional `colors: [...]` array and a mapped `series_colors: {...}` object simultaneously.**
* Looker evaluates `colors: [...]` positionally and silently overrides `series_colors`.
* If you want explicit color mappings for specific measures or categories, omit `colors` completely and specify `series_colors`.

---

## 2. Dual Placement for Pivoted Charts

For pivoted charts (e.g. `looker_donut_multiples` or pivoted bar/column charts):
* Provide mapped keys as `<Dimension Value> - <Measure Name>` (e.g. `"Female - order_items.order_count": "#FFC0CB"`).
* Include both the compound key and the bare value key to ensure Looker picks up the style under all rendering paths.

---

## 3. Formatting Standards

* Always use standard 6-digit hex format (`#4285F4`, `#34A853`, `#FBBC04`, `#EA4335`).
* Maintain semantic color consistency across tiles in the same dashboard (e.g. positive/revenue metrics consistently blue/green, churn/risk metrics consistently red/amber).
