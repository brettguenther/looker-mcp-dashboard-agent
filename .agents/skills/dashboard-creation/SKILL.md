---
name: dashboard-creation
description: Production guide and operational protocol for building high-quality User Defined Dashboards (UDDs) in Looker using Looker MCP tools (make_dashboard, add_dashboard_filter, add_dashboard_element, update_dashboard_element, run_dashboard).
---

# Looker Dashboard Creation Protocol (Looker MCP)

This skill defines the mandatory protocol, order of operations, and design best practices for building Looker dashboards via Looker MCP tools.

---

## 1. Golden Order of Operations

Building a Looker dashboard via MCP requires a strict sequence:

```
[1. Explore Selection & Semantic Grounding]
   ├── User selects Model/Explore(s)
   └── Agent calls get_dimensions, get_measures, get_filters, get_parameters
                    ↓
[2. Container Creation]
   └── make_dashboard(title, description)
                    ↓
[3. Dashboard Filters Creation]
   └── add_dashboard_filter(...) for each interactive filter
                    ↓
[4. Tile Authoring (Ordered Hierarchy)]
   ├── Top: Executive KPI single_value cards
   ├── Middle: Trend charts (line/area) & breakdowns (bar/column)
   └── Bottom: Granular detail table (grid)
   *(Each tile bound to filters via dashboard_filters)*
                    ↓
[5. Verification & Delivery]
   ├── run_dashboard / query check
   └── Present direct link & embed URL in response
```

---

## 2. Phase 1: Explore Scope & Semantic Grounding

1. **Model & Explore Confirmation**:
   - Determine which model and explore to use (from user selection in UI or conversational agreement).
   - If unknown, inspect available options with `get_models` and `get_explores`.
2. **Retrieve Semantic Context**:
   - Call `get_dimensions(model, explore)` and `get_measures(model, explore)`.
   - Call `get_filters(model, explore)` and `get_parameters(model, explore)`.
   - **Zero-Guessing Rule**: Never construct a query with unverified field names. Every field must exist in the retrieved metadata.
3. **Ground Categorical Filter Values**:
   - Never guess string literal values (e.g. `"USA"` vs `"United States"`).
   - Use `get_field_value_suggestions` or run a quick grouping query with `query(model, explore, fields=[...], limit=10)` to verify actual stored values.

---

## 3. Phase 2: Create Dashboard Container (`make_dashboard`)

Call `make_dashboard`:
* `title`: Professional report title.
  * 🚫 **ZERO TOLERANCE NAMING RULE**: NEVER include the redundant word "Dashboard" or "dashboard" in the title.
  * *Good*: `"Executive Revenue & Sales Performance"`, `"Customer Acquisition & Cohort Health"`
  * *Bad*: `"Sales Dashboard"`, `"Revenue Performance Dashboard"`
* `description`: Concise business objective (e.g. `"Audience: Leadership | Objective: Track revenue, order velocity, and customer retention."`).

Save the returned `id` (or `dashboard_id`) for subsequent calls.

---

## 4. Phase 3: Create Global Dashboard Filters (`add_dashboard_filter`)

Add all global interactive filters **before** adding tiles:

1. **Date Range Filter** (`filter_type: "date_filter"`):
   * `name`: `"Date Range"`
   * `title`: `"Date Range"`
   * `default_value`: `"12 months"` *(Always use a wide default like 12 months to avoid empty data on first load)*
2. **Field Filters / Categorical** (`filter_type: "field_filter"`):
   * Requires: `model`, `explore`, and `dimension` (fully qualified `view.field_name`).
   * `name`: Descriptive name (e.g. `"Product Category"`, `"Status"`).
   * `title`: UI label.
   * `allow_multiple_values`: `true`.

---

## 5. Phase 4: Authoring Dashboard Elements (`add_dashboard_element`)

Add tiles in a clear visual and analytical hierarchy:

### A. Executive KPI Band (Top Row — `single_value`)
* Plot 3–4 primary business metrics at the top.
* **The 2-Visible-Fields Comparison Rule**:
  * To show a comparison badge (`show_comparison: true`), Looker requires **two visible columns** in the query.
  * Use a `dynamic_fields` table calculation for the comparison and place the grouping date in `hidden_fields`.
  ```json
  {
    "model": "thelook",
    "explore": "order_items",
    "fields": ["order_items.total_sale_price", "order_items.created_year"],
    "filters": {"order_items.created_year": "2 years"},
    "sorts": ["order_items.created_year desc 0"],
    "dynamic_fields": [
      {
        "table_calculation": "percent_change",
        "label": "YoY Change",
        "expression": "(${order_items.total_sale_price} - offset(${order_items.total_sale_price}, 1)) / offset(${order_items.total_sale_price}, 1)",
        "value_format_name": "percent_1"
      }
    ],
    "vis_config": {
      "type": "single_value",
      "show_comparison": true,
      "comparison_type": "change",
      "comparison_reverse_colors": false,
      "hidden_fields": ["order_items.created_year"]
    }
  }
  ```
* ⚠️ **Date Filter Exception**: KPI comparison tiles computing period-over-period via `offset()` should **not** listen to single-period date filters.

### B. Trend & Breakdown Visualizations (Middle Rows)
* **Time-series Trends**: `looker_line` or `looker_area` with dates on the x-axis, sorted ascending by date.
* **Categorical Breakdowns**: `looker_column` or `looker_bar`.
* **Dual-Axis Rule**: If plotting 2+ measures with different units or $> 5\times$ magnitude difference, configure dual y-axes (`orientation: "left"`, `orientation: "right"` with explicit `series` mapping).

### C. Granular Detail Table (Bottom Row — `looker_grid`)
* High-dimensional detail view with key dimensions and aggregated measures.
* Enable `show_totals: true` where appropriate.
* Explicit value formatting for currency (`"$#,##0"`), percent (`"0.0%"`), and integers (`"#,##0"`).

### D. Binding Tiles to Dashboard Filters
Every data tile that should respond to dashboard filters must pass the `dashboard_filters` array:
```json
"dashboard_filters": [
  {
    "dashboard_filter_name": "Date Range",
    "field": "order_items.created_date"
  },
  {
    "dashboard_filter_name": "Product Category",
    "field": "products.category"
  }
]
```

---

## 6. Phase 5: Verification & Delivery

1. **Verify Health**:
   * Optionally run `run_dashboard(dashboard_id)` to ensure all queries execute without error.
2. **Present Links in Chat Response**:
   * Always present direct markdown links to the created dashboard:
     `[View in Looker](https://<looker-host>/dashboards/<dashboard_id>)`
3. **Structured Summary Format**:
   * **Executive Objective**: Summary of what was created.
   * **Tiles & Metrics Included**: Clear breakdown of KPI cards, trend charts, and tables.
   * **Interactive Filters Configured**: Global filters and tile mappings.
   * **Actionable Next Steps**: Suggestions for further drill-downs or edits.

---

## 7. Surgical Edits (Modifying Existing Dashboards)

* When the user asks to modify, restyle, or add a tile to an existing dashboard, **never delete and rebuild**.
* Use `update_dashboard_element` to update visualization configurations or query fields in place.
* Use `update_dashboard_layout_component` to reposition or resize tiles.
