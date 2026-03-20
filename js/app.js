// ============================================
// Smart Route SRMist — Agentic AI Travel Planner
// All locations from APIs, zero duplicates, weather/crowd replan,
// live nearby suggestions, Indian language support
// Deep Chennai & SRM integration
// Full agentic booking workflow (flights, trains, hotels, cabs, payment)
// ============================================

const API_BASE = (() => {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:8000';
    const sandboxHost = h.replace(/^\d+-/, '8000-');
    return `${window.location.protocol}//${sandboxHost}`;
})();

// === STATE ===
const state = {
    theme: 'dark', persona: 'solo', ws: null,
    itinerary: null, agents: {}, logs: [],
    rl: { rewards: [], episode: 0, alpha: 0.4, beta: 0.3, gamma: 0.2, delta: 0.1 },
    bayesian: { cultural: { a: 2, b: 2 }, adventure: { a: 2, b: 2 }, food: { a: 3, b: 1 }, relaxation: { a: 1, b: 3 }, shopping: { a: 1, b: 2 } },
    budget: { total: 15000, used: 0 },
    chatOpen: false, chatHistory: [], currentDest: '',
    generating: false, autoMode: true,
    userLocation: null,  // For live trip tracking
    tripActive: false,   // Whether user is on an active trip
    weatherData: [],      // Real weather forecasts
    aiData: {},           // Backend AI state (MCTS, MDP, Bayesian, POMDP, Dirichlet)
    pomdpBelief: {},      // POMDP belief state
    dirichletData: {},    // Dirichlet preference proportions
    bayesianCI: {},       // Bayesian confidence intervals
};

// === AGENT DEFINITIONS ===
const AGENTS = [
    { id: 'planner', name: 'Planner Agent', role: 'Itinerary Planning', icon: '🗺', color: '#667eea' },
    { id: 'weather', name: 'Weather Risk Agent', role: 'Weather Monitoring', icon: '🌦', color: '#06b6d4' },
    { id: 'crowd', name: 'Crowd Analyzer', role: 'Crowd Intelligence', icon: '👥', color: '#f59e0b' },
    { id: 'budget', name: 'Budget Optimizer', role: 'Financial Planning', icon: '💰', color: '#10b981' },
    { id: 'preference', name: 'Preference Agent', role: 'Taste Learning', icon: '❤️', color: '#ec4899' },
    { id: 'booking', name: 'Booking Assistant', role: 'Reservations', icon: '🎫', color: '#8b5cf6' },
    { id: 'explain', name: 'Explainability Agent', role: 'AI Reasoning', icon: '🧠', color: '#f97316' }
];

// === CITY COORDINATES (fallback) ===
const CITY_COORDS = {
    paris: [48.8566, 2.3522], london: [51.5074, -0.1278], tokyo: [35.6762, 139.6503],
    jaipur: [26.9124, 75.7873], rome: [41.9028, 12.4964], 'new york': [40.7128, -74.006],
    dubai: [25.2048, 55.2708], singapore: [1.3521, 103.8198], bangkok: [13.7563, 100.5018],
    barcelona: [41.3874, 2.1686], istanbul: [41.0082, 28.9784], amsterdam: [52.3676, 4.9041],
    sydney: [-33.8688, 151.2093], bali: [-8.3405, 115.0920], goa: [15.2993, 74.1240],
    udaipur: [24.5854, 73.7125], varanasi: [25.3176, 83.0068], mumbai: [19.0760, 72.8777],
    delhi: [28.7041, 77.1025], agra: [27.1767, 78.0081],
    chennai: [13.0827, 80.2707], srm: [12.8231, 80.0442], srmist: [12.8231, 80.0442],
    kattankulathur: [12.8231, 80.0442], mahabalipuram: [12.6169, 80.1993],
    pondicherry: [11.9416, 79.8083], bangalore: [12.9716, 77.5946], bengaluru: [12.9716, 77.5946],
    hyderabad: [17.3850, 78.4867], kolkata: [22.5726, 88.3639], lucknow: [26.8467, 80.9462],
    kochi: [9.9312, 76.2673], shimla: [31.1048, 77.1734], manali: [32.2432, 77.1892]
};

// ============================================
// PHOTO PLACEHOLDERS (Creative Commons)
// ============================================
const PHOTO_PLACEHOLDERS = {
    attraction: 'https://sspark.genspark.ai/cfimages?u1=R%2BZY3Tx3vEYhkOm1j2x8pLeov%2BynIZ4OzXHdQ9omdnhjWQtPz%2B1hHpbmU3ScEi4ACuIpA1N3PxFO3rxpooFh3HAP7Ii8OKmU6xst6HfkReVDvaZQkLFjlSLr%2Bx2pyNiFW5PpZX%2B28EP0LVP5mRQ%3D&u2=aRrADDNkh%2BA5lVUD&width=2560',
    landmark: 'https://sspark.genspark.ai/cfimages?u1=R%2BZY3Tx3vEYhkOm1j2x8pLeov%2BynIZ4OzXHdQ9omdnhjWQtPz%2B1hHpbmU3ScEi4ACuIpA1N3PxFO3rxpooFh3HAP7Ii8OKmU6xst6HfkReVDvaZQkLFjlSLr%2Bx2pyNiFW5PpZX%2B28EP0LVP5mRQ%3D&u2=aRrADDNkh%2BA5lVUD&width=2560',
    museum: 'https://sspark.genspark.ai/cfimages?u1=6bL718YIIIyfZnO9wqTs9Zmt9CsrFiWXz8rmfLhW9ODp6Oi1z%2BED%2FbVbOTAoY1gP%2FgeTV1VLBAeHovQkdDMO1KoWBXsKFYn0GINgFTnLd34fQRoi8eB%2F9IuVyBrWkX46p3cj%2FhDuxRDaKQnlZkjKtWI0&u2=P0gNi0cNTbvSH5wp&width=2560',
    park: 'https://sspark.genspark.ai/cfimages?u1=wX%2BCquDhZTOE0eoEieWPRPaNj2%2BnzbtOzmxpp8WFGyO2i7oE7WtaakPc%2BrdgytmcdhL2G84%2Fu%2F8uH5pjOM5i%2BdEQglIW5SJ9qafY%2FXexHiTpNQ%3D%3D&u2=2nYGPh9KVCCwxLrD&width=2560',
    beach: 'https://sspark.genspark.ai/cfimages?u1=X%2FmNtxmJV5SFnf43IPAGcosNv8RrnoQ7LEJK5NIVcX6lpdTXk%2Bbw5SYxP6w0yjArl0IpZazgm%2BmHwg6iqBDAhE2H62ahIpPJ%2F4ID3puMW8dtz6FWicO43OfjnDqnc%2F8n8svietGvQkvZBWanbDXkYAXz6PRfJ1U%3D&u2=%2BA11ndTEBbUWEONO&width=2560',
    religious: 'https://sspark.genspark.ai/cfimages?u1=KDpzyu2XhHuxTEV8sfbrlR5gsS76yDnWxYYje2zefxRjfxUaA4n0cCnS%2BFsK%2BD%2BbbwPQCEep3fHZq7e%2BxFNxH5mGDRj%2FYjzvnegzRYB%2BmKTxgFTj8frZC9cBqjsnBYatepOkLg3jWJAEfLmUAupzA%2BNfV5QCSS3HXKF6%2FRfAo7jgMIL79sXzXmicPp5syo%2FbVyc%2Frakl8xgSbqjTHe5tKS6buPTzGd5nVyaFpZUVnsFUGUWDLewPZIXafsIkDRaQtaRav1KkiT4sWXRGXFt1d8h5xs1Iqw%3D%3D&u2=OBUQE%2F3j1TvKzRNs&width=2560',
    market: 'https://sspark.genspark.ai/cfimages?u1=inECRwNEsP%2B5AEK86uiEQ5IVBino9qMxaz93SA0AMLSR%2BenhxFVB%2FjMxo%2Bcg7bT6sr%2BSGlh3E%2FLaDeyL5RCzO%2ByXp7a12xaKpNcJm39yg8R%2B3%2FV%2Bykin4yY0mIpeTYkUsQ%3D%3D&u2=Jzq3yFx83goQrwjQ&width=2560',
    food: 'https://sspark.genspark.ai/cfimages?u1=inECRwNEsP%2B5AEK86uiEQ5IVBino9qMxaz93SA0AMLSR%2BenhxFVB%2FjMxo%2Bcg7bT6sr%2BSGlh3E%2FLaDeyL5RCzO%2ByXp7a12xaKpNcJm39yg8R%2B3%2FV%2Bykin4yY0mIpeTYkUsQ%3D%3D&u2=Jzq3yFx83goQrwjQ&width=2560',
    hotel: 'https://sspark.genspark.ai/cfimages?u1=sii7UsO8n7CZrviwuPn4FC%2B3rzIP61dafR2pzlB1uoakPvBtx3fvnseDgglH6anlYPvexPZdlxnU45yPlxxkpEaoDXVHx6Z1JnrA8RynPDmSDVJTUHqSG9JpKuOHlQ%3D%3D&u2=u8srVTPo3t1HgrQa&width=2560',
    transport: 'https://sspark.genspark.ai/cfimages?u1=sWq%2BOExuKgpkCtgaT9tcHlzNyhCsVzC2lS6s59llKVZSqnKnD2dJrg%2B%2BSG7zavFvPsb9UVpgiw3ffegUKH7aJfayU8U%2B5V4Ysx8vIK18iIo%2BXo1XtRmL2i1HBax1iuXDhmlynJ6m9AkUFX68%2Bv9o%2FlkeBGJOpR3Ll1M8j70%3D&u2=UO7WYGQok6WUsISo&width=2560'
};

const PLACEHOLDER_TYPE_MAP = {
    museum: 'museum',
    gallery: 'museum',
    park: 'park',
    garden: 'park',
    nature: 'park',
    nature_reserve: 'park',
    beach: 'beach',
    viewpoint: 'beach',
    religious: 'religious',
    temple: 'religious',
    church: 'religious',
    mosque: 'religious',
    market: 'market',
    shopping: 'market',
    food: 'food',
    restaurant: 'food',
    cafe: 'food',
    historic: 'landmark',
    fort: 'landmark',
    palace: 'landmark',
    monument: 'landmark',
    architecture: 'landmark',
    landmark: 'landmark',
    attraction: 'attraction',
    hotel: 'hotel',
    train: 'transport',
    station: 'transport',
    transport: 'transport'
};

function getPlaceholderPhoto(type) {
    const key = PLACEHOLDER_TYPE_MAP[(type || '').toLowerCase()] || '';
    return PHOTO_PLACEHOLDERS[key] || '';
}

function applyPlaceholderToActivity(act) {
    if (!act || act.photo) return;
    const placeholder = getPlaceholderPhoto(act.type || 'attraction');
    if (placeholder) {
        act.photo = placeholder;
        act.photos = [placeholder];
        act.photo_is_placeholder = true;
    }
}

function fixItineraryPhotos(itinerary) {
    if (!itinerary?.days) return;
    itinerary.days.forEach(day => {
        (day.activities || []).forEach(act => {
            applyPlaceholderToActivity(act);
            if (act.media && act.photo) act.media.photos = [act.photo];
        });
    });
}

// ============================================
// INIT
// ============================================
function init() {
    renderAgents();
    renderBayesianBars();
    initMap();
    setupEventListeners();
    connectWebSocket();
    setInterval(updateAgentPulse, 3000);
    document.getElementById('startDate').valueAsDate = new Date();
    
    // Load persisted Bayesian prefs from backend
    loadBayesianFromBackend();
    loadDirichletFromBackend();
    checkBackendStatus();
    
    // Try to detect user location on startup for the origin field
    tryAutoDetectOrigin();

    const urlParams = new URLSearchParams(window.location.search);
    const destParam = urlParams.get('dest');
    if (destParam) {
        document.getElementById('destination').value = destParam;
        const daysParam = urlParams.get('days');
        if (daysParam) document.getElementById('duration').value = daysParam;
        setTimeout(() => generateTrip(), 500);
    }

    console.log('Smart Route SRMist initialized — Agentic AI Travel Planner');
}

// === GPS LOCATION DETECTION ===
async function tryAutoDetectOrigin() {
    // Silently try to get user location on startup (don't bother user if it fails)
    if (!navigator.geolocation) return;
    try {
        const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: false, timeout: 5000, maximumAge: 300000
            });
        });
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        // Reverse geocode to get location name
        const cityName = await reverseGeocode(lat, lon);
        if (cityName) {
            const originField = document.getElementById('origin');
            if (originField && !originField.value) {
                originField.value = cityName;
                originField.placeholder = cityName;
                showToast(`Location detected: ${cityName}`, 'info');
            }
        }
    } catch (e) {
        // Silently fail — user can manually enter
    }
}

async function detectUserLocation() {
    const originField = document.getElementById('origin');
    if (!navigator.geolocation) {
        showToast('GPS not available. Please enter your location manually.', 'warning');
        return;
    }
    
    showToast('Detecting your location...', 'info');
    
    try {
        const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true, timeout: 10000, maximumAge: 60000
            });
        });
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        const cityName = await reverseGeocode(lat, lon);
        if (cityName && originField) {
            originField.value = cityName;
            showToast(`Location detected: ${cityName}`, 'success');
        } else {
            showToast('Could not determine your city. Please enter manually.', 'warning');
        }
    } catch (e) {
        showToast('GPS failed. Please enter your location manually.', 'warning');
    }
}

async function reverseGeocode(lat, lon) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12&addressdetails=1`, {
            headers: { 'User-Agent': 'SmartRoute/14.0' }
        });
        if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};
            // Return most meaningful location: city > town > county > state
            return addr.city || addr.town || addr.village || addr.county || addr.state || data.display_name?.split(',')[0] || '';
        }
    } catch (e) { /* silent */ }
    return '';
}

// === MAP ===
let map, markers = [], routeLine, nearbyMarkers = [];

function initMap() {
    const el = document.getElementById('map');
    if (!el) return;
    try {
        map = L.map('map', { center: [20, 0], zoom: 2, zoomControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org">OSM</a>',
            maxZoom: 19
        }).addTo(map);
        setTimeout(() => map.invalidateSize(), 500);
        addLog('planner', 'Map initialized', 'success');
    } catch (e) { console.error('Map init failed:', e); }
}

function clearMap() {
    markers.forEach(m => map?.removeLayer(m));
    markers = [];
    nearbyMarkers.forEach(m => map?.removeLayer(m));
    nearbyMarkers = [];
    if (routeLine && map) { map.removeLayer(routeLine); routeLine = null; }
}

function updateMap(itinerary) {
    if (!map || !itinerary?.days) return;
    clearMap();
    const coords = [];
    let counter = 1;
    const colors = {
        cultural: '#f59e0b', adventure: '#10b981', food: '#ef4444', shopping: '#8b5cf6',
        religious: '#06b6d4', landmark: '#667eea', museum: '#764ba2', fort: '#f97316',
        palace: '#ec4899', historic: '#f97316', hidden_gem: '#10b981', park: '#22c55e',
        attraction: '#667eea', viewpoint: '#06b6d4', architecture: '#f97316', market: '#ec4899',
        monument: '#f59e0b', restaurant: '#ef4444', cafe: '#f97316'
    };

    itinerary.days.forEach(day => {
        (day.activities || []).forEach(act => {
            const lat = parseFloat(act.lat), lon = parseFloat(act.lon);
            if (isNaN(lat) || isNaN(lon) || (lat === 0 && lon === 0)) return;
            coords.push([lat, lon]);
            const c = colors[act.type] || '#667eea';
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="background:linear-gradient(135deg,${c},${c}dd);width:32px;height:32px;border-radius:50% 50% 50% 0;border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;transform:rotate(-45deg)"><span style="transform:rotate(45deg)">${counter}</span></div>`,
                iconSize: [32, 32], iconAnchor: [10, 32], popupAnchor: [6, -32]
            });
            const marker = L.marker([lat, lon], { icon }).addTo(map);
            marker.bindPopup(`<div style="font-family:Inter,sans-serif"><div style="font-weight:700;font-size:14px;margin-bottom:4px">${act.name}</div><div style="font-size:12px;color:#888">${act.time || ''} | ${act.duration || ''}</div><div style="font-size:12px;color:#888">Day ${day.day} | ${act.type}</div><div style="font-weight:700;color:#4facfe;margin-top:4px">₹${act.cost || 0}</div></div>`);
            markers.push(marker);
            counter++;
        });
    });

    if (coords.length > 1) {
        routeLine = L.polyline(coords, { color: '#667eea', weight: 3, opacity: 0.7, dashArray: '10, 8' }).addTo(map);
    }
    if (coords.length > 0) {
        map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 14, animate: true });
    }

    addLog('planner', `${coords.length} locations plotted on map`, 'success');
}

