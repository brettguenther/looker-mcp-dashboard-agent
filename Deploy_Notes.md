# Deployment Guide: Looker Dashboard Builder Agent

Deploy directly to Google Cloud Run using the `gcloud` CLI:

```bash
PROJECT_ID="your-gcp-project-id"
REGION="us-central1"
MCP_SERVER_URL="https://<your-looker-instance-url>/mcp"
SERVICE_NAME="looker-dashboard-builder"

gcloud run deploy ${SERVICE_NAME} \
  --source . \
  --region ${REGION} \
  --allow-unauthenticated \
  --set-env-vars="GOOGLE_CLOUD_PROJECT=${PROJECT_ID},GOOGLE_CLOUD_LOCATION=${REGION},GOOGLE_GENAI_USE_VERTEXAI=True,MCP_SERVER_URL=${MCP_SERVER_URL},GEMINI_MODEL=gemini-2.5-flash"
```

## OAuth Setup in Looker

1. Open Looker Admin > **OAuth Applications**.
2. Click **Add Application**.
3. Set **Application Name**: `Looker Dashboard Builder`.
4. Set **Redirect URI**: `https://<your-cloud-run-service-url>` (or `https://localhost:8001` for local dev).
5. Copy the generated **Client ID (GUID)** to use during web login.
