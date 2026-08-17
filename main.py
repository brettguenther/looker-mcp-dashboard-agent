import os
import json
import logging
from typing import List, Optional
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import httpx
import uvicorn

from google.adk.runners import InMemoryRunner
from google.genai import types
from agent import root_agent, looker_token_var, MCP_SERVER_URL

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Looker Dashboard Builder Agent")

# Static directory setup
static_dir = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir, exist_ok=True)

class ExploreSelection(BaseModel):
    model: str
    explore: str
    label: Optional[str] = None

class ChatRequest(BaseModel):
    prompt: str
    looker_access_token: str
    selected_explores: Optional[List[ExploreSelection]] = None
    session_id: Optional[str] = "session_1"

class ExploresRequest(BaseModel):
    looker_access_token: str
    looker_host: Optional[str] = None

@app.post("/api/models-explores")
async def list_models_explores(request: ExploresRequest):
    """Fetches available Looker models and explores using direct Looker API 4.0 GET /api/4.0/lookml_models."""
    if not request.looker_access_token:
        raise HTTPException(status_code=401, detail="Missing Looker Access Token")

    explores_list = []
    
    # Determine Looker API base URL from request or MCP_SERVER_URL
    looker_base_url = request.looker_host
    if not looker_base_url and MCP_SERVER_URL:
        looker_base_url = MCP_SERVER_URL.split("/mcp")[0]

    if looker_base_url:
        looker_base_url = looker_base_url.rstrip("/")
        headers = {
            "Authorization": f"token {request.looker_access_token}",
            "Content-Type": "application/json"
        }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                url = f"{looker_base_url}/api/4.0/lookml_models"
                logger.info(f"Calling Looker API 4.0 to discover models and explores: {url}")
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    models_data = resp.json()
                    if isinstance(models_data, list):
                        for m in models_data:
                            model_name = m.get("name")
                            model_label = m.get("label") or model_name
                            explores = m.get("explores") or []
                            for exp in explores:
                                exp_name = exp.get("name")
                                exp_label = exp.get("label") or exp_name
                                if model_name and exp_name:
                                    explores_list.append({
                                        "model": model_name,
                                        "explore": exp_name,
                                        "label": f"{model_label} : {exp_label}"
                                    })
                        logger.info(f"Discovered {len(explores_list)} explores via Looker API 4.0")
                else:
                    logger.warning(f"Looker API /api/4.0/lookml_models returned status {resp.status_code}: {resp.text[:200]}")
        except Exception as e:
            logger.warning(f"Failed to fetch models/explores via direct Looker API 4.0: {e}")

    # Fallback default: basic_ecomm / basic_order_items
    if not explores_list:
        explores_list = [
            {"model": "basic_ecomm", "explore": "basic_order_items", "label": "Basic Ecomm : Order Items"},
            {"model": "basic_ecomm", "explore": "users", "label": "Basic Ecomm : Users"},
            {"model": "basic_ecomm", "explore": "inventory_items", "label": "Basic Ecomm : Inventory Items"},
        ]

    return {"explores": explores_list}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    if not request.looker_access_token:
        raise HTTPException(status_code=401, detail="Missing Looker Access Token")
    if not request.prompt:
        raise HTTPException(status_code=400, detail="Missing Prompt")

    async def event_generator():
        token_context = looker_token_var.set(request.looker_access_token)
        try:
            final_prompt = request.prompt
            if request.selected_explores:
                first_exp = request.selected_explores[0]
                model_name = first_exp.model
                explore_name = first_exp.explore
                final_prompt = (
                    f"===================================================================\n"
                    f"CRITICAL TARGET DATA SOURCE MANDATE\n"
                    f"===================================================================\n"
                    f"Target Model: '{model_name}'\n"
                    f"Target Explore: '{explore_name}'\n\n"
                    f"MANDATORY EXECUTION CONSTRAINTS:\n"
                    f"1. RETRIEVE METADATA FIRST: Immediately retrieve fields for this explore: `get_dimensions(model='{model_name}', explore='{explore_name}')` and `get_measures(model='{model_name}', explore='{explore_name}')`.\n"
                    f"2. EXCLUSIVE EXPLORE USAGE: ALL dashboard tiles, queries, dynamic fields, and filters MUST exclusively use model='{model_name}' and explore='{explore_name}'. DO NOT query or reference any other explore.\n"
                    f"3. EMBED URL: After adding all tiles, call `generate_embed_url(type='dashboards', id=str(dashboard_id))` to obtain the secure embed URL.\n"
                    f"===================================================================\n\n"
                    f"User Request: {request.prompt}"
                )

            logger.info(f"Running Looker Dashboard Builder Agent with prompt: {request.prompt[:100]}...")

            runner = InMemoryRunner(agent=root_agent)
            runner.auto_create_session = True

            msg = types.Content(
                role="user",
                parts=[types.Part.from_text(text=final_prompt)]
            )

            # Stream runner events as Server-Sent Events (SSE)
            for event in runner.run(user_id=request.looker_access_token, session_id=request.session_id or "session_1", new_message=msg):
                # 1. Stream Thoughts (Internal reasoning)
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if hasattr(part, "thought") and part.thought:
                            yield f"data: {json.dumps({'type': 'thought', 'text': part.thought})}\n\n"

                # 2. Stream Function Calls / Tool invocations
                func_calls = event.get_function_calls() if hasattr(event, "get_function_calls") else []
                if not func_calls and event.content and event.content.parts:
                    for part in event.content.parts:
                        if hasattr(part, "function_call") and part.function_call:
                            func_calls.append(part.function_call)

                for call in func_calls:
                    call_name = getattr(call, "name", "tool")
                    call_args = getattr(call, "args", {})
                    if hasattr(call_args, "model_dump"):
                        call_args = call_args.model_dump()
                    elif not isinstance(call_args, dict):
                        try:
                            call_args = dict(call_args)
                        except Exception:
                            call_args = str(call_args)

                    yield f"data: {json.dumps({'type': 'tool_call', 'name': call_name, 'args': call_args})}\n\n"

                # 3. Stream Tool Responses
                func_resps = event.get_function_responses() if hasattr(event, "get_function_responses") else []
                if not func_resps and event.content and event.content.parts:
                    for part in event.content.parts:
                        if hasattr(part, "function_response") and part.function_response:
                            func_resps.append(part.function_response)

                for resp in func_resps:
                    resp_name = getattr(resp, "name", "tool")
                    resp_output = getattr(resp, "response", {})
                    if hasattr(resp_output, "model_dump"):
                        resp_output = resp_output.model_dump()
                    elif not isinstance(resp_output, (dict, list, str, int, float, bool)):
                        resp_output = str(resp_output)

                    yield f"data: {json.dumps({'type': 'tool_response', 'name': resp_name, 'output': resp_output})}\n\n"

                # 4. Stream Markdown text
                if event.content and event.content.parts:
                    for part in event.content.parts:
                        if hasattr(part, "text") and part.text:
                            yield f"data: {json.dumps({'type': 'text', 'text': part.text})}\n\n"

                if event.error_message:
                    yield f"data: {json.dumps({'type': 'error', 'message': event.error_message})}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            logger.error(f"Error in chat stream: {e}", exc_info=True)
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            looker_token_var.reset(token_context)

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# Serve the main frontend index.html
@app.get("/", response_class=HTMLResponse)
async def get_index():
    html_path = os.path.join(static_dir, "index.html")
    if not os.path.exists(html_path):
        raise HTTPException(status_code=404, detail="Frontend index.html not found")
    with open(html_path, "r") as f:
        return f.read()

# Mount the static files (js, css)
app.mount("/static", StaticFiles(directory=static_dir), name="static")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8001))
    cert_path = os.path.join(os.path.dirname(__file__), "scratch", "cert.pem")
    key_path = os.path.join(os.path.dirname(__file__), "scratch", "key.pem")

    if os.path.exists(cert_path) and os.path.exists(key_path):
        logger.info(f"Starting server with HTTPS on port {port}")
        uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True, ssl_keyfile=key_path, ssl_certfile=cert_path)
    else:
        logger.info(f"Starting server with HTTP on port {port}")
        uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