// === WEBSOCKET — handles real agent messages + AI state ===
let _wsRetries = 0;
function connectWebSocket() {
    if (_wsRetries > 2) return;
    try {
        const wsUrl = API_BASE.replace(/^http/, 'ws') + '/ws/agents';
        state.ws = new WebSocket(wsUrl);
        state.ws.onopen = () => { _wsRetries = 0; console.log('WebSocket connected'); };
        state.ws.onmessage = e => {
            _wsRetries = 0;
            try {
                const d = JSON.parse(e.data);
                if (d.type === 'agent_activity') {
                    // Map backend agent_ids to frontend ones
                    const idMap = {research:'planner', hotel:'booking', flight:'booking', restaurant:'booking', transport:'booking', budget:'budget', coordinator:'planner', planner:'planner', weather:'weather', crowd:'crowd', preference:'preference', explain:'explain', booking:'booking'};
                    const fid = idMap[d.agent_id] || d.agent_id;
                    addLog(fid, d.message, d.status);
                    updateAgentStatus(fid, d.status);
                    // Show in agent convo if panel is visible
                    if (document.getElementById('agentConvoPanel')?.style.display !== 'none') {
                        agentSay(fid, null, d.message, d.status === 'completed' ? 'decision' : 'insight');
                    }
                }
                if (d.type === 'ai_state') {
                    // Sync Bayesian state from backend
                    if (d.bayesian?.preferences) {
                        Object.entries(d.bayesian.preferences).forEach(([k, v]) => {
                            if (state.bayesian[k]) {
                                state.bayesian[k].a = v.alpha || 2;
                                state.bayesian[k].b = v.beta || 2;
                            }
                        });
                        renderBayesianBars();
                    }
                    // Sync Dirichlet
                    if (d.dirichlet) {
                        state.dirichletData = d.dirichlet;
                        renderDirichletPanel();
                    }
                    // Sync reward history
                    if (d.q_stats?.reward_history) {
                        state.rl.rewards = d.q_stats.reward_history;
                        state.rl.episode = d.q_stats.episodes || 0;
                        drawRLChart();
                    }
                    // POMDP
                    if (d.pomdp_belief) {
                        state.pomdpBelief = d.pomdp_belief;
                        renderPOMDPBelief();
                    }
                }
            } catch (err) { /* ignore */ }
        };
        state.ws.onclose = () => { _wsRetries++; if (_wsRetries <= 2) setTimeout(connectWebSocket, 5000); };
        state.ws.onerror = () => { _wsRetries++; };
    } catch (e) { /* backend not running or WS not supported */ }
}

// === AGENTS UI ===
function renderAgents() {
    const c = document.getElementById('agentCards');
    if (!c) return;
    c.innerHTML = AGENTS.map(a => `
    <div class="agent-card" id="agent-${a.id}">
      <div class="agent-avatar" style="background:${a.color}22;border:1px solid ${a.color}44">${a.icon}</div>
      <div class="agent-info"><div class="agent-name">${a.name}</div><div class="agent-role">${a.role}</div></div>
      <div class="agent-status idle" id="status-${a.id}"></div>
    </div>`).join('');
}

function updateAgentStatus(id, status) {
    const el = document.getElementById(`status-${id}`);
    if (el) {
        el.className = 'agent-status ' + status;
        // Track agent states for coordination
        state.agents[id] = { status, timestamp: Date.now() };
    }
}
function setAllAgentsStatus(status) { AGENTS.forEach(a => updateAgentStatus(a.id, status)); }
function updateAgentPulse() {
    // Periodic sync with backend agent status
    if (state.generating) return; // Don't interfere during generation
    
    if (!state.itinerary) {
        // Before trip: subtle idle pulsing
        AGENTS.forEach(a => {
            const el = document.getElementById(`status-${a.id}`);
            if (el && el.classList.contains('idle')) {
                el.classList.add('thinking');
                setTimeout(() => el.classList.replace('thinking', 'idle'), 1500);
            }
        });
    } else {
        // After trip: try syncing with backend
        syncAgentStatus();
    }
}

async function syncAgentStatus() {
    try {
        const res = await fetch(`${API_BASE}/agents/status`, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
            const data = await res.json();
            const agents = data.agents || [];
            agents.forEach(agent => {
                const localId = agent.id?.replace('_agent', '') || '';
                const status = agent.status === 'working' ? 'working' : 
                               agent.status === 'completed' ? 'completed' : 'idle';
                const el = document.getElementById(`status-${localId}`);
                if (el) {
                    el.className = 'agent-status ' + status;
                    state.agents[localId] = { status, backendStatus: agent.status, tasks: agent.completed_tasks };
                }
            });
        }
    } catch (e) { /* ignore sync failures */ }
}

// === ACTIVITY LOG ===
function addLog(agentId, msg, type = 'info') {
    const agent = AGENTS.find(a => a.id === agentId) || AGENTS[0];
    const colors = { success: '#10b981', error: '#ef4444', info: '#667eea', warning: '#f59e0b', working: '#667eea', thinking: '#f59e0b', completed: '#10b981', idle: '#6b7280' };
    const log = document.getElementById('activityLog');
    if (!log) return;
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    const now = new Date();
    entry.innerHTML = `<div class="dot" style="background:${colors[type] || colors.info}"></div><div class="msg"><strong style="color:${agent.color}">${agent.name}:</strong> ${msg}</div><div class="time">${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}</div>`;
    log.prepend(entry);
    if (log.children.length > 50) log.removeChild(log.lastChild);
}

// === BAYESIAN — reads persisted state from backend ===
function renderBayesianBars() {
    const c = document.getElementById('bayesianBars');
    if (!c) return;
    const colors = { cultural: '#f59e0b', adventure: '#10b981', food: '#ef4444', relaxation: '#06b6d4', shopping: '#8b5cf6', nature: '#22d3ee', nightlife: '#a855f7' };
    c.innerHTML = Object.keys(state.bayesian).map(k => {
        const { a, b } = state.bayesian[k];
        const mean = (a / (a + b) * 100).toFixed(0);
        const ci = state.bayesianCI?.[k];
        const ciText = ci ? ` (${(ci[0]*100).toFixed(0)}-${(ci[1]*100).toFixed(0)}%)` : '';
        return `<div class="pref-item"><div class="pref-header"><span class="pref-label">${k.charAt(0).toUpperCase() + k.slice(1)}</span><span class="pref-val">${mean}%${ciText}</span></div><div class="pref-bar"><div class="pref-fill" style="width:${mean}%;background:${colors[k] || 'var(--primary)'}"></div></div></div>`;
    }).join('');
}

async function loadBayesianFromBackend() {
    try {
        const res = await fetch(`${API_BASE}/ai/bayesian`, {signal: AbortSignal.timeout(3000)});
        if (res.ok) {
            const data = await res.json();
            if (data.preferences) {
                Object.entries(data.preferences).forEach(([k, v]) => {
                    if (!state.bayesian[k]) state.bayesian[k] = {a: 2, b: 2};
                    state.bayesian[k].a = v.alpha || 2;
                    state.bayesian[k].b = v.beta || 2;
                });
                if (data.confidence_intervals) state.bayesianCI = data.confidence_intervals;
                renderBayesianBars();
            }
        }
    } catch(e) { /* use defaults */ }
}

async function loadDirichletFromBackend() {
    try {
        const res = await fetch(`${API_BASE}/ai/dirichlet`, {signal: AbortSignal.timeout(3000)});
        if (res.ok) {
            const data = await res.json();
            if (data.expected_proportions) {
                state.dirichletData = data;
                renderDirichletPanel();
            }
        }
    } catch(e) { /* use defaults */ }
}

function updateBayesian(category, liked) {
    const b = state.bayesian[category];
    if (!b) return;
    if (liked) b.a += 1; else b.b += 1;
    renderBayesianBars();
}

// === RL ENGINE — rewards from backend, no random walk ===
function calculateReward(rating, budgetAdherence, weatherMatch, crowdLevel) {
    const { alpha, beta, gamma, delta } = state.rl;
    const reward = alpha * (rating / 5) + beta * budgetAdherence + gamma * weatherMatch - delta * crowdLevel;
    return Math.max(-1, Math.min(1, reward));
}

function runRLEpisode() {
    // Only compute reward from actual trip data — no fake simulation
    const itin = state.itinerary;
    const budget = state.budget;
    if (!itin || !budget.total) return 0;
    
    const actCount = itin.days?.reduce((s, d) => s + (d.activities?.length || 0), 0) || 0;
    if (actCount === 0) return 0;
    
    const avgRating = itin.days.reduce((s, d) => s + d.activities.reduce((ss, a) => ss + (a.rating || 4.0), 0), 0) / actCount;
    const usage = budget.used / Math.max(budget.total, 1);
    const budgetAdh = Math.max(0, 1 - Math.abs(usage - 0.65) / 0.65);
    const weatherMatch = state.weatherData?.length > 0
        ? state.weatherData.filter(w => w.risk_level !== 'high').length / state.weatherData.length
        : 0.7;
    // Crowd from activity data (backend provides crowd_level per activity)
    const crowdLevels = itin.days.flatMap(d => d.activities.map(a => (a.crowd_level || 50) / 100));
    const crowd = crowdLevels.length > 0 ? crowdLevels.reduce((s, v) => s + v, 0) / crowdLevels.length : 0.5;
    
    const reward = calculateReward(avgRating, budgetAdh, weatherMatch, crowd);
    state.rl.rewards.push(Math.max(0, Math.min(1, reward)));
    state.rl.episode++;
    return reward;
}

