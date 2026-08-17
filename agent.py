import os
import logging
import contextvars
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

import google.auth.transport.requests
import google.oauth2.id_token
from google.adk.agents.llm_agent import Agent
from google.adk.tools.mcp_tool.mcp_toolset import McpToolset
from google.adk.tools.mcp_tool.mcp_session_manager import StreamableHTTPServerParams

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Target MCP server location
MCP_SERVER_URL = os.environ.get("MCP_SERVER_URL", "https://<your-looker-instance-url>/mcp")

# ContextVar to store the user's Looker access token for the current request
looker_token_var = contextvars.ContextVar("looker_token", default=None)

# Local resources directory containing query and visualization reference markdown
RESOURCES_DIR = Path(__file__).parent / "resources" / "looker_queries"

def get_looker_headers(context) -> dict[str, str]:
    """Dynamically supplies the user's Looker Access Token to Looker MCP tools."""
    token = getattr(context, "user_id", None)
    if not token:
        token = looker_token_var.get()
    
    if token:
        logger.info("Supplying user Looker access token to MCP tools")
        return {"Authorization": f"token {token}"}
    
    logger.warning("No Looker access token found in context!")
    return {}

def get_visualization_reference(vis_type: str) -> str:
    """Returns detailed parameter specifications, vis_config schema, and JSON examples for a Looker chart type.
    
    Call this tool when formulating vis_config for specific chart types.
    
    Args:
        vis_type: The chart type to look up. Available options:
                  - 'cartesian' (Line, Bar, Column, Area, Scatter, Waterfall, dual-axes)
                  - 'single_value' (KPI cards, YoY comparisons, single value tiles)
                  - 'table' (Data grids, totals, cell formatting)
                  - 'conditional_formatting' (Heatmaps, color rules)
                  - 'funnel' (Stepped funnel, drop-off)
                  - 'kpi' (KPI card rules)
                  - 'vis_routing' (Visualization selection matrix & analytical routing)
                  - 'map' (Geospatial maps)
                  - 'wordcloud' (Word cloud visualization)
                  - 'timeline' (Timeline visualization)
    """
    cleaned_name = vis_type.lower().strip()
    target_file = RESOURCES_DIR / f"{cleaned_name}.md"
    if target_file.exists():
        return target_file.read_text()
    
    available = [f.stem for f in RESOURCES_DIR.glob("*.md")]
    return f"Reference not found for '{vis_type}'. Available reference guides: {', '.join(available)}"

# Define the Looker toolset connecting to the Looker MCP Server using Streamable HTTP
looker_tool = McpToolset(
    connection_params=StreamableHTTPServerParams(
        url=MCP_SERVER_URL
    ),
    header_provider=get_looker_headers,
    tool_filter=[
        # Exploration & Semantic Discovery
        "get_models",
        "get_explores",
        "get_dimensions",
        "get_measures",
        "get_filters",
        "get_parameters",
        "get_field_value_suggestions",
        # Query Formulation & Testing
        "query",
        "query_url",
        # Dashboard Lifecycle & Authoring
        "make_dashboard",
        "get_dashboard",
        "get_dashboards",
        "add_dashboard_filter",
        "add_dashboard_element",
        "update_dashboard_element",
        "run_dashboard",
        "create_dashboard_layout",
        "update_dashboard_layout_component",
        "generate_embed_url"
    ]
)

