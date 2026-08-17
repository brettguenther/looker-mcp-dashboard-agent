document.addEventListener("DOMContentLoaded", () => {
    const connectScreen = document.getElementById("connect-screen");
    const chatScreen = document.getElementById("chat-screen");
    const btnConnect = document.getElementById("btn-connect");
    const btnDisconnect = document.getElementById("btn-disconnect");
    const authStatus = document.getElementById("auth-status");
    const lookerHostInput = document.getElementById("looker-host");
    const clientIdInput = document.getElementById("client-id");
    
    const chatForm = document.getElementById("chat-form");
    const userInput = document.getElementById("user-input");
    const chatMessages = document.getElementById("chat-messages");
    const exploreSelect = document.getElementById("explore-select");
    const customModelInput = document.getElementById("custom-model");
    const customExploreInput = document.getElementById("custom-explore");
    const btnApplyCustomScope = document.getElementById("btn-apply-custom-scope");
    const btnRefreshExplores = document.getElementById("btn-refresh-explores");
    const activeScopeBadge = document.getElementById("active-scope-badge");
    const scopeText = document.getElementById("scope-text");
    const headerScopeInfo = document.getElementById("header-scope-info");
    const templateBtns = document.querySelectorAll(".template-btn");

    // Load saved settings
    if (localStorage.getItem("looker_host")) {
        lookerHostInput.value = localStorage.getItem("looker_host");
    }
    if (localStorage.getItem("client_id")) {
        clientIdInput.value = localStorage.getItem("client_id");
    }
    
    // Dynamic redirect URI
    const redirectUriInput = document.getElementById("redirect-uri");
    if (redirectUriInput) {
        redirectUriInput.value = window.location.origin;
    }

    // 1. CHECK FOR OAUTH CALLBACK
    const urlParams = new URLSearchParams(window.location.search);
    const authCode = urlParams.get("code");
    
    if (authCode) {
        showStatus("Exchanging authorization code for Looker access token...", "info");
        const codeVerifier = sessionStorage.getItem("code_verifier");
        
        if (!codeVerifier) {
            showStatus("OAuth Error: Missing code verifier. Please reconnect.", "error");
            cleanUrl();
        } else {
            sessionStorage.removeItem("code_verifier");
            
            redeemAuthCode(authCode, codeVerifier)
                .then(data => {
                    sessionStorage.setItem("looker_access_token", data.access_token);
                    showStatus("Connected to Looker successfully!", "info");
                    setTimeout(() => {
                        cleanUrl();
                        checkAuthState();
                    }, 600);
                })
                .catch(err => {
                    showStatus(`Token Exchange Failed: ${err.message}`, "error");
                    cleanUrl();
                });
        }
    } else {
        checkAuthState();
    }

    // 2. AUTH STATE & INITIALIZATION
    function checkAuthState() {
        const token = sessionStorage.getItem("looker_access_token");
        if (token) {
            connectScreen.classList.add("hidden");
            chatScreen.classList.remove("hidden");
            loadModelsAndExplores();
        } else {
            connectScreen.classList.remove("hidden");
            chatScreen.classList.add("hidden");
        }
    }

    // 3. EXPLORE SCOPING & DISCOVERY
    async function loadModelsAndExplores() {
        const token = sessionStorage.getItem("looker_access_token");
        const host = localStorage.getItem("looker_host") || "";
        if (!token) return;

        exploreSelect.innerHTML = `<option value="">🔄 Discovering Looker Explores...</option>`;

        let explores = [];

        // 1. Try direct Looker API 4.0 CORS call (/api/4.0/lookml_models)
        if (host) {
            try {
                const cleanHost = host.replace(/\/$/, "");
                const resp = await fetch(`${cleanHost}/api/4.0/lookml_models`, {
                    method: "GET",
                    headers: {
                        "Authorization": `token ${token}`,
                        "Content-Type": "application/json"
                    }
                });
                if (resp.ok) {
                    const modelsData = await resp.json();
                    if (Array.isArray(modelsData)) {
                        modelsData.forEach(m => {
                            const modelName = m.name;
                            const modelLabel = m.label || m.name;
                            if (Array.isArray(m.explores)) {
                                m.explores.forEach(exp => {
                                    explores.push({
                                        model: modelName,
                                        explore: exp.name,
                                        label: `${modelLabel} : ${exp.label || exp.name}`
                                    });
                                });
                            }
                        });
                        console.log(`Discovered ${explores.length} explores via direct Looker CORS API.`);
                    }
                }
            } catch (err) {
                console.warn("Direct Looker CORS API call failed, falling back to backend proxy:", err);
            }
        }

        // 2. Fallback to backend /api/models-explores proxy if direct CORS was blocked or empty
        if (explores.length === 0) {
            try {
                const resp = await fetch("/api/models-explores", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ 
                        looker_access_token: token,
                        looker_host: host
                    })
                });
                if (resp.ok) {
                    const data = await resp.json();
                    explores = data.explores || [];
                }
            } catch (e) {
                console.warn("Backend /api/models-explores failed:", e);
            }
        }

        // 3. Fallback to basic_ecomm / basic_order_items default
        if (explores.length === 0) {
            explores = [
                { model: "basic_ecomm", explore: "basic_order_items", label: "Basic Ecomm : Order Items" },
                { model: "basic_ecomm", explore: "users", label: "Basic Ecomm : Users" },
                { model: "basic_ecomm", explore: "inventory_items", label: "Basic Ecomm : Inventory Items" }
            ];
        }

        // Populate dropdown
        exploreSelect.innerHTML = `<option value="">-- Choose Model / Explore --</option>`;
        explores.forEach(item => {
            const option = document.createElement("option");
            option.value = JSON.stringify({ model: item.model, explore: item.explore });
            option.textContent = item.label || `${item.model} : ${item.explore}`;
            exploreSelect.appendChild(option);
        });

        // Restore saved explore or default to basic_ecomm / basic_order_items
        const savedExplore = localStorage.getItem("selected_explore");
        if (savedExplore) {
            exploreSelect.value = savedExplore;
        } else {
            const defaultVal = JSON.stringify({ model: "basic_ecomm", explore: "basic_order_items" });
            exploreSelect.value = defaultVal;
            localStorage.setItem("selected_explore", defaultVal);
        }
        updateScopeDisplay();
    }

    exploreSelect.addEventListener("change", () => {
        if (exploreSelect.value) {
            localStorage.setItem("selected_explore", exploreSelect.value);
            updateScopeDisplay();
        }
    });

    if (btnApplyCustomScope) {
        btnApplyCustomScope.addEventListener("click", () => {
            const m = customModelInput.value.trim();
            const e = customExploreInput.value.trim();
            if (!m || !e) {
                alert("Please enter both Model name and Explore name.");
                return;
            }
            const val = JSON.stringify({ model: m, explore: e });
            localStorage.setItem("selected_explore", val);
            
            // Add option if not present
            let exists = false;
            for (let opt of exploreSelect.options) {
                if (opt.value === val) {
                    exists = true;
                    break;
                }
            }
            if (!exists) {
                const opt = document.createElement("option");
                opt.value = val;
                opt.textContent = `${m} : ${e} (Custom)`;
                exploreSelect.appendChild(opt);
            }
            exploreSelect.value = val;
            updateScopeDisplay();
        });
    }

    if (btnRefreshExplores) {
        btnRefreshExplores.addEventListener("click", () => {
            loadModelsAndExplores();
        });
    }

    function updateScopeDisplay() {
        const val = localStorage.getItem("selected_explore") || exploreSelect.value;
        if (val) {
            try {
                const parsed = JSON.parse(val);
                activeScopeBadge.classList.remove("hidden");
                scopeText.textContent = `Scope: ${parsed.model} / ${parsed.explore}`;
                headerScopeInfo.textContent = `Target Scope: ${parsed.model} / ${parsed.explore} — Ready to build`;
                return;
            } catch (e) {}
        }
        activeScopeBadge.classList.remove("hidden");
        scopeText.textContent = "Scope: basic_ecomm / basic_order_items";
        headerScopeInfo.textContent = "Target Scope: basic_ecomm / basic_order_items — Ready to build";
    }

    function getSelectedExplores() {
        const val = localStorage.getItem("selected_explore") || exploreSelect.value;
        if (val) {
            try {
                const parsed = JSON.parse(val);
                return [{ model: parsed.model, explore: parsed.explore }];
            } catch (e) {}
        }
        return [{ model: "basic_ecomm", explore: "basic_order_items" }];
    }

    // 4. PKCE OAUTH LOGIN
    btnConnect.addEventListener("click", async () => {
        const host = lookerHostInput.value.trim().replace(/\/$/, "");
        const clientId = clientIdInput.value.trim();
        const redirectUri = window.location.origin;
        
        if (!host || !clientId) {
            showStatus("Please enter both Looker Instance Host and Client ID.", "error");
            return;
        }
        
        localStorage.setItem("looker_host", host);
        localStorage.setItem("client_id", clientId);
        
        try {
            showStatus("Initiating PKCE authentication...", "info");
            
            const codeVerifier = secureRandom(32);
            const codeChallenge = await sha256Hash(codeVerifier);
            
            sessionStorage.setItem("code_verifier", codeVerifier);
            
            const authUrl = new URL(`${host}/auth`);
            authUrl.searchParams.append("response_type", "code");
            authUrl.searchParams.append("client_id", clientId);
            authUrl.searchParams.append("redirect_uri", redirectUri);
            authUrl.searchParams.append("scope", "cors_api");
            authUrl.searchParams.append("state", secureRandom(8));
            authUrl.searchParams.append("code_challenge_method", "S256");
            authUrl.searchParams.append("code_challenge", codeChallenge);
            
            showStatus("Redirecting to Looker...", "info");
            window.location.href = authUrl.toString();
        } catch (e) {
            showStatus(`Auth initialization failed: ${e.message}`, "error");
        }
    });

    // 5. DISCONNECT
    btnDisconnect.addEventListener("click", () => {
        sessionStorage.removeItem("looker_access_token");
        localStorage.removeItem("selected_explore");
        checkAuthState();
    });

    // 6. QUICK PROMPTS
    templateBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const prompt = btn.getAttribute("data-prompt");
            userInput.value = prompt;
            userInput.focus();
        });
    });

    // 7. STREAMING CHAT MESSAGE HANDLING WITH PROGRESS ACCORDION
    chatForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const text = userInput.value.trim();
        if (!text) return;
        
        appendUserMessage(text);
        userInput.value = "";
        
        const token = sessionStorage.getItem("looker_access_token");
        const selectedExplores = getSelectedExplores();
        
        // Create agent message container with live activity accordion
        const agentMsgId = createAgentStreamMessage();
        const progressList = document.getElementById(`${agentMsgId}-progress-list`);
        const textContainer = document.getElementById(`${agentMsgId}-text`);
        const previewContainer = document.getElementById(`${agentMsgId}-preview`);
        
        let accumulatedMarkdown = "";
        let foundEmbedUrl = null;

        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: text,
                    looker_access_token: token,
                    selected_explores: selectedExplores
                })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.detail || "Server stream error");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop(); // keep partial chunk in buffer

                for (let line of lines) {
                    line = line.trim();
                    if (!line.startsWith("data: ")) continue;
                    const jsonStr = line.replace(/^data: /, "");
                    try {
                        const event = JSON.parse(jsonStr);
                        
                        if (event.type === "thought") {
                            addProgressStep(progressList, "💭 Reasoning", event.text, "thought");
                        } else if (event.type === "tool_call") {
                            const stepTitle = getToolDescription(event.name, event.args);
                            addProgressStep(progressList, stepTitle, JSON.stringify(event.args, null, 2), "running", event.name);
                        } else if (event.type === "tool_response") {
                            completeProgressStep(progressList, event.name, event.output);
                            
                            // Check if embed url in output
                            if (event.name === "generate_embed_url" && event.output && event.output.url) {
                                foundEmbedUrl = event.output.url;
                            }
                        } else if (event.type === "text") {
                            accumulatedMarkdown += event.text;
                            textContainer.innerHTML = marked.parse(accumulatedMarkdown);
                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        } else if (event.type === "error") {
                            addProgressStep(progressList, "❌ Error", event.message, "error");
                        }
                    } catch (err) {
                        console.error("SSE parse error:", err, jsonStr);
                    }
                }
            }

            // Extract embed URL from markdown if not already found
            if (!foundEmbedUrl) {
                const urlMatch = accumulatedMarkdown.match(/https:\/\/[^\s\)\"]+\/embed\/dashboards\/[0-9]+/i) ||
                                 accumulatedMarkdown.match(/https:\/\/[^\s\)\"]+\/dashboards\/[0-9]+/i);
                if (urlMatch) {
                    foundEmbedUrl = urlMatch[0];
                    if (!foundEmbedUrl.includes("/embed/")) {
                        foundEmbedUrl = foundEmbedUrl.replace("/dashboards/", "/embed/dashboards/");
                    }
                }
            }

            // Render Embed Preview if available
            if (foundEmbedUrl) {
                renderDashboardEmbed(previewContainer, foundEmbedUrl);
            }

        } catch (err) {
            textContainer.innerHTML += `<div class="error-badge">❌ <strong>Error:</strong> ${err.message}</div>`;
        }
    });

    // 8. PROGRESS ACCORDION HELPERS
    function getToolDescription(toolName, args) {
        if (toolName === "get_dimensions" || toolName === "get_measures") {
            return `🔍 Grounding fields from explore: <code>${args.explore || 'explore'}</code>`;
        } else if (toolName === "make_dashboard") {
            return `📋 Creating dashboard container: <strong>"${args.title || 'Report'}"</strong>`;
        } else if (toolName === "add_dashboard_filter") {
            return `🎛️ Adding global filter: <strong>"${args.title || args.name}"</strong>`;
        } else if (toolName === "add_dashboard_element") {
            return `📊 Authoring tile: <strong>"${args.title || 'Metric Chart'}"</strong>`;
        } else if (toolName === "update_dashboard_element") {
            return `✏️ Surgically updating tile: <strong>"${args.title || 'Tile'}"</strong>`;
        } else if (toolName === "generate_embed_url") {
            return `🔗 Generating Looker Embed URL for dashboard`;
        } else if (toolName === "get_visualization_reference") {
            return `📖 Reading visualization reference: <code>${args.vis_type}</code>`;
        } else if (toolName === "query" || toolName === "run_dashboard") {
            return `⚡ Executing Looker query verification`;
        }
        return `🔧 Executing <code>${toolName}</code>`;
    }

    function createAgentStreamMessage() {
        const msgId = `msg-${Date.now()}`;
        const msgDiv = document.createElement("div");
        msgDiv.id = msgId;
        msgDiv.className = "message agent fade-in";
        
        msgDiv.innerHTML = `
            <div class="avatar">🤖</div>
            <div class="msg-bubble">
                <details class="progress-accordion" open>
                    <summary class="progress-summary">
                        <span class="pulse-indicator"></span>
                        <span class="summary-title">Live Build Activity</span>
                    </summary>
                    <div id="${msgId}-progress-list" class="progress-list"></div>
                </details>
                <div id="${msgId}-text" class="msg-text"></div>
                <div id="${msgId}-preview" class="dashboard-preview-card hidden"></div>
            </div>
        `;
        
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return msgId;
    }

    function addProgressStep(listElement, titleHtml, detailsText, status, toolKey) {
        const step = document.createElement("div");
        step.className = `progress-step ${status}`;
        if (toolKey) step.setAttribute("data-tool", toolKey);

        const icon = status === "running" ? `<span class="step-spinner"></span>` :
                     status === "thought" ? `<span class="step-icon">💡</span>` : `<span class="step-icon">✔️</span>`;

        step.innerHTML = `
            <div class="step-header">
                ${icon}
                <div class="step-title">${titleHtml}</div>
            </div>
        `;
        listElement.appendChild(step);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function completeProgressStep(listElement, toolKey, output) {
        const steps = listElement.querySelectorAll(`[data-tool="${toolKey}"]`);
        if (steps.length > 0) {
            const latest = steps[steps.length - 1];
            latest.className = "progress-step completed";
            const spinner = latest.querySelector(".step-spinner");
            if (spinner) {
                spinner.outerHTML = `<span class="step-icon">✔️</span>`;
            }
        }
    }

    function renderDashboardEmbed(container, embedUrl) {
        container.classList.remove("hidden");
        const lookerUrl = embedUrl.replace("/embed/dashboards/", "/dashboards/");

        container.innerHTML = `
            <div class="embed-header">
                <div class="embed-title">
                    <span class="embed-icon">📊</span>
                    <span>Live Looker Dashboard Embed</span>
                </div>
                <div class="embed-actions">
                    <a href="${lookerUrl}" target="_blank" class="btn btn-secondary btn-xs">Open in Looker ↗</a>
                </div>
            </div>
            <div class="embed-frame-container">
                <iframe src="${embedUrl}" class="looker-iframe" allowfullscreen="true"></iframe>
            </div>
        `;
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function appendUserMessage(text) {
        const msgDiv = document.createElement("div");
        msgDiv.className = "message user fade-in";
        msgDiv.innerHTML = `
            <div class="avatar">👤</div>
            <div class="msg-bubble">${escapeHtml(text)}</div>
        `;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // HELPERS
    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function arrayToHex(array) {
        return Array.from(new Uint8Array(array)).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function secureRandom(byteCount) {
        const array = new Uint8Array(byteCount);
        window.crypto.getRandomValues(array);
        return arrayToHex(array);
    }

    async function sha256Hash(message) {
        const msgUint8 = new TextEncoder().encode(message);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgUint8);
        return btoa(String.fromCharCode(...new Uint8Array(hashBuffer)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    async function redeemAuthCode(code, codeVerifier) {
        const host = localStorage.getItem("looker_host");
        const clientId = localStorage.getItem("client_id");
        const redirectUri = window.location.origin;
        
        const tokenUrl = `${host}/api/token`;
        
        const response = await fetch(tokenUrl, {
            method: "POST",
            mode: "cors",
            headers: { "Content-Type": "application/json;charset=UTF-8" },
            body: JSON.stringify({
                grant_type: "authorization_code",
                client_id: clientId,
                redirect_uri: redirectUri,
                code: code,
                code_verifier: codeVerifier
            })
        });
        
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error_description || err.error || `HTTP ${response.status}`);
        }
        
        return await response.json();
    }

    function showStatus(msg, type) {
        authStatus.textContent = msg;
        authStatus.className = `status-msg ${type}`;
    }

    function cleanUrl() {
        window.history.replaceState({}, document.title, "/");
    }
});
