---
name: "looker-queries"
description: Standardized reference and best practices for building, formatting, and validating JSON query payloads and vis_config visualization settings for the Looker API and Looker MCP query tools.
---

# Looker Query JSON & Visualization Best Practices

This skill provides guidelines, data structure routing rules, and schema references for constructing JSON payloads when running queries via Looker API or Looker MCP tools (e.g., `query`, `run_look`).

## 1. Visualization Selection & Data Routing Matrix

Before writing `vis_config` payloads, verify that your dataset schema (dimensions, measures, pivots) satisfies the target chart type's requirements. For detailed routing decision guidelines by analytical intent, see the [Visualization Routing Guide](references/vis_routing.md).

| Visualization Type | Min/Max Dimensions | Min/Max Measures | Pivoting Support | Geospatial Requirement |
| :--- | :--- | :--- | :--- | :--- |
| **Table (Grid)** | 0 or more | 0 or more | Fully Supported | No |
| **Bar / Column** | 1 or more | 1 or more | Supported (Grouped/Stacked) | No |
| **Line / Area** | 1 or more (ordered/time) | 1 or more | Supported (Multiple Series) | No |
| **Scatter** | 1 or more | 1 or more | Supported | No |
| **Pie / Donut** | 1 | 1 (or more as multiples) | Not Recommended | No |
| **Single Value / KPI**| 0 to 1 | 1 (or 1 dimension) | Not Supported | No |
| **Map (Google Map)** | 1 geo dimension | 0 or more | Supported | Yes (Region/Zip/LatLong) |
| **Word Cloud** | 1 | 1 | Not Supported | No |
| **Timeline** | 2 to 3 (dates + labels) | 0 or more | Not Supported | No |
| **Funnel** | 1 | 1 | Not Supported | No |

---

## 2. Key Principles for Query JSON Payloads

1. **`vis_config` Nesting**: All visualization formatting options (axes, colors, legend, cell formatting) MUST be nested inside the `vis_config` parent object in the query JSON payload:
   ```json
   {
     "model": "analytics",
     "view": "orders",
     "fields": ["orders.created_date", "orders.count"],
     "vis_config": {
       "type": "looker_column",
       "show_value_labels": true,
       "y_axes": [{ "label": "Total Orders" }]
     }
   }
   ```
2. **Path Expansion**: Expand dot-separated path parameters (e.g. `color_application.options.reverse`) into nested JSON objects (`"color_application": { "options": { "reverse": true } }`).
3. **Array Properties**: Expand indexed path parameters (e.g. `y_axes.[i].label`) into JSON arrays.
4. **Dynamic Field Maps**: Replace placeholders (e.g. `series_labels.<field_name>`) with exact field identifiers from the query field list.

---

## 3. Visualization Reference Guides

For exact parameter tables, data types, and JSON structure examples for specific chart types, see the following reference guides:

- **Core Routing Reference**: [Visualization Routing Guide](references/vis_routing.md)
- **Visualization Parameter References**:
  - [Cartesian (Line, Bar, Column, Area, Scatter, Waterfall)](references/queries/cartesian.md)
  - [Conditional Formatting Syntax](references/queries/conditional_formatting.md)
  - [Funnel & Stepped Funnel](references/queries/funnel.md)
  - [KPI (Key Performance Indicator)](references/queries/kpi.md)
  - [Maps (Google Maps, Mapbox)](references/queries/map.md)
  - [Single Value](references/queries/single_value.md)
  - [Single Record](references/queries/single_record.md)
  - [Table & Grid](references/queries/table.md)
  - [Timeline](references/queries/timeline.md)
  - [Word Cloud](references/queries/wordcloud.md)

> [!IMPORTANT]
> **Agent Execution Directive**: When generating or validating a Looker Query JSON payload with visualization options (`vis_config`), you **MUST** view the corresponding reference file under `references/queries/<vis_type>.md` (relative to this `SKILL.md`) to verify parameter keys, data types, and JSON nesting rules.