# Root Agent definition
root_agent = Agent(
    model=os.environ.get("GEMINI_MODEL", "gemini-3.7-flash"),
    name='looker_dashboard_builder_agent',
    description='An expert Looker Dashboard Architect that builds, styles, and verifies production Looker dashboards using Looker MCP tools.',
    instruction='''
    You are an expert Looker Dashboard Architect and Business Intelligence Consultant.
    Your mission is to understand user analytical goals, ground data against verified Looker models and explores, and construct polished, interactive User Defined Dashboards (UDDs) using Looker MCP tools.

    ===================================================================
    PHASE 1: MODEL & EXPLORE SCOPE AND SEMANTIC GROUNDING
    ===================================================================
    1. **Strict Target Explore Scope**:
       - When the user's prompt specifies a Target Scope (e.g. Model: 'thelook', Explore: 'order_items'), you MUST EXCLUSIVELY use that specific Model and Explore for EVERY tile and filter on the dashboard.
       - DO NOT switch to or query any other explore unless explicitly asked.
    2. **Retrieve Semantic Metadata (MANDATORY FIRST STEP)**:
       - Immediately retrieve the exact dimensions and measures for the scoped Explore by calling:
         * `get_dimensions(model=..., explore=...)`
         * `get_measures(model=..., explore=...)`
         * `get_filters(model=..., explore=...)` / `get_parameters(model=..., explore=...)`
       - **Anti-Hallucination Rule**: NEVER guess field names. Every field referenced in `fields`, `filters`, `sorts`, `pivots`, or `dynamic_fields` must exist in the retrieved metadata.
    3. **Ground Filter Values**:
       - For categorical filters (e.g. status, country, category), verify actual stored values using `get_field_value_suggestions` or a quick grouping `query` before hardcoding literal values.

    ===================================================================
    PHASE 2: DASHBOARD CREATION ORDER OF OPERATIONS
    ===================================================================
    Follow this strict order of operations when creating a new dashboard:

    1. **Step 1 — Create Container**:
       - Call `make_dashboard(title=..., description=...)`.
       - 🚫 **Naming Rule**: NEVER include the redundant word "Dashboard" or "dashboard" in the title (e.g. use "Sales & Revenue Performance Scorecard", NOT "Sales Dashboard").
       - Save the returned `id` / `dashboard_id` for subsequent calls.

    2. **Step 2 — Create Global Interactive Filters**:
       - Call `add_dashboard_filter` for each global filter BEFORE adding tiles.
       - **Date Filter**: Use `filter_type: "date_filter"`, `title: "Date Range"`, and always set `default_value: "12 months"` (wide default prevents empty dashboards on initial load).
       - **Field Filters**: Use `filter_type: "field_filter"` with required `model`, `explore`, and `dimension`.

    3. **Step 3 — Add Dashboard Elements in Analytical Hierarchy**:
       - Call `add_dashboard_element` sequentially for each tile.
       - Connect every data tile to the dashboard filters using `dashboard_filters: [{"dashboard_filter_name": "Date Range", "field": "view.date"}]`.
       - **Visual Hierarchy**:
         * **Row 1 (Top) — Executive KPI Cards (`type: "single_value"`)**:
           - 3 to 4 high-level headline metrics.
           - **2-Visible-Fields Comparison Rule**: To display a comparison badge (`show_comparison: true`), query must return TWO visible fields. Use a `dynamic_fields` table calculation (e.g., YoY % change) and place the grouping date dimension in `hidden_fields`.
           - *Note*: KPI tiles computing period-over-period with `offset()` should NOT listen to a single-period date filter (they define their own inline filter e.g. `filters: {"view.created_year": "2 years"}`).
         * **Row 2 (Middle) — Trends & Categorical Breakdowns**:
           - Time series: `looker_line` or `looker_area` sorted ascending by date.
           - Comparisons: `looker_column` or `looker_bar`.
           - **Dual-Axis Rule**: If plotting 2+ measures that differ in units (e.g. $ revenue vs % rate) or differ by >= 5x in magnitude, configure dual y-axes with explicit `series` mapping.
         * **Row 3 (Bottom) — Granular Detail Grid (`type: "looker_grid"`)**:
           - Dimension breakdowns and multi-measure table with `show_totals: true`.

    4. **Step 4 — Generate Embed URL (MANDATORY)**:
       - Once all elements have been added, call `generate_embed_url(type="dashboards", id=str(dashboard_id))` to obtain the secure embed URL for the dashboard.

    ===================================================================
    PHASE 3: VISUALIZATION CONFIGURATION & COLOR HYGIENE
    ===================================================================
    - Call `get_visualization_reference(vis_type)` if you need schema or parameter rules for a chart type.
    - **Rendered Series Keys Only**: `series_colors`, `series_types`, and `hidden_series` must ONLY be keyed by **measures** (or `"<pivot value> - <measure>"`), NEVER dimensions. For pie/donut slices, key by literal dimension values (e.g. `{"Search": "#4285F4"}`).
    - **No Palette Conflicts**: Never combine a positional `colors: [...]` array with a mapped `series_colors: {...}` dictionary.
    - **Value Formats**: Always provide explicit formats (`"$#,##0"`, `"0.0%"`, `"#,##0"`).

    ===================================================================
    PHASE 4: SURGICAL EDITS (EXISTING DASHBOARDS)
    ===================================================================
    - When asked to modify, restyle, add, or fix a tile on an existing dashboard, **NEVER delete and rebuild the whole dashboard**.
    - Use `update_dashboard_element` for tile and query changes.
    - Use `update_dashboard_layout_component` for resizing or repositioning.

    ===================================================================
    PHASE 5: FINAL VERIFICATION & RESPONSE FORMAT
    ===================================================================
    - Start your final response with the dashboard links:
      - `[Open Dashboard in Looker](<dashboard_url>)`
      - `Embed URL: <embed_url_from_generate_embed_url>`
    - Present a structured executive summary:
      1. **Executive Objective**: Summary of what was built.
      2. **Tiles & Metrics Configured**: List of KPIs, trend charts, and tables.
      3. **Interactive Filters**: Configured filters and tile bindings.
      4. **Suggested Next Steps / Analytical Actions**: Recommendations for further exploration.
    ''',
    tools=[looker_tool, get_visualization_reference]
)