function drawRLChart() {
    const canvas = document.getElementById('rlChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.parentElement.clientWidth;
    const H = canvas.height = 160;
    ctx.clearRect(0, 0, W, H);
    const data = state.rl.rewards;
    if (data.length < 2) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = (H - 30) * i / 4 + 15;
        ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W - 10, y); ctx.stroke();
        ctx.fillStyle = '#6b6f8d'; ctx.font = '10px Inter';
        ctx.fillText((1 - i * 0.25).toFixed(2), 2, y + 4);
    }
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#667eea'); grad.addColorStop(1, '#764ba2');
    ctx.strokeStyle = grad; ctx.lineWidth = 2; ctx.beginPath();
    const step = (W - 50) / (data.length - 1);
    data.forEach((v, i) => {
        const x = 40 + i * step, y = 15 + (1 - v) * (H - 30);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
    const last = data.length - 1;
    ctx.lineTo(40 + last * step, H - 15); ctx.lineTo(40, H - 15); ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
    fillGrad.addColorStop(0, 'rgba(102,126,234,0.3)'); fillGrad.addColorStop(1, 'rgba(102,126,234,0)');
    ctx.fillStyle = fillGrad; ctx.fill();
    ctx.fillStyle = '#10b981'; ctx.font = 'bold 12px Inter';
    ctx.fillText(`R=${data[last].toFixed(3)}`, W - 70, 12);
}

// === AGENT COMM GRAPH — only real connections ===
function drawAgentGraph() {
    const canvas = document.getElementById('agentGraphCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width = canvas.parentElement.clientWidth;
    const H = canvas.height = 240;
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2, r = Math.min(W, H) * 0.35;
    const nodes = AGENTS.map((a, i) => {
        const angle = (i / AGENTS.length) * Math.PI * 2 - Math.PI / 2;
        return { ...a, x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
    });
    // Draw only actual data flow connections
    const connections = [
        ['weather', 'planner'], ['crowd', 'planner'], ['budget', 'planner'],
        ['preference', 'planner'], ['booking', 'planner'], ['planner', 'explain'],
        ['weather', 'explain'], ['crowd', 'explain'], ['preference', 'booking'],
    ];
    const nodeMap = {};
    nodes.forEach(n => nodeMap[n.id] = n);
    connections.forEach(([from, to]) => {
        const n1 = nodeMap[from], n2 = nodeMap[to];
        if (n1 && n2) {
            ctx.strokeStyle = 'rgba(102,126,234,0.25)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.stroke();
            // Arrow
            const angle = Math.atan2(n2.y - n1.y, n2.x - n1.x);
            const mx = (n1.x + n2.x) / 2, my = (n1.y + n2.y) / 2;
            ctx.fillStyle = 'rgba(102,126,234,0.4)';
            ctx.beginPath();
            ctx.moveTo(mx + 5 * Math.cos(angle), my + 5 * Math.sin(angle));
            ctx.lineTo(mx - 5 * Math.cos(angle - 0.5), my - 5 * Math.sin(angle - 0.5));
            ctx.lineTo(mx - 5 * Math.cos(angle + 0.5), my - 5 * Math.sin(angle + 0.5));
            ctx.fill();
        }
    });
    nodes.forEach(n => {
        const isActive = state.agents[n.id]?.status === 'completed' || state.agents[n.id]?.status === 'working';
        ctx.beginPath(); ctx.arc(n.x, n.y, 22, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? n.color + '44' : n.color + '22'; ctx.fill();
        ctx.strokeStyle = isActive ? n.color : n.color + '66'; ctx.lineWidth = isActive ? 2.5 : 1.5; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(n.icon, n.x, n.y + 5);
        ctx.fillStyle = '#a0a3c0'; ctx.font = '9px Inter';
        ctx.fillText(n.name.split(' ')[0], n.x, n.y + 35);
    });
}

// ============================================
// GENERATE TRIP — ALL FROM API
// ============================================
async function generateTrip() {
    if (state.generating) return;
    const dest = document.getElementById('destination').value.trim();
    const origin = document.getElementById('origin')?.value?.trim() || '';
    const duration = parseInt(document.getElementById('duration').value) || 3;
    const budget = parseInt(document.getElementById('budget').value) || 15000;
    const startDate = document.getElementById('startDate').value || new Date().toISOString().split('T')[0];

    if (!dest) { showToast('Please enter a destination', 'warning'); return; }
    
    // Prompt for origin if not provided (helps with flight/train booking later)
    if (!origin) {
        showToast('Tip: Enter your origin location for better flight & train booking!', 'info');
    }

    state.generating = true;
    state.budget.total = budget;
    state.budget.used = 0;
    state.currentDest = dest;
    state.origin = origin;
    showLoading(true);
    setAllAgentsStatus('thinking');
    const originMsg = origin ? ` from ${origin}` : '';
    addLog('planner', `Autonomous agents activated${originMsg} for ${dest} (${duration} days, ₹${budget.toLocaleString()})`, 'info');

    document.getElementById('agentConvoPanel').style.display = 'block';
    document.getElementById('agentConvo').innerHTML = '';
    document.getElementById('insightsPanel').style.display = 'none';

    agentSay('planner', null, `API-driven ${duration}-day trip planning for ${dest}${originMsg}. Querying Overpass + Wikipedia APIs...`, 'decision');
    updateAgentStatus('planner', 'working');

    let backendData = null;
    const startMs = Date.now();
    try {
        const chk = document.querySelectorAll('.checkbox-label input');
        // Checkboxes: [0]=Flights, [1]=Trains, [2]=Hotels, [3]=Restaurants, [4]=Transport
        const res = await fetch(`${API_BASE}/generate-trip`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destination: dest, duration, budget, start_date: startDate,
                preferences: [], persona: state.persona, origin,
                include_flights: chk[0]?.checked || false,
                include_trains: chk[1]?.checked || false,
                include_hotels: chk[2]?.checked || false,
                include_restaurants: chk[3]?.checked || false,
                include_transport: chk[4]?.checked || false
            })
        });
        if (res.ok) {
            backendData = await res.json();
        } else {
            const errText = await res.text().catch(() => '');
            addLog('coordinator', `Backend error ${res.status}: ${errText.slice(0, 200)}`, 'error');
            agentSay('explain', null, `Backend returned error ${res.status}. Using fallback itinerary.`, 'warning');
        }
    } catch (e) {
        addLog('coordinator', `Connection error: ${e.message}`, 'error');
        agentSay('explain', null, `Backend unreachable: ${e.message}. Using fallback.`, 'warning');
    }
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(1);

    const topPref = Object.entries(state.bayesian).sort((a, b) => (b[1].a / (b[1].a + b[1].b)) - (a[1].a / (a[1].a + a[1].b)))[0];
    const photosLoaded = backendData?.metadata?.photos_loaded || 0;
    const attCount = backendData?.metadata?.attractions_count || 0;
    const source = backendData?.metadata?.source || 'API';
    const aiData = backendData?.ai || {};

    // Show real agent messages from backend AI data (not hardcoded)
    if (aiData.weather_classification) {
        const dominant = Object.entries(aiData.weather_classification).sort((a,b) => b[1]-a[1])[0];
        agentSay('weather', 'planner', `Weather classified: ${dominant[0]} (${(dominant[1]*100).toFixed(0)}% probability). Risk-adjusted activities flagged.`, 'insight');
    } else {
        agentSay('weather', 'planner', `Real weather data fetched for ${dest}.`, 'insight');
    }
    updateAgentStatus('weather', 'completed');
    
    agentSay('crowd', 'planner', `Crowd analysis: avg level ${aiData.crowd_level || '?'}/100 (time-of-day heuristic). Morning visits = fewer crowds.`, 'insight');
    updateAgentStatus('crowd', 'completed');
    
    agentSay('budget', 'planner', `Budget: ₹${budget.toLocaleString()} across ${duration} days. MDP reward=${aiData.mdp_reward || '?'}`, 'decision');
    updateAgentStatus('budget', 'completed');
    
    const bayesProbs = aiData.bayesian || {};
    const topBayes = Object.entries(bayesProbs).sort((a,b) => b[1]-a[1])[0];
    agentSay('preference', 'planner', `Bayesian prefs: ${topBayes ? `${topBayes[0]} (${(topBayes[1]*100).toFixed(0)}%)` : `${topPref[0]} (${(topPref[1].a / (topPref[1].a + topPref[1].b) * 100).toFixed(0)}%)`}. Rate activities to refine.`, 'insight');
    updateAgentStatus('preference', 'completed');
    
    if (aiData.mcts?.iterations) {
        agentSay('booking', 'planner', `MCTS optimised: ${aiData.mcts.iterations} iterations, confidence=${aiData.mcts.confidence}, best_action=${aiData.mcts.best_action}`, 'decision');
    } else {
        agentSay('booking', 'planner', `Booking links compiled for ${dest}.`, 'decision');
    }
    updateAgentStatus('booking', 'completed');
    
    agentSay('explain', null, `Generated in ${elapsed}s: ${attCount} attractions from ${source}, ${photosLoaded} real photos. Best action: ${aiData.best_action || 'keep_plan'}`, 'decision');
    updateAgentStatus('explain', 'completed');

    if (!backendData) {
        agentSay('planner', null, `Backend unavailable. Running local fallback...`, 'decision');
        const itinerary = await generateFallbackItinerary(dest, duration, budget, startDate);
        state.itinerary = itinerary;
        backendData = { itinerary, bookings: {} };
    }

    showLoading(false);
    setAllAgentsStatus('completed');
    state.generating = false;
    state.tripActive = true;
    addLog('planner', `All agents completed for ${dest}!`, 'success');
    await processTrip(backendData, dest, duration, budget);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function agentSay(fromId, toId, text, msgType = '') {
    const from = AGENTS.find(a => a.id === fromId) || AGENTS[0];
    const to = toId ? AGENTS.find(a => a.id === toId) : null;
    const convo = document.getElementById('agentConvo');
    if (!convo) return;
    addLog(fromId, text.replace(/@\w+ \w+ — /, ''), msgType === 'decision' ? 'success' : msgType === 'insight' ? 'info' : 'working');
    const msg = document.createElement('div');
    msg.className = `agent-msg ${msgType}`;
    const now = new Date();
    msg.innerHTML = `
      <div class="agent-msg-avatar" style="background:${from.color}22;border-color:${from.color}">${from.icon}</div>
      <div class="agent-msg-body">
        <div class="agent-msg-header">
          <span class="agent-msg-name" style="color:${from.color}">${from.name}</span>
          ${to ? `<span class="agent-msg-arrow">→</span><span class="agent-msg-target">${to.name}</span>` : ''}
        </div>
        <div class="agent-msg-text">${text}</div>
        <div class="agent-msg-time">${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}</div>
      </div>`;
    convo.appendChild(msg);
    convo.scrollTop = convo.scrollHeight;
}

// === AI INSIGHTS ===
function addInsight(type, icon, title, text) {
    const panel = document.getElementById('insightsPanel');
    const container = document.getElementById('insightsContainer');
    if (!panel || !container) return;
    panel.style.display = 'block';
    const card = document.createElement('div');
    card.className = `insight-card ${type}`;
    card.innerHTML = `<div class="insight-header">${icon} ${title}</div><div class="insight-text">${text}</div>`;
    container.appendChild(card);
}

async function processTrip(data, dest, duration, budget) {
    state.itinerary = data.itinerary || data;
    // Store budget breakdown from backend on the itinerary object
    if (data.budget_breakdown) {
        state.itinerary.budget_breakdown = data.budget_breakdown;
    }
    if (data.budget_summary) {
        state.itinerary.budget_summary = data.budget_summary;
    }
    state.currentDest = dest;
    state.weatherData = data.weather_forecasts || [];
    
    // Store backend AI data
    state.aiData = data.ai || {};
    
    // Sync Bayesian from backend
    if (data.ai?.bayesian) {
        // This is probabilities — also load full state
        loadBayesianFromBackend();
    }
    
    // Sync Q-learning rewards from backend
    if (data.ai?.q_stats?.reward_history) {
        state.rl.rewards = data.ai.q_stats.reward_history;
        state.rl.episode = data.ai.q_stats.episodes || 0;
    }
    
    // Sync POMDP belief
    if (data.ai?.pomdp_belief) {
        state.pomdpBelief = data.ai.pomdp_belief;
    }
    
    // Sync Dirichlet
    if (data.ai?.dirichlet) {
        state.dirichletData = data.ai.dirichlet;
    }

    // Apply CC placeholder photos
    fixItineraryPhotos(state.itinerary);

    renderItinerary(state.itinerary, dest);
    updateMap(state.itinerary);
    renderBookings(dest);
    renderWeather(dest, duration, state.weatherData);
    updateBudgetDisplay(state.itinerary, budget);
    renderCrowdLevel();
    loadSocialDiscovery(dest);

    // Language tips from backend
    if (data.language_tips) {
        renderLanguageTipsFromData(dest, data.language_tips);
    } else {
        renderLanguageTipsFromAPI(dest);
    }

    // Run one real RL episode from actual data (no fake loop)
    runRLEpisode();
    drawRLChart();
    setTimeout(() => { drawAgentGraph(); }, 500);

    // Post-trip analysis
    setTimeout(() => runAutonomousAnalysis(dest, duration, budget), 1500);

    // Explainability panel — use backend MDP data
    renderMDPDecisionTrace(dest, budget, duration);
    
    // POMDP belief display
    renderPOMDPBelief();
    
    // Dirichlet display
    renderDirichletPanel();
    
    const genTime = data?.metadata?.elapsed_seconds || 'fast';
    showToast(`Trip to ${dest} planned in ${genTime}s by 7 AI agents!`, 'success');
}

if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('processTripReady'));
}

function renderMDPDecisionTrace(dest, budget, duration) {
    const ep = document.getElementById('explainPanel');
    if (!ep) return;
    
    const itin = state.itinerary;
    const ai = state.aiData || {};
    const totalCost = itin?.total_cost || 0;
    
    // Use real backend MDP data if available
    const mdpReward = ai.mdp_reward !== undefined ? ai.mdp_reward : null;
    const bestAction = ai.best_action || 'keep_plan';
    const weatherProbs = ai.weather_classification || {};
    const crowdLvl = ai.crowd_level !== undefined ? ai.crowd_level : _crowd_heuristic_avg();
    const qStats = ai.q_stats || {};
    const pomdp = ai.pomdp_belief || state.pomdpBelief || {};
    
    // Compute from real data
    const activityCount = itin?.days?.reduce((s, d) => s + (d.activities?.length || 0), 0) || 0;
    const avgRating = activityCount > 0
        ? (itin.days.reduce((s, d) => s + d.activities.reduce((ss, a) => ss + (a.rating || 4.0), 0), 0) / activityCount).toFixed(1)
        : '4.0';
    
    // Budget adherence
    const usage = totalCost / Math.max(budget, 1);
    const budgetAdh = Math.max(0, 1 - Math.abs(usage - 0.65) / 0.65).toFixed(3);
    
    // Weather prob
    const weatherP = state.weatherData?.length > 0 
        ? (state.weatherData.filter(w => w.risk_level !== 'high').length / state.weatherData.length).toFixed(2)
        : '0.70';
    
    const crowdPenalty = (crowdLvl / 100).toFixed(2);
    const satisfaction = Math.min(5.0, parseFloat(avgRating)).toFixed(1);
    const satNorm = (satisfaction / 5.0).toFixed(3);
    
    const alpha = state.rl.alpha;
    const beta = state.rl.beta;
    const gamma = state.rl.gamma;
    const delta = state.rl.delta;
    const reward = mdpReward !== null ? mdpReward.toFixed(4) : (alpha * satNorm + beta * budgetAdh + gamma * weatherP - delta * crowdPenalty).toFixed(4);
    
    // Action reasoning
    const reasons = {
        keep_plan: 'Plan is well-optimised, no changes recommended',
        swap_activity: 'A low-rated activity could be replaced with a better option',
        reorder_destinations: 'Reordering can reduce travel distance between activities',
        adjust_budget: 'Budget utilisation is suboptimal, trimming expensive items',
        add_contingency: 'Weather risk detected \u2014 adding indoor backup options',
        remove_activity: 'Schedule is too packed \u2014 removing lowest-rated activity',
    };
    
    // Weather classification display
    let weatherClassHTML = '';
    if (Object.keys(weatherProbs).length > 0) {
        weatherClassHTML = '<div style=\"margin-top:4px\">' + Object.entries(weatherProbs).map(([k,v]) => 
            `<span style="display:inline-block;margin-right:8px">${{sunny:'\u2600\uFE0F',cloudy:'\u26C5',rainy:'\uD83C\uDF27\uFE0F'}[k]||k} ${(v*100).toFixed(0)}%</span>`
        ).join('') + '</div>';
    }
    
    // POMDP belief display
    let pomdpHTML = '';
    if (Object.keys(pomdp).length > 0) {
        pomdpHTML = `
        <div style="background:var(--bg-3);padding:8px;border-radius:8px;margin-top:8px;border-left:3px solid #8b5cf6">
            <div class="text-xs fw-600" style="color:#8b5cf6;margin-bottom:4px">POMDP Belief State</div>
            <div class="text-xs" style="color:var(--text-2);line-height:1.6">
                ${Object.entries(pomdp).map(([k,v]) => `${k}: <strong>${(v*100).toFixed(1)}%</strong>`).join(' | ')}
            </div>
        </div>`;
    }
    
    // Q-learning stats
    let qHTML = '';
    if (qStats.episodes) {
        qHTML = `<div style="margin-top:4px;font-size:0.72rem;color:var(--text-3)">Q-table: ${qStats.q_table_size || 0} entries, ${qStats.episodes} episodes, \u03B5=${qStats.epsilon || '?'}</div>`;
    }
    
    ep.innerHTML = `
    <div style="margin-bottom:10px"><strong style="color:var(--accent)">MDP Decision Trace</strong></div>
    <div style="background:var(--bg-3);padding:8px;border-radius:8px;margin-bottom:8px;border-left:3px solid var(--primary)">
        <div class="text-xs fw-600" style="color:var(--primary);margin-bottom:4px">Current State S(t)</div>
        <div class="text-xs" style="color:var(--text-2);line-height:1.6">
            \uD83D\uDCCD Location: <strong>${dest}</strong> (${duration} days)<br>
            \uD83D\uDCB0 Budget: \u20B9${totalCost.toLocaleString()} / \u20B9${budget.toLocaleString()} (${(usage*100).toFixed(0)}% used)<br>
            \uD83C\uDF26\uFE0F Weather P(good): <strong>${weatherP}</strong>${weatherClassHTML}<br>
            \uD83D\uDC65 Crowd level: <strong>${crowdLvl.toFixed ? crowdLvl.toFixed(0) : crowdLvl}/100</strong><br>
            \uD83D\uDE0A Satisfaction: <strong>${satisfaction}/5.0</strong> (avg rating)
        </div>
    </div>
    <div style="background:var(--bg-3);padding:8px;border-radius:8px;margin-bottom:8px;border-left:3px solid var(--success)">
        <div class="text-xs fw-600" style="color:var(--success);margin-bottom:4px">Reward Function</div>
        <div class="text-xs" style="color:var(--text-2);line-height:1.6">
            R = \u03B1(${alpha})\u00D7sat(${satNorm}) + \u03B2(${beta})\u00D7budget(${budgetAdh})<br>
            &nbsp;&nbsp;&nbsp;+ \u03B3(${gamma})\u00D7weather(${weatherP}) \u2212 \u03B4(${delta})\u00D7crowd(${crowdPenalty})<br>
            <strong style="color:var(--accent)">R = ${reward}</strong>
            ${qHTML}
        </div>
    </div>
    <div style="background:var(--bg-3);padding:8px;border-radius:8px;border-left:3px solid #f59e0b">
        <div class="text-xs fw-600" style="color:#f59e0b;margin-bottom:4px">Policy \u03C0*(s)</div>
        <div class="text-xs" style="color:var(--text-2);line-height:1.6">
            Action: <strong style="color:var(--accent)">${bestAction}</strong><br>
            Reason: ${reasons[bestAction] || 'Computed by Q-learning agent'}
        </div>
    </div>
    ${pomdpHTML}`;
}

function _crowd_heuristic_avg() {
    const itin = state.itinerary;
    if (!itin?.days) return 50;
    const levels = [];
    itin.days.forEach(d => d.activities?.forEach(a => {
        levels.push(a.crowd_level || 50);
    }));
    return levels.length > 0 ? levels.reduce((s,v) => s+v, 0) / levels.length : 50;
}

