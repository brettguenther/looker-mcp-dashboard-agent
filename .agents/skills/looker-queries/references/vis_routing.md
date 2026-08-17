# Looker Visual Routing and Data Structure Requirements

Use this reference guide when selecting the optimal visualization type for a dataset, or when validating whether a query result's schema (dimensions, measures, pivots) satisfies the requirements of a target Looker chart type.

## Data Structure Requirements Matrix

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

## Routing Decision Guide (By Analytical Intent)

To select the best visualization type based on the user's business question and analytical intent:

### 1. Composition (Parts of a Whole)
- **Pie / Donut**: Use **only** if category count is small (<= 5) and categories represent 100% of a single metric.
- **Stacked Column / Bar**: Use if comparing composition across multiple categories or over time.

### 2. Comparison (Discrete Categories)
- **Bar**: Use if category names are long or there are many categories (scrolls vertically).
- **Column**: Use if category names are short (e.g. abbreviations) or representing discrete times.
- **Table (Grid)**: Use if they want to view precise raw numbers for many metrics concurrently.

### 3. Relationship / Distribution
- **Scatter**: Use to compare two numerical fields (X vs Y) to see clustering or correlations.
- **Boxplot**: Use to visualize statistical distributions (min, max, median, quartiles).

### 4. Trends (Over Time)
- **Line**: Use for continuous chronological data (dates, timestamps) to emphasize the trend.
- **Area**: Use to emphasize both trend and volume (often stacked to show composition change over time).

### 5. Geospatial (Map Coordinates)
- **Google Map / Map**: Use if the primary dimension represents geographical points (latitude/longitude), postal codes, states, or countries.

### 6. Headline Metric (Single Value)
- **Single Value**: Use if the query returns a single aggregate metric (e.g. "Total Sales This Month"). Supports a secondary row for percentage/absolute change vs. previous period.

---

## Validation Rules for Agents

1. **Verify Date Measures**: Looker does not support measures of type `date`. If you see a measure with `type: "date"`, throw a validation error.
2. **Ignored Dimensions**: If a user selects a Pie chart but provides 3 dimensions, warn the user/agent that only the first dimension will be visualized, and others will be hidden.
3. **Timeline Constraints**: Timelines require at least 2 date/time fields (start and end). If the query schema has only 1 date field, select a Line or Column chart instead.
4. **Geo Dimension Mapping**: Map charts will render empty unless the primary dimension's LookML type maps to `zipcode`, `location` (latitude/longitude pair), `state`, or `country`.
