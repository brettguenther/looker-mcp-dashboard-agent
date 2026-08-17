# Looker Query Vis Config: Conditional Formatting Rule Syntax

This reference provides exact JSON schema, type definitions, and examples for writing conditional formatting rules in Looker Query visualization configurations.

## Option Path: `vis_config.conditional_formatting`
Type: `array of CFRule objects`

## CFRule JSON Properties

| Property Key | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Optional. Unique UUID generated to track rule. |
| `type` | `string (one of: 'along a scale...', 'equal to', 'not equal to', 'greater than', 'less than', 'between', 'not between', 'starts with', 'contains', 'null', 'not null', 'low to high', 'high to low')` | Comparison operator or scale rule type. |
| `value` | `any` | Comparison value (numeric, or array for range operators like 'between'). |
| `stringValue` | `string` | Comparison string value (used for string operators like 'contains', 'starts with'). |
| `fields` | `array of strings` | List of field names (e.g. `["orders.count"]`) this rule applies to. |
| `apply_to` | `string (one of: 'selectFields', 'allNumericFields', 'allStringFields')` | Target fields for rule. |
| `apply_formatting_to_row` | `boolean` | Highlight entire row if true, individual cell if false. |
| `cell_format` | `CFStyle object` | Formatting style applied to individual cell. |
| `row_format` | `CFStyle object` | Formatting style applied to entire row. |

### CFStyle JSON Properties

| Property Key | Type | Description |
| :--- | :--- | :--- |
| `background_color` | `string` | Background color hex code (e.g., `"#1A73E8"`). |
| `font_color` | `string` | Font color hex code. |
| `font_style` | `object` | Font style toggles: `bold` (boolean), `italic` (boolean), `strikethrough` (boolean). |
| `color_application` | `object` | Theme color collection: `collection_id` (string), `palette_id` (string), `options` (`mirror`, `reverse`, `stepped`). |

## Concrete JSON Example

```json
"conditional_formatting": [
  {
    "type": "greater than",
    "value": 100,
    "fields": ["orders.count"],
    "apply_to": "selectFields",
    "apply_formatting_to_row": false,
    "cell_format": {
      "background_color": "#F3F3F3",
      "font_color": "#FF0000",
      "font_style": {
        "bold": true,
        "italic": false,
        "strikethrough": false
      }
    }
  }
]
```