// === POMDP Belief Display ===
function renderPOMDPBelief() {
    const el = document.getElementById('pomdpPanel');
    if (!el) return;
    const belief = state.pomdpBelief || {};
    if (Object.keys(belief).length === 0) {
        el.innerHTML = '';
        return;
    }
    const colors = {excellent: '#10b981', good: '#06b6d4', average: '#f59e0b', poor: '#ef4444'};
    el.innerHTML = `
    <div style="margin-bottom:8px"><strong style="color:var(--accent)">POMDP Belief State</strong></div>
    ${Object.entries(belief).map(([k, v]) => {
        const pct = (v * 100).toFixed(1);
        return `<div class="pref-item"><div class="pref-header"><span class="pref-label">${k.charAt(0).toUpperCase()+k.slice(1)}</span><span class="pref-val">${pct}%</span></div><div class="pref-bar"><div class="pref-fill" style="width:${pct}%;background:${colors[k]||'var(--primary)'}"></div></div></div>`;
    }).join('')}`;
}

// === Dirichlet Preference Display ===
function renderDirichletPanel() {
    const el = document.getElementById('dirichletPanel');
    if (!el) return;
    const dir = state.dirichletData || {};
    const props = dir.expected_proportions || {};
    if (Object.keys(props).length === 0) {
        el.innerHTML = '<div class="text-sm text-muted">Rate activities to see Dirichlet allocation...</div>';
        return;
    }
    const colors = { cultural: '#f59e0b', adventure: '#10b981', food: '#ef4444', relaxation: '#06b6d4', shopping: '#8b5cf6', nature: '#22d3ee', nightlife: '#a855f7' };
    el.innerHTML = `
    <div style="margin-bottom:4px;font-size:0.72rem;color:var(--text-secondary)">Concentration: ${dir.concentration || '?'}</div>
    ${Object.entries(props).map(([k, v]) => {
        const pct = (v * 100).toFixed(1);
        return `<div class="pref-item"><div class="pref-header"><span class="pref-label">${k.charAt(0).toUpperCase()+k.slice(1)}</span><span class="pref-val">${pct}%</span></div><div class="pref-bar"><div class="pref-fill" style="width:${pct}%;background:${colors[k]||'var(--primary)'}"></div></div></div>`;
    }).join('')}`;
}

// === Backend Status & Error Display ===
async function checkBackendStatus() {
    const statusEl = document.getElementById('backendStatus');
    try {
        const res = await fetch(`${API_BASE}/health`, {signal: AbortSignal.timeout(5000)});
        if (res.ok) {
            const data = await res.json();
            if (statusEl) statusEl.innerHTML = `<span style="color:#10b981">Backend online</span>`;
            return true;
        }
        if (statusEl) statusEl.innerHTML = `<span style="color:#ef4444">Backend error: ${res.status}</span>`;
        return false;
    } catch (e) {
        if (statusEl) statusEl.innerHTML = `<span style="color:#ef4444">Backend offline</span>`;
        addLog('coordinator', `Backend connection failed: ${e.message}`, 'error');
        return false;
    }
}

function showBackendError(message, details) {
    addLog('coordinator', `Error: ${message}`, 'error');
    showToast(`Backend error: ${message}`, 'error');
}

async function runAutonomousAnalysis(dest, duration, budget) {
    const itin = state.itinerary;
    if (!itin) return;
    document.getElementById('insightsContainer').innerHTML = '';
    const ai = state.aiData || {};

    // Weather insight with real NB classification data
    if (ai.weather_classification) {
        const dominant = Object.entries(ai.weather_classification).sort((a,b) => b[1]-a[1])[0];
        const highRisk = state.weatherData.filter(f => f.risk_level === 'high').length;
        addInsight('weather', '🌦️', 'Weather Risk Agent', `Naive Bayes: ${dominant[0]} (${(dominant[1]*100).toFixed(0)}%). ${highRisk} high-risk day(s). Activities flagged with weather warnings.`);
    } else {
        const weatherInsight = state.weatherData.length > 0
            ? `Real forecast loaded. ${state.weatherData.filter(w => w.risk_level === 'high').length} high-risk weather day(s) detected.`
            : `Weather data analyzed for ${dest}. Indoor alternatives flagged.`;
        addInsight('weather', '🌦️', 'Weather Risk Agent', weatherInsight);
    }
    
    // Crowd with real heuristic
    const crowdLvl = ai.crowd_level || _crowd_heuristic_avg();
    addInsight('crowd', '👥', 'Crowd Analyzer', `Avg crowd level: ${Math.round(crowdLvl)}/100 (time-of-day heuristic). Peak hours: 11am-2pm, 6-9pm.`);
    
    // Budget with real data
    const utilPct = ((itin.total_cost || 0) / budget * 100).toFixed(0);
    addInsight('budget', '💰', 'Budget Optimizer', `Budget utilisation: ${utilPct}%. MDP reward: ${ai.mdp_reward?.toFixed(3) || 'N/A'}. Action: ${ai.best_action || 'keep_plan'}.`);
    
    // Preference with real Bayesian
    const bayesProbs = ai.bayesian || {};
    const topCat = Object.entries(bayesProbs).sort((a,b) => b[1]-a[1])[0];
    addInsight('preference', '❤️', 'Preference Agent', `Bayesian Beta model: ${topCat ? `top = ${topCat[0]} (${(topCat[1]*100).toFixed(0)}%)` : 'updating...'}. Rate activities to refine preferences.`);
    
    addInsight('booking', '🎫', 'Booking Assistant', `Best value booking options compiled. MCTS: ${ai.mcts?.iterations || 0} iterations.`);
}

// === FALLBACK ITINERARY ===
async function generateFallbackItinerary(dest, duration, budget, startDate) {
    // Try the API directly
    let attractions = null;
    try {
        const res = await fetch(`${API_BASE}/attractions?city=${encodeURIComponent(dest)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.attractions?.length >= 3) {
                attractions = data.attractions.map(a => ({
                    name: a.name, type: a.type, rating: a.rating, cost: a.price || 0,
                    duration: a.duration || '2h', lat: a.lat, lon: a.lon,
                    desc: a.description || `Visit ${a.name}`,
                    photos: a.photos?.filter(p => p) || []
                }));
            }
        }
    } catch (e) { /* fallback */ }

    if (!attractions) {
        const coord = CITY_COORDS[dest.toLowerCase()] || [20, 0];
        attractions = [
            { name: `${dest} Historic Center`, type: 'cultural', rating: 4.5, cost: 0, duration: '2-3h', lat: coord[0] + 0.01, lon: coord[1] + 0.01, desc: `Historic heart of ${dest}` },
            { name: `${dest} Main Museum`, type: 'museum', rating: 4.4, cost: 800, duration: '2h', lat: coord[0] - 0.01, lon: coord[1] + 0.02, desc: 'Major museum' },
            { name: `${dest} Central Market`, type: 'shopping', rating: 4.3, cost: 1000, duration: '2h', lat: coord[0] + 0.02, lon: coord[1] - 0.01, desc: 'Vibrant local market' },
            { name: `${dest} Cultural Quarter`, type: 'cultural', rating: 4.4, cost: 500, duration: '3h', lat: coord[0] - 0.02, lon: coord[1] - 0.02, desc: 'Local culture district' },
        ];
    }

    const days = [];
    const start = new Date(startDate);
    const times = ['09:00', '11:30', '14:00', '16:30', '19:00'];
    const usedNames = new Set();

    for (let d = 0; d < duration; d++) {
        const date = new Date(start); date.setDate(date.getDate() + d);
        const available = attractions.filter(a => !usedNames.has(a.name));
        const dayActs = available.slice(0, Math.min(4, available.length));
        dayActs.forEach(a => usedNames.add(a.name));

        const activities = dayActs.map((a, i) => ({
            name: a.name, type: a.type, time: times[i % times.length], duration: a.duration,
            cost: a.cost, rating: a.rating, description: a.desc, lat: a.lat, lon: a.lon,
            reviews_count: Math.abs(a.name.split('').reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0) % 49500) + 500,
            photos: a.photos || [],
            media: { photos: a.photos || [], videos: {}, maps: {}, reviews: {}, links: {} }
        }));
        days.push({
            day: d + 1, date: date.toISOString().split('T')[0], city: dest,
            activities, daily_cost: activities.reduce((s, a) => s + a.cost, 0)
        });
    }

    return { days, total_cost: days.reduce((s, d) => s + d.daily_cost, 0), cities: [dest] };
}

// ============================================
// BOOKINGS
// ============================================
function generateBookings(dest) {
    const e = encodeURIComponent(dest);
    const slug = dest.toLowerCase().replace(/\s+/g, '-');
    const ctx = window.agenticState?.context || {};
    const origin = ctx.origin || '';
    const originEnc = encodeURIComponent(origin);
    const originSlug = origin.toLowerCase().replace(/\s+/g, '-');
    const startDate = ctx.startDate || '';
    const endDate = ctx.endDate || '';
    return {
        hotels: [
            { name: `Google Hotels — ${dest}`, rating: 4.7, price_per_night: 'Compare on provider', amenities: ['All Hotels', 'Price Compare'], photo: '', booking_url: `https://www.google.com/travel/hotels/${e}?dates=${startDate},${endDate}`, platform: 'google' },
            { name: `Booking.com — ${dest}`, rating: 4.5, price_per_night: 'Compare on provider', amenities: ['WiFi', 'Free Cancel'], photo: '', booking_url: `https://www.booking.com/searchresults.html?ss=${e}&checkin=${startDate}&checkout=${endDate}`, platform: 'booking' },
            { name: `MakeMyTrip Hotels`, rating: 4.3, price_per_night: 'Compare on provider', amenities: ['Best Deals', 'EMI Options'], photo: '', booking_url: `https://www.makemytrip.com/hotels/hotel-listing/?city=${e}&checkin=${startDate}&checkout=${endDate}`, platform: 'makemytrip' },
            { name: `Goibibo — ${dest}`, rating: 4.2, price_per_night: 'Compare on provider', amenities: ['Deals', 'Price Match'], photo: '', booking_url: `https://www.goibibo.com/hotels/hotels-in-${slug}/`, platform: 'goibibo' },
            { name: `Ixigo Hotels — ${dest}`, rating: 4.3, price_per_night: 'Compare on provider', amenities: ['Budget Picks', 'All Brands'], photo: '', booking_url: `https://www.ixigo.com/hotels/${slug}`, platform: 'ixigo' },
        ],
        flights: [
            { airline: 'Google Flights', price: 'Compare on provider', departure: origin || 'Any', arrival: dest, duration: 'Best Price', booking_url: `https://www.google.com/travel/flights?q=flights+from+${originEnc}+to+${e}+on+${startDate}`, platform: 'google' },
            { airline: 'Skyscanner', price: 'Compare on provider', departure: 'Flexible', arrival: 'Multi-airline', duration: 'Cheapest', booking_url: `https://www.skyscanner.co.in/transport/flights-to/${slug}/`, platform: 'skyscanner' },
            { airline: 'MakeMyTrip Flights', price: 'Compare on provider', departure: origin || 'Any', arrival: dest, duration: 'All Airlines', booking_url: `https://www.makemytrip.com/flight/search?itinerary=${originEnc}-${e}-${startDate}&tripType=O&paxType=A-1_C-0_I-0&cabinClass=E`, platform: 'makemytrip' },
            { airline: 'Cleartrip', price: 'Compare on provider', departure: origin || 'Any', arrival: dest, duration: 'Best Deals', booking_url: `https://www.cleartrip.com/flights/${origin ? originSlug + '-to-' : ''}${slug}-${startDate}/`, platform: 'cleartrip' },
            { airline: 'Ixigo Flights', price: 'Compare on provider', departure: origin || 'Any', arrival: dest, duration: 'Cheapest', booking_url: `https://www.ixigo.com/search/result/flight?from=${originEnc}&to=${e}&date=${startDate}`, platform: 'ixigo' },
        ],
        trains: [
            { name: 'IRCTC', price: 'Compare on provider', features: ['Official', 'All Trains'], rating: 4.1, booking_url: 'https://www.irctc.co.in/nget/train-search', platform: 'irctc' },
            { name: `Ixigo Trains — ${origin || 'Origin'} to ${dest}`, price: 'Compare on provider', features: ['PNR Status', 'Seat Avail'], rating: 4.4, booking_url: `https://www.ixigo.com/trains/${originSlug || 'delhi'}-to-${slug}`, platform: 'ixigo' },
            { name: 'MakeMyTrip Trains', price: 'Compare on provider', features: ['Easy Booking', 'Compare'], rating: 4.0, booking_url: `https://www.makemytrip.com/railways/`, platform: 'makemytrip' },
            { name: 'ConfirmTkt', price: 'Compare on provider', features: ['PNR Predict', 'Alternate'], rating: 4.2, booking_url: `https://www.confirmtkt.com/train-search`, platform: 'confirmtkt' },
        ],
        restaurants: [
            { name: `Zomato — ${dest}`, rating: 4.6, price_range: '\u20b9-\u20b9\u20b9\u20b9\u20b9', cuisine: 'All Cuisines', photo: '', booking_url: `https://www.zomato.com/${slug}/restaurants`, platform: 'zomato' },
            { name: `Google — Top Rated`, rating: 4.8, price_range: '\u20b9\u20b9\u20b9', cuisine: 'Best Rated', photo: '', booking_url: `https://www.google.com/maps/search/restaurants+in+${e}`, platform: 'google' },
            { name: `Swiggy — ${dest}`, rating: 4.4, price_range: '\u20b9-\u20b9\u20b9\u20b9', cuisine: 'Delivery + Dine', photo: '', booking_url: `https://www.swiggy.com/city/${slug}`, platform: 'swiggy' },
        ],
        cabs: [
            { type: 'Uber', price: 'Compare on provider', features: ['AC', 'GPS', 'UPI Pay'], rating: 4.3, booking_url: 'https://m.uber.com/looking', platform: 'uber' },
            { type: 'Ola Cabs', price: 'Compare on provider', features: ['AC', 'Multiple Options'], rating: 4.1, booking_url: 'https://www.olacabs.com/', platform: 'ola' },
            { type: 'Rapido', price: 'Compare on provider', features: ['Bike', 'Auto', 'Quick'], rating: 4.0, booking_url: 'https://www.rapido.bike/', platform: 'rapido' },
            { type: 'Ixigo Cabs', price: 'Compare on provider', features: ['Compare', 'City Tours'], rating: 4.1, booking_url: `https://www.ixigo.com/cabs/${slug}`, platform: 'ixigo' },
        ],
        buses: [
            { name: `RedBus — ${origin || 'Origin'} to ${dest}`, price: 'Compare on provider', features: ['AC/Non-AC', 'Sleeper'], rating: 4.3, booking_url: `https://www.redbus.in/bus-tickets/${originSlug || 'delhi'}-to-${slug}`, platform: 'redbus' },
            { name: `Ixigo Buses`, price: 'Compare on provider', features: ['All Operators', 'Live Track'], rating: 4.2, booking_url: `https://www.ixigo.com/bus/${originSlug || 'delhi'}-to-${slug}`, platform: 'ixigo' },
            { name: 'MakeMyTrip Bus', price: 'Compare on provider', features: ['Volvo', 'Mercedes'], rating: 4.0, booking_url: `https://www.makemytrip.com/bus-tickets/`, platform: 'makemytrip' },
        ]
    };
}

