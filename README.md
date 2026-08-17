# Looker Dashboard Builder Agent

A production-grade AI Agent for building, styling, and verifying interactive **User Defined Dashboards (UDDs)** in Looker using Google ADK (Agent Development Kit), Gemini 2.5, Looker MCP, and PKCE OAuth.

---

## 🌟 Key Capabilities

* **Model & Explore Scoping**: Choose from discovered Looker models and explores to scope the dashboard.
* **Semantic Context Retrieval**: Automatically retrieves dimensions, measures, filters, and parameters on-demand for the chosen explore.
* **Strict Order of Operations**:
  1. Semantic grounding & filter suggestions check.
  2. `make_dashboard` container creation with clean professional titles.
  3. `add_dashboard_filter` global filters with wide initial date defaults (12 months).
  4. `add_dashboard_element` with visual hierarchy (KPI cards, trend lines, breakdown columns, detail tables) and filter bindings.
  5. Tile health verification and embed link generation.
* **Dual-Tier Skill Architecture**:
  * Core operational protocol loaded directly in system instructions.
  * Packaged `resources/looker_queries/` markdown references for deep parameter schemas via `get_visualization_reference`.
* **Surgical Mutations**: Restyle and edit tiles via `update_dashboard_element` without full rebuilds.
* **Looker PKCE OAuth**: Secure per-user authentication with direct token propagation to Looker MCP tools.

---

## 📁 Repository Structure

```
looker-dashboard-builder-agent/
├── agent.py                 # ADK Agent definition, Looker MCP toolset & dynamic reference tool
├── main.py                  # FastAPI server with /api/chat & /api/models-explores endpoints
├── resources/
│   └── looker_queries/      # Packaged visualization schemas (cartesian, table, single_value, etc.)
├── static/
│   ├── index.html           # Web UI with Looker OAuth login & Explore selector
│   ├── app.js               # PKCE OAuth flow, dynamic explore loader, and chat submission
│   └── style.css            # Dark glassmorphic styling
├── .agents/skills/          # Modular agent skills (dashboard-creation, looker-queries, etc.)
├── pyproject.toml           # Python dependencies
├── Dockerfile               # Cloud Run container build
├── .env.example             # Configuration template
├── Deploy_Notes.md          # Cloud Run deployment instructions
└── README.md                # Project documentation
```

---

## 🚀 Quickstart (Local Development)

### 1. Configure Environment

Copy `.env.example` to `.env` and fill in your settings:

```bash
cp .env.example .env
```

```env
GOOGLE_CLOUD_PROJECT="your-gcp-project-id"
GOOGLE_CLOUD_LOCATION="us-central1"
GOOGLE_GENAI_USE_VERTEXAI="True"
GEMINI_MODEL="gemini-2.5-flash"
MCP_SERVER_URL="https://<your-looker-instance-url>/mcp"
PORT=8001
```

### 2. Install Dependencies

Using [`uv`](https://docs.astral.sh/uv/):

```bash
uv sync
```

### 3. Run the Server

```bash
uv run python main.py
```

Open `http://localhost:8001` (or `https://localhost:8001` if SSL certificates are in `scratch/`).

---

## ☁️ Deployment to Cloud Run

See [`Deploy_Notes.md`](Deploy_Notes.md) for full commands.

```bash
gcloud run deploy looker-dashboard-builder \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=YOUR_PROJECT,GOOGLE_CLOUD_LOCATION=us-central1,GOOGLE_GENAI_USE_VERTEXAI=True,MCP_SERVER_URL=YOUR_MCP_URL,GEMINI_MODEL=gemini-2.5-flash"
```