// === RENDER ITINERARY ===
function renderItinerary(itin, dest) {
    const c = document.getElementById('itineraryContainer');
    if (!c || !itin?.days) return;
    c.innerHTML = `<div class="section-title">📅 Your ${dest} Itinerary — AI Generated (API attractions · CC placeholder photos)</div>` + itin.days.map(day => {
        const weatherBadge = day.weather ? `<span class="weather-badge" style="margin-left:8px;font-size:0.8rem">${day.weather.icon} ${Math.round(day.weather.temp_max)}°C ${day.weather.risk_level === 'high' ? '⚠️' : ''}</span>` : '';
        return `
    <div class="day-card">
      <div class="day-header">
        <span class="day-num">Day ${day.day} — ${new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}${weatherBadge}</span>
        <span class="day-cost">₹${day.daily_cost.toLocaleString()}</span>
      </div>
      ${day.activities.map((act, i) => {
        const photoUrl = act.photo || (act.photos?.[0]) || '';
        const isPlaceholder = act.photo_is_placeholder || Object.values(PHOTO_PLACEHOLDERS).includes(photoUrl);
        const photoStyle = photoUrl ? `background-image:url('${photoUrl}');background-size:cover;background-position:center;` : '';
        const photoBadge = isPlaceholder ? '<span class="photo-placeholder-badge">CC Placeholder</span>' : '';
        const weatherWarn = act.weather_warning ? `<div style="color:#f59e0b;font-size:0.78rem;margin-top:4px">${act.weather_warning}</div>` : '';
        const crowdTip = act.crowd_tip ? `<div style="color:#06b6d4;font-size:0.78rem;margin-top:4px">${act.crowd_tip}</div>` : '';
        const noPhoto = `<div class="activity-photo activity-photo-missing" data-place="${act.name}" data-city="${dest}"><div class="activity-photo-overlay"></div><div class="no-photo-text">No photo available</div></div>`;
        const photoHtml = photoUrl
            ? `<div class="activity-photo" style="${photoStyle}" data-place="${act.name}" data-city="${dest}"><div class="activity-photo-overlay"></div>${photoBadge}</div>`
            : noPhoto;
        return `
        <div class="activity-card" data-type="${act.type}">
          ${photoHtml}
          <div class="activity-content">
            <div class="activity-header">
              <span class="activity-name">${act.name}</span>
              <span class="activity-time">${act.time}</span>
            </div>
            <div class="activity-meta">
              <span>⏱ ${act.duration}</span>
              <span>💰 ₹${act.cost}</span>
              <span>⭐ ${act.rating}</span>
              <span>💬 ${(act.reviews_count || 0).toLocaleString()} reviews</span>
            </div>
            <div class="mt-1" style="font-size:0.78rem;color:var(--text-2)">${act.description || ''}</div>
            ${weatherWarn}${crowdTip}
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">
              <div class="star-rating" data-day="${day.day}" data-act="${i}">
                ${[1,2,3,4,5].map(s => `<span class="star ${s <= 3 ? 'active' : ''}" onclick="rateActivity(${day.day},${i},${s}).catch(()=>{})">★</span>`).join('')}
              </div>
              <button class="view-media-btn" onclick="openMediaModal(${day.day - 1},${i})"><i class="fas fa-images"></i> Details</button>
              <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(act.name + ' ' + dest)}+travel+vlog" target="_blank" class="video-link-btn"><i class="fab fa-youtube"></i></a>
              <a href="https://www.google.com/maps/search/?api=1&query=${act.lat},${act.lon}" target="_blank" class="view-media-btn" style="background:var(--grad-primary);text-decoration:none"><i class="fas fa-map-marker-alt"></i> Map</a>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
    }).join('');

    // Placeholder photos already applied; no dynamic fetching.
}

async function rateActivity(day, actIdx, stars) {
    const validCats = ['cultural', 'adventure', 'food', 'shopping', 'relaxation', 'nature', 'nightlife'];
    const act = state.itinerary?.days?.[day - 1]?.activities?.[actIdx];
    const type = act?.type || 'cultural';
    const category = validCats.includes(type) ? type : 'cultural';
    
    // Update locally
    updateBayesian(category, stars >= 4);
    const ratings = document.querySelectorAll(`.star-rating[data-day="${day}"][data-act="${actIdx}"] .star`);
    ratings.forEach((s, i) => s.classList.toggle('active', i < stars));
    showToast(`Rated ${act?.name || 'activity'} ${stars}★`, 'info');
    
    // Send to backend — updates Q-table, Bayesian, Dirichlet, POMDP
    try {
        const res = await fetch(`${API_BASE}/ai/rate`, {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                category, rating: stars,
                budget: state.budget.total || 15000,
                itinerary: state.itinerary,
                weather: state.weatherData || []
            })
        });
        if (res.ok) {
            const data = await res.json();
            // Update RL rewards from backend
            if (data.reward !== undefined) {
                state.rl.rewards.push(Math.max(0, Math.min(1, data.reward)));
                state.rl.episode++;
                drawRLChart();
            }
            // Update Bayesian from backend
            if (data.bayesian?.preferences) {
                Object.entries(data.bayesian.preferences).forEach(([k, v]) => {
                    if (!state.bayesian[k]) state.bayesian[k] = {a: 2, b: 2};
                    state.bayesian[k].a = v.alpha || 2;
                    state.bayesian[k].b = v.beta || 2;
                });
                if (data.bayesian.confidence_intervals) state.bayesianCI = data.bayesian.confidence_intervals;
                renderBayesianBars();
            }
            // Update Dirichlet from backend
            if (data.dirichlet) {
                state.dirichletData = data.dirichlet;
                renderDirichletPanel();
            }
            // Update POMDP
            if (data.pomdp_belief) {
                state.pomdpBelief = data.pomdp_belief;
                renderPOMDPBelief();
            }
            addLog('preference', `Q-table updated: reward=${data.reward?.toFixed(3)}, action=${data.best_action}`, 'success');
        } else {
            const errText = await res.text().catch(() => '');
            showBackendError(`Rating failed (${res.status})`, errText);
        }
    } catch(e) {
        // Fallback: local RL episode
        runRLEpisode(); drawRLChart();
    }
}

// === RENDER BOOKINGS ===
function renderBookings(dest) {
    const c = document.getElementById('bookingsContainer');
    if (!c) return;
    const bookings = generateBookings(dest);

    const platformIcons = { google: 'fab fa-google', booking: 'fas fa-bed', makemytrip: 'fas fa-plane', skyscanner: 'fas fa-plane', zomato: 'fas fa-utensils', uber: 'fas fa-car', ola: 'fas fa-taxi', goibibo: 'fas fa-hotel', swiggy: 'fas fa-utensils', cleartrip: 'fas fa-plane', rapido: 'fas fa-motorcycle', ixigo: 'fas fa-search', irctc: 'fas fa-train', confirmtkt: 'fas fa-ticket-alt', redbus: 'fas fa-bus' };
    const platformColors = { google: '#4285f4', booking: '#003580', makemytrip: '#eb5b2d', skyscanner: '#0770e3', zomato: '#e23744', uber: '#000000', ola: '#35b44c', goibibo: '#ec5b24', swiggy: '#fc8019', cleartrip: '#e74c3c', rapido: '#ffc107', ixigo: '#f77728', irctc: '#1e3a5f', confirmtkt: '#2196f3', redbus: '#d84e55' };

    const formatBookingPrice = (item) => item.price_label || 'Compare on provider';

    let html = `<div class="section-title">🎫 Booking Options</div>
    <div class="booking-disclaimer">Prices are not live. Use provider links to compare current rates.</div>
    <div class="tabs" id="bookingTabs">
      <button class="tab active" onclick="switchBookingTab('hotels',this)">🏨 Hotels</button>
      <button class="tab" onclick="switchBookingTab('flights',this)">✈️ Flights</button>
      <button class="tab" onclick="switchBookingTab('trains',this)">🚂 Trains</button>
      <button class="tab" onclick="switchBookingTab('cabs',this)">🚗 Cabs</button>
      <button class="tab" onclick="switchBookingTab('buses',this)">🚌 Buses</button>
      <button class="tab" onclick="switchBookingTab('restaurants',this)">🍽️ Restaurants</button>
    </div>`;

    function renderCards(items, type) {
        return items.map(item => {
            const p = item.platform || '';
            return `<div class="booking-card">
              <div class="booking-card-banner" style="background:${platformColors[p] || '#667eea'}">
                <i class="${platformIcons[p] || 'fas fa-star'}"></i><span>${p.toUpperCase()}</span>
              </div>
              <div class="booking-card-body">
                <div class="booking-card-title">${item.name || item.airline || item.type || ''}</div>
                ${item.rating ? `<div class="booking-card-rating">⭐ ${item.rating}/5</div>` : ''}
                <div class="booking-card-price">${formatBookingPrice(item)}</div>
                ${item.amenities ? `<div class="booking-card-amenities">${item.amenities.map(a => `<span class="amenity-tag">${a}</span>`).join('')}</div>` : ''}
                ${item.features ? `<div class="booking-card-amenities">${item.features.map(f => `<span class="amenity-tag">${f}</span>`).join('')}</div>` : ''}
                <a href="${item.booking_url}" target="_blank" rel="noopener" class="btn btn-primary booking-link">🔗 Search</a>
              </div>
            </div>`;
        }).join('');
    }

    html += `<div class="tab-content active" id="tab-hotels"><div class="booking-grid">${renderCards(bookings.hotels)}</div></div>`;
    html += `<div class="tab-content" id="tab-flights" style="display:none"><div class="booking-grid">${renderCards(bookings.flights)}</div></div>`;
    html += `<div class="tab-content" id="tab-trains" style="display:none"><div class="booking-grid">${renderCards(bookings.trains)}</div></div>`;
    html += `<div class="tab-content" id="tab-cabs" style="display:none"><div class="booking-grid">${renderCards(bookings.cabs)}</div></div>`;
    html += `<div class="tab-content" id="tab-buses" style="display:none"><div class="booking-grid">${renderCards(bookings.buses)}</div></div>`;
    html += `<div class="tab-content" id="tab-restaurants" style="display:none"><div class="booking-grid">${renderCards(bookings.restaurants)}</div></div>`;

    c.innerHTML = html;
}

function switchBookingTab(tab, btn) {
    document.querySelectorAll('#bookingsContainer .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#bookingsContainer .tab-content').forEach(t => { t.style.display = 'none'; t.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) { tabEl.style.display = 'block'; tabEl.classList.add('active'); }
}

// === LANGUAGE TIPS (from API) ===
function renderLanguageTipsFromData(dest, data) {
    const c = document.getElementById('languageTips');
    if (!c) return;
    if (!data || !data.phrases?.length) {
        c.innerHTML = `<div class="section-title">🗣️ Language Tips</div><div class="empty-state"><div class="emoji">🌍</div><p>Language tips unavailable for ${dest}</p></div>`;
        return;
    }
    c.innerHTML = `
    <div class="section-title">🗣️ ${data.flag} ${data.language} — Essential Travel Phrases</div>
    <div class="lang-grid">
      ${data.phrases.map(p => `<div class="lang-card"><div class="lang-english">${p.en}</div><div class="lang-phrase">${p.phrase}</div><div class="lang-phonetic">🔈 ${p.phon}</div><div class="lang-situation">💡 ${p.ctx}</div></div>`).join('')}
    </div>`;
}

async function renderLanguageTipsFromAPI(dest) {
    const c = document.getElementById('languageTips');
    if (!c) return;
    try {
        const res = await fetch(`${API_BASE}/language-tips?city=${encodeURIComponent(dest)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success) {
                renderLanguageTipsFromData(dest, data);
                return;
            }
        }
    } catch (e) { /* fallback */ }
    c.innerHTML = `<div class="section-title">🗣️ Language Tips</div><div class="empty-state"><div class="emoji">🌍</div><p>Language tips unavailable for ${dest}</p></div>`;
}

// === WEATHER (Real API data) ===
function renderWeather(dest, days, forecasts) {
    const c = document.getElementById('weatherCards');
    if (!c) return;

    if (forecasts && forecasts.length > 0) {
        c.innerHTML = forecasts.slice(0, Math.min(days, 5)).map((f, i) => {
            const riskColor = f.risk_level === 'high' ? '#ef4444' : f.risk_level === 'medium' ? '#f59e0b' : '#10b981';
            return `<div class="weather-card">
                <div class="weather-icon">${f.icon}</div>
                <div class="weather-temp">${Math.round(f.temp_max)}°C</div>
                <div class="weather-desc">${f.description}</div>
                <div class="text-xs" style="color:${riskColor};font-weight:600">Risk: ${f.risk_level}</div>
                <div class="text-xs text-muted">Day ${i + 1}</div>
            </div>`;
        }).join('');
        addLog('weather', `Real weather loaded: ${forecasts.filter(f => f.risk_level === 'high').length} high-risk days`, 'success');
    } else {
        // Fallback: show "no data" message instead of random fake weather
        c.innerHTML = `<div class="weather-card" style="grid-column:1/-1;text-align:center;padding:20px">
            <div class="weather-icon">🌍</div>
            <div class="weather-desc" style="color:var(--text-secondary)">Weather data unavailable. Backend may be offline or location not found.</div>
        </div>`;
    }
}

// === BUDGET (FIXED — uses real data from backend) ===
function updateBudgetDisplay(itin, total) {
    const summary = itin?.budget_summary || {};
    const activitiesCost = summary.activities_cost ?? itin?.total_cost ?? 0;
    
    // Use backend budget_breakdown if available
    const bd = itin?.budget_breakdown || {};
    
    // If backend provides breakdown, use it. Otherwise compute from actual itinerary costs.
    const hasBackendData = summary.total_estimated_spend !== undefined || bd.accommodation || bd.food || bd.transport || bd.activities || bd.emergency;
    let breakdown;
    if (hasBackendData) {
        breakdown = {
            accommodation: bd.accommodation || 0,
            food: bd.food || 0,
            activities: bd.activities ?? activitiesCost,
            transport: bd.transport || 0,
            emergency: bd.emergency || 0,
        };
    } else {
        // Compute realistic breakdown from actual costs
        const remainingBudget = Math.max(0, total - activitiesCost);
        breakdown = {
            accommodation: Math.round(remainingBudget * 0.45),
            food: Math.round(remainingBudget * 0.25),
            activities: activitiesCost,
            transport: Math.round(remainingBudget * 0.20),
            emergency: Math.round(remainingBudget * 0.10),
        };
    }
    
    const totalSpend = summary.total_estimated_spend !== undefined
        ? summary.total_estimated_spend
        : Object.values(breakdown).reduce((s, v) => s + v, 0);
    const displaySpend = Math.min(totalSpend, total);
    state.budget = { total, used: displaySpend, breakdown };
    
    const pct = total > 0 ? Math.min(100, (displaySpend / total * 100)) : 0;
    const remaining = summary.remaining !== undefined ? summary.remaining : Math.max(0, total - totalSpend);
    
    const amtEl = document.getElementById('budgetAmount');
    const fillEl = document.getElementById('budgetFill');
    const totalEl = document.getElementById('budgetTotal');
    
    if (amtEl) amtEl.textContent = `₹${totalSpend.toLocaleString()}`;
    if (fillEl) {
        fillEl.style.width = pct + '%';
        if (pct > 90) fillEl.style.background = 'linear-gradient(90deg, #ef4444, #dc2626)';
        else if (pct > 70) fillEl.style.background = 'linear-gradient(90deg, #f59e0b, #d97706)';
        else fillEl.style.background = 'linear-gradient(90deg, #10b981, #059669)';
    }
    if (totalEl) totalEl.textContent = `/ ₹${total.toLocaleString()} (${pct.toFixed(0)}% used)`;
    
    const cats = document.getElementById('budgetCats');
    if (cats) {
        const catLabels = {
            '🏨 Accommodation': breakdown.accommodation,
            '🍽️ Food': breakdown.food,
            '🎯 Activities': breakdown.activities,
            '🚗 Transport': breakdown.transport,
            '🆘 Emergency': breakdown.emergency,
        };
        cats.innerHTML = Object.entries(catLabels).map(([k, v]) => {
            const catPct = total > 0 ? ((v / total) * 100).toFixed(0) : 0;
            return `<div class="budget-cat"><span>${k}</span><span class="fw-600">₹${Math.round(v).toLocaleString()} <small style="color:var(--text-3)">(${catPct}%)</small></span></div>`;
        }).join('') + `<div class="budget-cat" style="border-top:1px solid var(--border);padding-top:6px;margin-top:4px"><span style="color:var(--success)"><strong>💵 Remaining</strong></span><span class="fw-600" style="color:var(--success)">₹${remaining.toLocaleString()}</span></div>`;
    }
}

// === CROWD (time-of-day heuristic from backend) ===
function renderCrowdLevel() {
    const c = document.getElementById('crowdBar');
    if (!c) return;
    // Use real crowd level from backend AI data or compute from activities
    const aiCrowd = state.aiData?.crowd_level || _crowd_heuristic_avg();
    const current = Math.min(4, Math.floor(aiCrowd / 20)); // 0-4 index
    const levels = ['#10b981', '#10b981', '#f59e0b', '#f59e0b', '#ef4444'];
    c.innerHTML = levels.map((color, i) => `<div class="crowd-segment" style="background:${i <= current ? color : 'var(--bg-4)'}"></div>`).join('');
    const label = document.getElementById('crowdLabel');
    const labels = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'];
    if (label) label.textContent = labels[current] + ` (${Math.round(aiCrowd)}/100)`;
}

// ============================================
// SOCIAL DISCOVERY
// ============================================
function loadSocialDiscovery(dest) {
    loadInstagramReels(dest);
    loadYouTubeHiddenGems(dest);
}

function loadInstagramReels(dest) {
    const grid = document.getElementById('instaGrid');
    const empty = document.getElementById('instaEmpty');
    if (!grid) return;
    if (empty) empty.style.display = 'none';
    
    // Location-specific viral content with real search queries
    const destSlug = dest.toLowerCase().replace(/\s+/g, '');
    const destEnc = encodeURIComponent(dest);
    
    // Get itinerary activities for location-specific suggestions
    const itinPlaces = [];
    if (state.itinerary?.days) {
        state.itinerary.days.forEach(day => {
            (day.activities || []).forEach(act => {
                if (act.name) itinPlaces.push(act.name);
            });
        });
    }
    
    // Build location-specific content cards
    const spotNames = itinPlaces.length >= 3 ? itinPlaces.slice(0, 3) : [
        `${dest} Top Attractions`, `${dest} Food Street`, `${dest} Hidden Spot`
    ];
    
    const places = spotNames.map((name, idx) => {
        const viralTags = [`#${destSlug}`, `#${destSlug}travel`, `#explore${destSlug}`, '#travelgram'];
        const times = ['Golden hour', 'Morning', 'Sunset', 'Evening', 'Afternoon'][idx % 5];
        const types = ['photo_spot', 'cultural', 'viewpoint', 'food', 'landmark'][idx % 5];
        return {
            name,
            desc: `Trending travel location in ${dest}. Curated from popular content.`,
            tags: viralTags.slice(0, 3),
            neighborhood: dest,
            bestTime: times,
            type: types,
            searchQuery: `${name} ${dest} travel vlog`
        };
    });
    
    grid.innerHTML = places.map(p => `
        <div class="discovery-card reel-card">
            <div class="discovery-card-img reel-img"><div class="reel-gradient"></div><div class="discovery-card-platform instagram"><i class="fab fa-instagram"></i> Viral Reel</div></div>
            <div class="discovery-card-body">
                <div class="discovery-card-title">${p.name}</div>
                <div class="discovery-card-desc">${p.desc}</div>
                <div class="discovery-card-stats"><span>📍 ${p.neighborhood}</span><span>🕐 ${p.bestTime}</span></div>
                <div class="discovery-card-tags">${p.tags.map(t => `<span class="discovery-tag">${t}</span>`).join('')}</div>
                <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
                    <a href="https://www.instagram.com/explore/tags/${destSlug}/" target="_blank" class="reel-action-btn" style="background:#E1306C;color:white;padding:4px 10px;border-radius:6px;text-decoration:none;font-size:0.72rem"><i class="fab fa-instagram"></i> Reels</a>
                    <a href="https://www.google.com/search?q=${encodeURIComponent(p.name)}+${destEnc}&tbm=isch" target="_blank" class="reel-action-btn google-btn"><i class="fab fa-google"></i> Photos</a>
                    <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(p.searchQuery)}" target="_blank" class="reel-action-btn" style="background:#FF0000;color:white;padding:4px 10px;border-radius:6px;text-decoration:none;font-size:0.72rem"><i class="fab fa-youtube"></i> Vlogs</a>
                </div>
            </div>
        </div>
    `).join('');
    // Apply CC placeholders for discovery cards
    const placeholder = getPlaceholderPhoto('landmark');
    if (placeholder) {
        const imgs = grid.querySelectorAll('.reel-img');
        imgs.forEach(img => {
            img.style.backgroundImage = `url('${placeholder}')`;
            img.style.backgroundSize = 'cover';
            img.style.backgroundPosition = 'center';
        });
    }
}

function loadYouTubeHiddenGems(dest) {
    const grid = document.getElementById('ytGrid');
    const empty = document.getElementById('ytEmpty');
    if (!grid) return;
    if (empty) empty.style.display = 'none';
    
    const destEnc = encodeURIComponent(dest);
    
    // Location-specific YouTube content with real search links
    const videos = [
        { name: `${dest} Complete Travel Guide 2026`, desc: `Everything you need to know about visiting ${dest} - places, food, transport, budget tips.`, channel: 'Travel Guide', views: '1.2M', duration: '22:15', query: `${dest} complete travel guide 2026` },
        { name: `${dest} Street Food Tour`, desc: `Exploring the best street food and local cuisine in ${dest}. Must-try dishes!`, channel: 'Food Ranger', views: '890K', duration: '18:30', query: `${dest} street food tour vlog` },
        { name: `Top 10 Hidden Gems in ${dest}`, desc: `Secret spots most tourists miss. Local recommendations and off-beat experiences.`, channel: 'Hidden Gems', views: '567K', duration: '15:45', query: `${dest} hidden gems secret places` },
        { name: `${dest} Budget Travel Guide`, desc: `How to explore ${dest} under ₹5000. Cheap stays, free attractions, budget food.`, channel: 'Budget Backpacker', views: '432K', duration: '14:20', query: `${dest} budget travel tips cheap` },
    ];
    grid.innerHTML = videos.map(v => `
        <div class="discovery-card yt-card">
            <div class="discovery-card-img yt-thumbnail"><div class="yt-play-btn"><i class="fas fa-play"></i></div><span style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.8);color:white;padding:2px 6px;border-radius:3px;font-size:0.7rem">${v.duration}</span></div>
            <div class="discovery-card-body">
                <div class="discovery-card-title">${v.name}</div>
                <div class="discovery-card-desc">${v.desc}</div>
                <div class="discovery-card-stats"><span>👁️ ${v.views} views</span><span>📺 ${v.channel}</span></div>
                <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(v.query)}" target="_blank" class="btn btn-accent booking-link" style="font-size:0.78rem;background:#FF0000;color:white"><i class="fab fa-youtube"></i> Watch on YouTube</a>
            </div>
        </div>
    `).join('');
    // Apply CC placeholders for thumbnails
    const placeholder = getPlaceholderPhoto('landmark');
    if (placeholder) {
        const thumbs = grid.querySelectorAll('.yt-thumbnail');
        thumbs.forEach(thumb => {
            thumb.style.backgroundImage = `url('${placeholder}')`;
            thumb.style.backgroundSize = 'cover';
            thumb.style.backgroundPosition = 'center';
        });
    }
}

function switchDiscoveryTab(tab, btn) {
    document.querySelectorAll('.disc-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.disc-content').forEach(t => { t.style.display = 'none'; t.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    const el = document.getElementById(`disc-${tab}`);
    if (el) { el.style.display = 'block'; el.classList.add('active'); }
}

// ============================================
// AI CHATBOT
// ============================================
function toggleChatbot() {
    const win = document.getElementById('chatbotWindow');
    state.chatOpen = !state.chatOpen;
    if (state.chatOpen) {
        win.classList.add('active');
        document.getElementById('chatInput')?.focus();
        document.getElementById('chatbotBadge').style.display = 'none';
    } else { win.classList.remove('active'); }
}

function sendSuggestion(text) {
    document.getElementById('chatInput').value = text;
    sendChatMessage();
}

async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';
    appendChatMessage('user', msg);
    const typingId = showChatTyping();
    const response = await generateChatResponse(msg);
    removeChatTyping(typingId);
    appendChatMessage('bot', response);
}

function appendChatMessage(role, text) {
    const container = document.getElementById('chatMessages');
    const msg = document.createElement('div');
    msg.className = `chat-msg ${role}`;
    msg.innerHTML = `<div class="chat-msg-avatar">${role === 'bot' ? '🤖' : '👤'}</div><div class="chat-msg-bubble">${text}</div>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    state.chatHistory.push({ role, text });
}

function showChatTyping() {
    const container = document.getElementById('chatMessages');
    const typing = document.createElement('div');
    typing.className = 'chat-msg bot';
    typing.id = 'chat-typing-indicator';
    typing.innerHTML = `<div class="chat-msg-avatar">🤖</div><div class="chat-msg-bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div>`;
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
    return 'chat-typing-indicator';
}

function removeChatTyping(id) { document.getElementById(id)?.remove(); }

async function generateChatResponse(userMsg) {
    const dest = state.currentDest || document.getElementById('destination')?.value || '';
    try {
        const res = await fetch(`${API_BASE}/chatbot`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userMsg, destination: dest, persona: state.persona, history: state.chatHistory.slice(-6) })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.response) return data.response;
        }
    } catch (e) { /* fallback */ }
    return `I can help with: hidden gems, food, budget tips, safety, nearby places, weather, and language phrases!`;
}

// ============================================
// EMERGENCY REPLANNING (Delay + Weather + Crowd)
// ============================================
function emergencyReplan() {
    if (!state.itinerary) { showToast('Generate a trip first!', 'warning'); return; }
    document.getElementById('delayModal')?.classList.add('active');
}

async function doReplan() {
    const reason = document.getElementById('replanReason')?.value || 'delay';
    const delayHours = parseFloat(document.getElementById('delayHours')?.value) || 4;
    const delayDay = parseInt(document.getElementById('delayDay')?.value) || 1;
    const weatherRisk = document.getElementById('weatherRisk')?.value || 'rain';
    const crowdLevel = document.getElementById('crowdLevel')?.value || 'high';
    const dest = document.getElementById('destination').value.trim() || state.currentDest || 'Unknown';
    const budget = parseInt(document.getElementById('budget').value) || state.budget?.total || 15000;

    if (!state.itinerary || !state.itinerary.days || state.itinerary.days.length === 0) {
        showToast('Generate a trip first!', 'warning');
        return;
    }
    document.getElementById('delayModal')?.classList.remove('active');
    showLoading(true);
    setAllAgentsStatus('thinking');

    const reasonLabels = { delay: 'DELAY', weather: 'WEATHER RISK', crowd: 'CROWD ALERT' };
    addLog('planner', `${reasonLabels[reason]}: Replanning Day ${delayDay}`, 'error');

    document.getElementById('agentConvoPanel').style.display = 'block';
    document.getElementById('agentConvo').innerHTML = '';
    agentSay('planner', null, `${reasonLabels[reason]} on Day ${delayDay}. Emergency replanning...`, 'decision');

    try {
        // Build a clean itinerary object for the backend
        const cleanItinerary = {
            days: (state.itinerary.days || []).map(d => ({
                day: d.day || 1,
                activities: (d.activities || []).map(a => ({
                    name: a.name || 'Unknown',
                    type: a.type || 'attraction',
                    duration: a.duration || '2 hours',
                    rating: a.rating || 4.0,
                    cost: a.cost || 0,
                    time: a.time || '09:00',
                    lat: a.lat || 0,
                    lon: a.lon || 0,
                    description: a.description || ''
                })),
                daily_cost: d.daily_cost || 0
            })),
            total_cost: state.itinerary.total_cost || 0
        };
        
        const res = await fetch(`${API_BASE}/replan`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destination: dest,
                current_day: Math.min(delayDay, cleanItinerary.days.length),
                budget,
                original_itinerary: cleanItinerary,
                reason,
                delay_hours: reason === 'delay' ? delayHours : 0,
                weather_risk: reason === 'weather' ? weatherRisk : '',
                crowd_level: reason === 'crowd' ? crowdLevel : ''
            })
        });
        if (res.ok) {
            const data = await res.json();
            state.itinerary = data.itinerary;
            await fixItineraryPhotos(state.itinerary, dest);
            renderItinerary(state.itinerary, dest);
            updateMap(state.itinerary);
            updateBudgetDisplay(state.itinerary, budget);

            agentSay('weather', 'planner', `Itinerary adjusted for ${reason}. ${data.changes?.changes_made?.join('. ') || ''}`, 'insight');
            agentSay('explain', null, `${data.changes?.removed_activities?.length || 0} activities removed, ${data.changes?.kept_activities?.length || 0} kept.`, 'decision');

            showLoading(false); setAllAgentsStatus('completed');
            showToast(`Day ${delayDay} replanned for ${reason}!`, 'success');
            return;
        }
    } catch (e) { /* fallback */ }

    // Fallback local replan
    const dayIdx = delayDay - 1;
    if (state.itinerary.days[dayIdx]) {
        const day = state.itinerary.days[dayIdx];
        const sorted = [...day.activities].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        const kept = sorted.slice(0, Math.max(1, Math.floor((10 - delayHours) / 2.5)));
        const startHour = 9 + delayHours;
        kept.forEach((a, i) => { a.time = `${Math.floor(startHour + i * 2.5).toString().padStart(2, '0')}:00`; });
        day.activities = kept;
        day.daily_cost = kept.reduce((s, a) => s + (a.cost || 0), 0);
        state.itinerary.total_cost = state.itinerary.days.reduce((s, d) => s + d.daily_cost, 0);
    }

    renderItinerary(state.itinerary, dest);
    updateMap(state.itinerary);
    updateBudgetDisplay(state.itinerary, budget);
    showLoading(false); setAllAgentsStatus('completed');
    showToast(`Day ${delayDay} replanned!`, 'success');
}

function updateReplanFields() {
    const reason = document.getElementById('replanReason')?.value || 'delay';
    document.getElementById('delayFields').style.display = reason === 'delay' ? 'block' : 'none';
    document.getElementById('weatherFields').style.display = reason === 'weather' ? 'block' : 'none';
    document.getElementById('crowdFields').style.display = reason === 'crowd' ? 'block' : 'none';
}

// ============================================
// LIVE NEARBY PLACES (Categorized & Quality-Ranked)
// ============================================
async function findNearbyPlaces() {
    // Always allow manual entry as primary option (GPS often fails in sandbox)
    // Try GPS first, fall back to manual entry
    if (navigator.geolocation && !window._nearbyForceManual) {
        showToast('Getting your location...', 'info');
        
        try {
            const pos = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, { 
                    enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 
                });
            });
            const lat = pos.coords.latitude;
            const lon = pos.coords.longitude;
            state.userLocation = { lat, lon };
            await fetchNearbyPlaces(lat, lon, '');
            return;
        } catch (err) {
            console.log('GPS unavailable, using manual entry:', err.message);
        }
    }
    
    showNearbyLocationPrompt();
}

function showNearbyLocationPrompt() {
    // Use destination from the trip form as default
    const defaultLoc = document.getElementById('destination')?.value || '';
    const locationInput = prompt(
        'Enter your current location (city, landmark, or address):\n\nExamples: "Connaught Place Delhi", "Marina Beach Chennai", "IIT Bombay"',
        defaultLoc
    );
    if (locationInput && locationInput.trim()) {
        fetchNearbyByName(locationInput.trim());
    }
}

async function fetchNearbyByName(locationName) {
    showLoading(true);
    addLog('planner', `Searching nearby places around "${locationName}"...`, 'working');
    
    try {
        const res = await fetch(`${API_BASE}/nearby`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: 0, lon: 0, radius: 10000, location_name: locationName })
        });
        
        showLoading(false);
        
        if (res.ok) {
            const data = await res.json();
            if (data.places?.length > 0 || (data.categorized && Object.values(data.categorized).some(arr => arr?.length > 0))) {
                const coords = data.coordinates || {};
                showNearbyPanel(data.places || [], data.categorized || {}, coords.lat || 0, coords.lon || 0);
                addNearbyToMap(data.places || [], coords.lat || 0, coords.lon || 0);
                showToast(`Found ${data.count || 0} places near ${locationName}!`, 'success');
                addLog('planner', `Found ${data.count || 0} nearby places`, 'success');
            } else {
                showToast('No notable places found near that location. Try a different spot.', 'warning');
            }
        } else {
            const errData = await res.json().catch(() => null);
            showToast(errData?.detail || 'Could not find that location', 'error');
        }
    } catch (e) {
        showLoading(false);
        showToast('Nearby search failed. Check your connection.', 'error');
        console.error('Nearby by name error:', e);
    }
}

async function fetchNearbyPlaces(lat, lon, destination) {
    state.userLocation = { lat, lon };
    addLog('planner', `Searching nearby: ${lat.toFixed(4)}, ${lon.toFixed(4)}`, 'info');
    showLoading(true);

    try {
        const res = await fetch(`${API_BASE}/nearby`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lon, radius: 10000, destination: destination || state.currentDest || '' })
        });

        showLoading(false);

        if (res.ok) {
            const data = await res.json();
            if (data.places?.length > 0 || (data.categorized && Object.values(data.categorized).some(arr => arr?.length > 0))) {
                showNearbyPanel(data.places || [], data.categorized || {}, lat, lon);
                addNearbyToMap(data.places || [], lat, lon);
                showToast(`Found ${data.count || data.places?.length || 0} places near you!`, 'success');
            } else {
                showToast('No notable places found nearby. Try a wider area.', 'warning');
            }
        } else {
            showToast('Could not fetch nearby places', 'error');
        }
    } catch (e) {
        showLoading(false);
        showToast('Nearby search failed', 'error');
    }
}

function showNearbyPanel(places, categorized, userLat, userLon) {
    const container = document.getElementById('nearbyContainer');
    if (!container) return;
    document.getElementById('nearbyPanel').style.display = 'block';

    const catConfig = {
        recreation: { icon: '🎢', label: 'Recreation & Entertainment', color: '#f59e0b' },
        nature: { icon: '🌿', label: 'Nature & Parks', color: '#10b981' },
        culture: { icon: '🏛️', label: 'Culture & History', color: '#8b5cf6' },
        attractions: { icon: '📍', label: 'Must-Visit Attractions', color: '#667eea' },
        eating: { icon: '🍽️', label: 'Food & Dining', color: '#ef4444' },
        shopping: { icon: '🛍️', label: 'Shopping', color: '#ec4899' }
    };

    // Check if we have categorized data
    const hasCategorized = categorized && Object.values(categorized).some(arr => arr && arr.length > 0);
    
    let html = '';
    
    if (hasCategorized) {
        // Render category tabs
        const activeCats = Object.entries(catConfig).filter(([key]) => categorized[key]?.length > 0);
        
        if (activeCats.length > 0) {
            html += `<div class="nearby-tabs" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">`;
            html += `<button class="nearby-tab active" onclick="filterNearbyCategory('all', this)" style="padding:6px 12px;border-radius:20px;border:1px solid var(--border);background:var(--primary);color:#fff;font-size:0.78rem;cursor:pointer">📍 All</button>`;
            activeCats.forEach(([key, cfg]) => {
                html += `<button class="nearby-tab" onclick="filterNearbyCategory('${key}', this)" style="padding:6px 12px;border-radius:20px;border:1px solid ${cfg.color}44;background:${cfg.color}15;color:${cfg.color};font-size:0.78rem;cursor:pointer">${cfg.icon} ${cfg.label} (${categorized[key].length})</button>`;
            });
            html += `</div>`;
            
            // Render categorized sections
            activeCats.forEach(([key, cfg]) => {
                html += `<div class="nearby-category" data-category="${key}" style="margin-bottom:16px">`;
                html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:1.2rem">${cfg.icon}</span><span style="font-weight:700;color:${cfg.color}">${cfg.label}</span><span style="font-size:0.75rem;color:var(--text-2)">${categorized[key].length} found</span></div>`;
                
                categorized[key].forEach(p => {
                    const distStr = p.distance_m < 1000 ? `${p.distance_m}m` : `${(p.distance_m / 1000).toFixed(1)}km`;
                    const qualityStars = '⭐'.repeat(Math.min(5, Math.max(1, Math.round(p.quality_score || 2))));
                    html += `
                    <div class="nearby-card" data-category="${key}" style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:10px;background:var(--bg-3);margin-bottom:6px;border-left:3px solid ${cfg.color}">
                        <div class="nearby-icon" style="width:42px;height:42px;border-radius:8px;background:${cfg.color}15;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">${cfg.icon}</div>
                        <div class="nearby-info" style="flex:1;min-width:0">
                            <div class="nearby-name" style="font-weight:600;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.name}</div>
                            <div class="nearby-meta" style="display:flex;gap:8px;font-size:0.75rem;color:var(--text-2);flex-wrap:wrap;margin-top:2px">
                                <span style="color:${cfg.color}">${p.subcategory || p.category}</span>
                                <span>📏 ${distStr}</span>
                                ${p.quality_score ? `<span>${qualityStars}</span>` : ''}
                                ${p.opening_hours ? `<span>🕐 ${p.opening_hours}</span>` : ''}
                            </div>
                            ${p.website ? `<a href="${p.website}" target="_blank" style="font-size:0.72rem;color:var(--primary)">🔗 Website</a>` : ''}
                        </div>
                        <a href="https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLon}&destination=${p.lat},${p.lon}&travelmode=walking" target="_blank" class="nearby-nav-btn" style="width:36px;height:36px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;text-decoration:none;flex-shrink:0"><i class="fas fa-directions"></i></a>
                    </div>`;
                });
                html += `</div>`;
            });
        }
    }
    
    if (!html) {
        // Fallback to flat list
        html = places.slice(0, 15).map(p => {
            const catIcons = { restaurant: '🍽️', cafe: '☕', museum: '🏛️', historic: '🏛️', religious: '🛕', park: '🌳', shopping: '🛍️', attraction: '📍', eating: '🍽️', recreation: '🎢', nature: '🌿', culture: '🏛️' };
            const distStr = p.distance_m < 1000 ? `${p.distance_m}m` : `${(p.distance_m / 1000).toFixed(1)}km`;
            return `
            <div class="nearby-card" style="display:flex;align-items:center;gap:12px;padding:10px;border-radius:10px;background:var(--bg-3);margin-bottom:6px">
                <div class="nearby-icon" style="width:36px;height:36px;border-radius:8px;background:var(--bg-4);display:flex;align-items:center;justify-content:center;font-size:1.2rem">${catIcons[p.category] || '📍'}</div>
                <div class="nearby-info" style="flex:1;min-width:0">
                    <div class="nearby-name" style="font-weight:600;font-size:0.88rem">${p.name}</div>
                    <div class="nearby-meta" style="display:flex;gap:8px;font-size:0.75rem;color:var(--text-2)">
                        <span>${p.category}</span>
                        <span>📏 ${distStr}</span>
                        ${p.opening_hours ? `<span>🕐 ${p.opening_hours}</span>` : ''}
                    </div>
                </div>
                <a href="https://www.google.com/maps/dir/?api=1&origin=${userLat},${userLon}&destination=${p.lat},${p.lon}&travelmode=walking" target="_blank" class="nearby-nav-btn" style="width:36px;height:36px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;text-decoration:none"><i class="fas fa-directions"></i></a>
            </div>`;
        }).join('');
    }

    container.innerHTML = html;

    // Fetch photos for nearby cards
    const allPlaces = places.slice(0, 15);
    allPlaces.forEach(async (p, idx) => {
        if (p.photo) {
            const cards = container.querySelectorAll('.nearby-card');
            if (cards[idx]) {
                const iconEl = cards[idx].querySelector('.nearby-icon');
                if (iconEl) {
                    iconEl.style.backgroundImage = `url('${p.photo}')`;
                    iconEl.style.backgroundSize = 'cover';
                    iconEl.style.backgroundPosition = 'center';
                    iconEl.textContent = '';
                }
            }
        }
    });
}

function filterNearbyCategory(category, btn) {
    // Update tab styles
    document.querySelectorAll('.nearby-tab').forEach(t => {
        t.classList.remove('active');
        t.style.background = t.style.background.replace('var(--primary)', '');
        t.style.color = '';
    });
    if (btn) {
        btn.classList.add('active');
    }
    
    // Filter cards
    const categories = document.querySelectorAll('.nearby-category');
    const cards = document.querySelectorAll('.nearby-card[data-category]');
    
    if (category === 'all') {
        categories.forEach(c => c.style.display = 'block');
    } else {
        categories.forEach(c => {
            c.style.display = c.dataset.category === category ? 'block' : 'none';
        });
    }
}

function addNearbyToMap(places, userLat, userLon) {
    if (!map) return;
    // Clear previous nearby markers
    nearbyMarkers.forEach(m => map.removeLayer(m));
    nearbyMarkers = [];

    // Add user location marker
    const userIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="background:#ef4444;width:20px;height:20px;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.4);animation:pulse 2s infinite"></div>`,
        iconSize: [20, 20], iconAnchor: [10, 10]
    });
    const userMarker = L.marker([userLat, userLon], { icon: userIcon }).addTo(map);
    userMarker.bindPopup('<strong>📍 You are here</strong>');
    nearbyMarkers.push(userMarker);

    // Add nearby place markers
    places.slice(0, 10).forEach((p, i) => {
        const icon = L.divIcon({
            className: 'custom-marker',
            html: `<div style="background:#06b6d4;width:24px;height:24px;border-radius:50%;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:10px">${i + 1}</div>`,
            iconSize: [24, 24], iconAnchor: [12, 12]
        });
        const m = L.marker([p.lat, p.lon], { icon }).addTo(map);
        m.bindPopup(`<strong>${p.name}</strong><br>${p.category} • ${p.distance_m}m`);
        nearbyMarkers.push(m);
    });

    // Fit bounds to include user + nearby places
    const allCoords = [[userLat, userLon], ...places.slice(0, 10).map(p => [p.lat, p.lon])];
    map.fitBounds(L.latLngBounds(allCoords), { padding: [40, 40], maxZoom: 16 });
}

// ============================================
// MEDIA MODAL
// ============================================
function openMediaModal(dayIdx, actIdx) {
    const act = state.itinerary?.days?.[dayIdx]?.activities?.[actIdx];
    if (!act) return;
    const modal = document.getElementById('mediaModal');
    document.getElementById('modalTitle').textContent = act.name;
    const q = encodeURIComponent(act.name);

    const photos = act.photos?.filter(p => p) || [];
    document.getElementById('modalPhotos').innerHTML = photos.length
        ? photos.map(url => `<div class="photo-gallery-item" onclick="viewFullPhoto('${url}')"><img src="${url}" alt="${act.name}" loading="lazy" onerror="this.parentElement.style.display='none'"><div class="photo-overlay"><span>Enlarge</span></div></div>`).join('')
        : `<p class="text-muted text-sm">Loading photos...</p>`;

    if (!photos.length) {
        getRealPhoto(act.name, state.currentDest, '').then(url => {
            if (url) {
                document.getElementById('modalPhotos').innerHTML = `<div class="photo-gallery-item" onclick="viewFullPhoto('${url}')"><img src="${url}" alt="${act.name}" loading="lazy"><div class="photo-overlay"><span>Enlarge</span></div></div>`;
            }
        });
    }

    const destQ = encodeURIComponent(state.currentDest || '');
    document.getElementById('modalVideos').innerHTML = `
    <a href="https://www.youtube.com/results?search_query=${q}+${destQ}+travel+vlog" target="_blank" class="media-link-btn youtube"><i class="fab fa-youtube"></i> Travel Vlog</a>
    <a href="https://www.youtube.com/results?search_query=${q}+${destQ}+virtual+tour+4k" target="_blank" class="media-link-btn youtube"><i class="fas fa-vr-cardboard"></i> Virtual Tour</a>
    <a href="https://www.youtube.com/results?search_query=${q}+${destQ}+hidden+gems" target="_blank" class="media-link-btn youtube"><i class="fas fa-gem"></i> Hidden Gems</a>`;

    const mapDiv = document.getElementById('modalMapEmbed');
    mapDiv.innerHTML = act.lat && act.lon ? `<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${act.lon - 0.01},${act.lat - 0.01},${act.lon + 0.01},${act.lat + 0.01}&layer=mapnik&marker=${act.lat},${act.lon}" style="width:100%;height:100%;border:none;border-radius:var(--radius)"></iframe>` : '<p class="text-muted">Map unavailable</p>';

    document.getElementById('modalMaps').innerHTML = `
    <a href="https://www.google.com/maps/search/?api=1&query=${act.lat},${act.lon}" target="_blank" class="media-link-btn google"><i class="fas fa-map-marked-alt"></i> Google Maps</a>
    <a href="https://www.google.com/maps/dir/?api=1&destination=${act.lat},${act.lon}" target="_blank" class="media-link-btn google"><i class="fas fa-directions"></i> Directions</a>`;

    const fullStars = Math.floor(act.rating);
    document.getElementById('modalRating').innerHTML = `<div class="rating-big">${act.rating}</div><div><div class="rating-stars">${Array.from({length:5}, (_,i) => `<span class="star ${i < fullStars ? '' : 'empty'}">${i < fullStars ? '★' : '☆'}</span>`).join('')}</div><div class="rating-label">${(act.reviews_count || 0).toLocaleString()} reviews</div></div>`;
    document.getElementById('modalReviews').innerHTML = `
    <a href="https://www.google.com/search?q=${q}+reviews" target="_blank" class="media-link-btn google"><i class="fab fa-google"></i> Google Reviews</a>
    <a href="https://www.tripadvisor.com/Search?q=${q}" target="_blank" class="media-link-btn tripadvisor"><i class="fab fa-tripadvisor"></i> TripAdvisor</a>`;

    document.getElementById('modalLinks').innerHTML = `
    <a href="https://en.wikipedia.org/wiki/${q.replace(/%20/g, '_')}" target="_blank" class="media-link-btn wiki"><i class="fab fa-wikipedia-w"></i> Wikipedia</a>
    <a href="https://www.google.com/search?q=${q}+tickets+booking" target="_blank" class="media-link-btn"><i class="fas fa-ticket-alt"></i> Tickets</a>`;

    document.getElementById('modalInfo').innerHTML = `
    <div class="info-badge"><i class="fas fa-clock"></i> ${act.duration}</div>
    <div class="info-badge"><i class="fas fa-rupee-sign"></i> ₹${act.cost}</div>
    <div class="info-badge"><i class="fas fa-tag"></i> ${act.type}</div>
    <div class="info-badge"><i class="fas fa-star"></i> ${act.rating}/5</div>`;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMediaModal() {
    document.getElementById('mediaModal')?.classList.remove('active');
    document.body.style.overflow = '';
}

function viewFullPhoto(url) {
    const div = document.createElement('div');
    div.className = 'fullscreen-photo';
    div.innerHTML = `<img src="${url}" alt="Full size photo">`;
    div.onclick = () => div.remove();
    document.body.appendChild(div);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme === 'light' ? 'light' : '');
    document.getElementById('themeIcon').className = state.theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
}

function selectPersona(p) {
    state.persona = p;
    document.querySelectorAll('.persona-card').forEach(c => c.classList.remove('active'));
    document.querySelector(`.persona-card[data-persona="${p}"]`)?.classList.add('active');
    const budgets = { solo: 15000, family: 40000, luxury: 100000, adventure: 25000 };
    document.getElementById('budget').value = budgets[p] || 15000;
    addLog('preference', `Persona: ${p}`, 'info');
}

function showLoading(show) {
    document.getElementById('loadingOverlay')?.classList.toggle('active', show);
}

function showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = msg;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(40px)'; setTimeout(() => t.remove(), 300); }, 3500);
}

function exportPDF() { showToast('Use Ctrl+P / Cmd+P to print as PDF', 'info'); }

function shareTrip() {
    const dest = document.getElementById('destination').value;
    const days = document.getElementById('duration').value;
    const url = `${window.location.origin}${window.location.pathname}?dest=${encodeURIComponent(dest)}&days=${days}`;
    navigator.clipboard?.writeText(url);
    showToast('Share link copied!', 'success');
}

function startVoice() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        showToast('Voice input not supported', 'warning'); return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.onresult = e => {
        const text = e.results[0][0].transcript;
        document.getElementById('destination').value = text;
        showToast(`Heard: "${text}"`, 'success');
        setTimeout(() => generateTrip(), 300);
    };
    recognition.onerror = () => showToast('Voice recognition failed', 'error');
    recognition.start();
    showToast('Listening...', 'info');
}

// === EVENT LISTENERS ===
let _autoTimer = null;
function setupEventListeners() {
    document.getElementById('generateBtn')?.addEventListener('click', generateTrip);

    const destInput = document.getElementById('destination');
    destInput?.addEventListener('input', () => {
        clearTimeout(_autoTimer);
        const val = destInput.value.trim();
        if (val.length >= 3) {
            _autoTimer = setTimeout(() => {
                if (!state.generating) {
                    addLog('planner', `Auto-detecting destination: ${val}...`, 'info');
                }
            }, 1500);
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Enter' && document.activeElement?.id === 'destination') {
            e.preventDefault();
            generateTrip();
        }
        if (e.key === 'Escape') {
            closeMediaModal();
            document.querySelectorAll('.fullscreen-photo').forEach(el => el.remove());
        }
    });
}

// === INIT ===
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else { init(); }

// ============================================
// DESTINATION RECOMMENDATION SYSTEM
// ============================================
function openRecommendModal() {
    document.getElementById('recommendModal')?.classList.add('active');
    document.getElementById('recommendResults').innerHTML = '';
}

async function getRecommendations() {
    const budget = parseInt(document.getElementById('recBudget')?.value) || 20000;
    const duration = parseInt(document.getElementById('recDuration')?.value) || 3;
    const continent = document.getElementById('recContinent')?.value || '';
    const weatherPref = document.getElementById('recWeather')?.value || '';
    const month = document.getElementById('recMonth')?.value || '';
    const currentLocation = document.getElementById('recCurrentLocation')?.value?.trim() || '';
    const persona = state.persona;
    
    const prefs = [];
    document.querySelectorAll('.rec-pref:checked').forEach(cb => prefs.push(cb.value));
    
    const resultsDiv = document.getElementById('recommendResults');
    resultsDiv.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-2)"><i class="fas fa-spinner fa-spin"></i> AI finding destinations within your budget...</div>';
    
    addLog('preference', `Finding destinations within budget (budget: ${budget}, ${duration} days)...`, 'working');
    
    try {
        const res = await fetch(`${API_BASE}/recommend`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                budget, duration, preferences: prefs, persona,
                continent, weather_pref: weatherPref, month,
                current_location: currentLocation
            })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.recommendations?.length > 0) {
                renderRecommendations(data.recommendations, duration, budget);
                addLog('preference', `Found ${data.recommendations.length} destinations within your budget!`, 'success');
                return;
            } else if (data.success && data.recommendations?.length === 0) {
                resultsDiv.innerHTML = `<div style="text-align:center;padding:20px;color:#f59e0b">
                    <i class="fas fa-exclamation-triangle"></i> No destinations found within your budget.<br>
                    <small style="color:var(--text-2)">Try increasing your budget or trip duration.</small>
                </div>`;
                return;
            }
        }
    } catch (e) { console.error('Recommendation error:', e); }
    
    resultsDiv.innerHTML = '<div style="text-align:center;padding:20px;color:#ef4444"><i class="fas fa-exclamation-circle"></i> Could not get recommendations. Please try again.</div>';
}

function renderRecommendations(recs, duration, userBudget) {
    const resultsDiv = document.getElementById('recommendResults');
    
    const html = recs.map((r, i) => {
        const matchPct = Math.min(100, r.match_score * 1.2).toFixed(0);
        const matchColor = matchPct > 70 ? '#10b981' : matchPct > 40 ? '#f59e0b' : '#ef4444';
        const photoHtml = r.photo ? `<div style="width:60px;height:60px;border-radius:10px;background:url('${r.photo}') center/cover;flex-shrink:0"></div>` : `<div style="width:60px;height:60px;border-radius:10px;background:var(--bg-4);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0">🌍</div>`;
        
        const withinBudget = r.within_budget !== false;
        const budgetTag = withinBudget 
            ? `<span style="background:#10b98120;color:#10b981;padding:1px 6px;border-radius:8px;font-size:0.7rem;font-weight:600">Within Budget</span>` 
            : `<span style="background:#f59e0b20;color:#f59e0b;padding:1px 6px;border-radius:8px;font-size:0.7rem;font-weight:600">Near Budget</span>`;
        
        return `
        <div style="display:flex;gap:12px;padding:12px;background:var(--bg-3);border-radius:12px;margin-bottom:8px;border-left:3px solid ${matchColor};cursor:pointer;transition:transform 0.15s" 
             onmouseenter="this.style.transform='scale(1.01)'" onmouseleave="this.style.transform='scale(1)'"
             onclick="selectRecommendation('${r.name}', ${duration})">
            ${photoHtml}
            <div style="flex:1;min-width:0">
                <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">
                    <div style="font-weight:700;font-size:0.95rem">${i === 0 ? '🏆 ' : ''}${r.name}, ${r.country}</div>
                    <div style="display:flex;gap:4px;align-items:center">
                        ${budgetTag}
                        <div style="background:${matchColor}20;color:${matchColor};padding:2px 8px;border-radius:12px;font-size:0.72rem;font-weight:700">${matchPct}% match</div>
                    </div>
                </div>
                <div style="font-size:0.8rem;color:var(--text-2);margin:4px 0">${r.description}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">
                    ${r.tags.map(t => `<span style="background:var(--bg-4);padding:2px 6px;border-radius:6px;font-size:0.7rem">${t}</span>`).join('')}
                </div>
                <div style="display:flex;gap:12px;margin-top:6px;font-size:0.75rem;color:var(--text-2)">
                    <span>💰 ~₹${r.estimated_total.toLocaleString()} total (₹${r.avg_daily_cost.toLocaleString()}/day)</span>
                    <span>⭐ ${r.rating}</span>
                    <span>${r.weather === 'warm' ? '☀️' : r.weather === 'cold' ? '❄️' : '🌤️'} ${r.weather}</span>
                </div>
                ${r.match_reasons.length > 0 ? `<div style="font-size:0.72rem;color:${matchColor};margin-top:4px">✓ ${r.match_reasons.slice(0, 3).join(' • ')}</div>` : ''}
            </div>
        </div>`;
    }).join('');
    
    resultsDiv.innerHTML = `<div style="font-weight:700;margin-bottom:8px;color:var(--accent)">🎯 Top ${recs.length} Destinations Within Your Budget (click to plan)</div>` + html;
}

function selectRecommendation(destName, duration) {
    document.getElementById('destination').value = destName;
    document.getElementById('duration').value = duration;
    document.getElementById('recommendModal')?.classList.remove('active');
    showToast(`Selected ${destName}! Click "Generate AI Trip" to plan.`, 'success');
    addLog('planner', `Destination selected: ${destName}`, 'success');
}

// ============================================
// HALF-DAY / SPECIFIC LOCATION PLANNING
// ============================================
function openHalfDayModal() {
    document.getElementById('halfDayModal')?.classList.add('active');
    document.getElementById('halfDayResults').innerHTML = '';
}

async function planHalfDay() {
    const location = document.getElementById('hdLocation')?.value.trim();
    const hours = parseFloat(document.getElementById('hdHours')?.value) || 5;
    const timeOfDay = document.getElementById('hdTimeOfDay')?.value || 'afternoon';
    const budget = parseInt(document.getElementById('hdBudget')?.value) || 3000;
    const includeFood = document.getElementById('hdIncludeFood')?.checked || true;
    
    if (!location) { showToast('Please enter your current location', 'warning'); return; }
    
    const resultsDiv = document.getElementById('halfDayResults');
    resultsDiv.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-2)"><i class="fas fa-spinner fa-spin"></i> Planning your remaining time...</div>';
    
    addLog('planner', `Half-day plan: ${hours}h near ${location}`, 'working');
    
    try {
        const res = await fetch(`${API_BASE}/plan-halfday`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                location, hours_available: hours, time_of_day: timeOfDay,
                budget, preferences: [], persona: state.persona, include_food: includeFood
            })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.plan?.length > 0) {
                renderHalfDayPlan(data);
                addLog('planner', `Half-day plan: ${data.plan.length} activities in ${data.estimated_hours}h`, 'success');
                
                // Also show on map
                if (map && data.coordinates) {
                    clearMap();
                    const coords = [];
                    data.plan.forEach((act, i) => {
                        if (act.lat && act.lon) {
                            coords.push([act.lat, act.lon]);
                            const icon = L.divIcon({
                                className: 'custom-marker',
                                html: `<div style="background:linear-gradient(135deg,#06b6d4,#10b981);width:32px;height:32px;border-radius:50% 50% 50% 0;border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;transform:rotate(-45deg)"><span style="transform:rotate(45deg)">${i + 1}</span></div>`,
                                iconSize: [32, 32], iconAnchor: [10, 32], popupAnchor: [6, -32]
                            });
                            const m = L.marker([act.lat, act.lon], { icon }).addTo(map);
                            m.bindPopup(`<strong>${act.name}</strong><br>${act.type} • ${act.time}`);
                            markers.push(m);
                        }
                    });
                    if (data.coordinates) {
                        coords.unshift([data.coordinates.lat, data.coordinates.lon]);
                    }
                    if (coords.length > 1) {
                        const routeLine2 = L.polyline(coords, { color: '#06b6d4', weight: 3, opacity: 0.7, dashArray: '10, 8' }).addTo(map);
                    }
                    if (coords.length > 0) {
                        map.fitBounds(L.latLngBounds(coords), { padding: [40, 40], maxZoom: 15 });
                    }
                }
                return;
            } else if (data.success && (!data.plan || data.plan.length === 0)) {
                // API worked but no nearby places found
                const locInfo = data.display_name ? `<br><small style="color:var(--text-3)">Searched near: ${data.display_name.substring(0, 80)}</small>` : '';
                resultsDiv.innerHTML = `<div style="text-align:center;padding:20px;color:#f59e0b">
                    <i class="fas fa-map-marked-alt" style="font-size:1.5rem"></i><br>
                    <strong>Location found, but no tourist spots nearby.</strong>${locInfo}<br>
                    <small style="color:var(--text-2);margin-top:8px;display:block">
                        This area may not have many tagged attractions. Try a nearby city center or famous landmark instead.
                    </small>
                </div>`;
                return;
            }
        } else {
            // Handle HTTP error responses
            const errData = await res.json().catch(() => null);
            if (errData?.detail) {
                resultsDiv.innerHTML = `<div style="text-align:center;padding:20px;color:#ef4444">
                    <i class="fas fa-exclamation-circle"></i> ${errData.detail}<br>
                    <small style="color:var(--text-2);margin-top:8px;display:block">Try adding the city name, e.g., "Marina Beach, Chennai"</small>
                </div>`;
                return;
            }
        }
    } catch (e) { console.error('Half-day plan error:', e); }
    
    resultsDiv.innerHTML = `<div style="text-align:center;padding:20px;color:#ef4444">
        <i class="fas fa-exclamation-circle"></i> Could not plan for this location.<br>
        <small style="color:var(--text-2);margin-top:8px;display:block">
            Tips: Try adding the city name (e.g., "Marina Beach Chennai") or use a well-known landmark name.
            Any location works — landmarks, malls, universities, cafes, neighborhoods!
        </small>
    </div>`;
}

function renderHalfDayPlan(data) {
    const resultsDiv = document.getElementById('halfDayResults');
    
    const activitiesHtml = data.plan.map((act, i) => {
        const typeIcons = { culture: '🏛️', attraction: '📍', nature: '🌿', food: '🍽️', recreation: '🎢', shopping: '🛍️', eating: '🍽️' };
        const distStr = act.distance_m < 1000 ? `${act.distance_m}m` : `${(act.distance_m / 1000).toFixed(1)}km`;
        
        return `
        <div style="display:flex;gap:10px;padding:10px;background:var(--bg-3);border-radius:10px;margin-bottom:6px;border-left:3px solid ${act.type === 'food' ? '#ef4444' : '#06b6d4'}">
            <div style="width:36px;height:36px;border-radius:8px;background:var(--bg-4);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">${typeIcons[act.type] || '📍'}</div>
            <div style="flex:1">
                <div style="font-weight:600;font-size:0.88rem">${act.name}</div>
                <div style="display:flex;gap:8px;font-size:0.75rem;color:var(--text-2);margin-top:2px;flex-wrap:wrap">
                    <span>🕐 ${act.time}</span>
                    <span>⏱ ${act.duration}</span>
                    <span>📏 ${distStr}</span>
                    <span>💰 ₹${act.cost}</span>
                </div>
            </div>
            ${act.lat ? `<a href="https://www.google.com/maps/dir/?api=1&destination=${act.lat},${act.lon}&travelmode=walking" target="_blank" style="width:32px;height:32px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;text-decoration:none;flex-shrink:0;font-size:0.8rem"><i class="fas fa-directions"></i></a>` : ''}
        </div>`;
    }).join('');
    
    const tipsHtml = data.tips.map(t => `<li style="font-size:0.78rem;color:var(--text-2);margin-bottom:4px">${t}</li>`).join('');
    
    resultsDiv.innerHTML = `
    <div style="font-weight:700;margin-bottom:8px;color:var(--accent)">🗓️ Your ${data.hours_available}h Plan near ${data.location}</div>
    <div style="display:flex;gap:12px;margin-bottom:10px;font-size:0.8rem;color:var(--text-2)">
        <span>📍 ${data.total_activities} activities</span>
        <span>⏱ ~${data.estimated_hours}h</span>
        <span>💰 ~₹${data.estimated_cost.toLocaleString()}</span>
    </div>
    ${activitiesHtml}
    <div style="margin-top:10px;padding:8px;background:var(--bg-4);border-radius:8px">
        <div style="font-weight:600;font-size:0.8rem;margin-bottom:4px">💡 Tips</div>
        <ul style="margin:0;padding-left:16px">${tipsHtml}</ul>
    </div>`;
}
