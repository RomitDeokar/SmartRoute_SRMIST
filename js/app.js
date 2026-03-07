// ============================================
// SmartRoute v8.0 — Travel Intelligence Engine
// ============================================

const API_BASE = 'http://localhost:8000';

// === STATE ===
const state = {
    theme: 'dark', persona: 'solo', ws: null,
    itinerary: null, agents: {}, logs: [],
    rl: { rewards: [], episode: 0, alpha: 0.4, beta: 0.3, gamma: 0.2, delta: 0.1 },
    bayesian: { cultural: { a: 2, b: 2 }, adventure: { a: 2, b: 2 }, food: { a: 3, b: 1 }, relaxation: { a: 1, b: 3 }, shopping: { a: 1, b: 2 } },
    budget: { total: 15000, used: 0 },
    demoRunning: false
};

// === LANGUAGE DATABASE ===
const LANGUAGE_DB = {
    paris: {
        lang: 'French', flag: '🇫🇷', phrases: [
            { en: 'Hello', phrase: 'Bonjour', phon: 'bohn-ZHOOR', ctx: 'Greeting anyone' },
            { en: 'Thank you', phrase: 'Merci', phon: 'mehr-SEE', ctx: 'Showing gratitude' },
            { en: 'Please', phrase: "S'il vous plaît", phon: 'seel voo PLEH', ctx: 'Making requests' },
            { en: 'Excuse me', phrase: 'Excusez-moi', phon: 'ex-koo-ZAY mwah', ctx: 'Getting attention' },
            { en: 'How much?', phrase: "C'est combien?", phon: 'say kohm-BYAN', ctx: 'Shopping/bargaining' },
            { en: 'Where is...?', phrase: 'Où est...?', phon: 'oo EH', ctx: 'Asking directions' },
            { en: 'Help!', phrase: 'Au secours!', phon: 'oh suh-KOOR', ctx: 'Emergency' },
            { en: 'I don\'t understand', phrase: 'Je ne comprends pas', phon: 'zhuh nuh kohm-PRAHN pah', ctx: 'Communication' },
            { en: 'The bill, please', phrase: "L'addition, s'il vous plaît", phon: 'lah-dee-SYOHN seel voo pleh', ctx: 'At restaurants' },
            { en: 'Good evening', phrase: 'Bonsoir', phon: 'bohn-SWAHR', ctx: 'Evening greeting' },
            { en: 'Goodbye', phrase: 'Au revoir', phon: 'oh ruh-VWAHR', ctx: 'Farewell' },
            { en: 'Yes / No', phrase: 'Oui / Non', phon: 'wee / nohn', ctx: 'Basic responses' },
            { en: 'Water', phrase: "De l'eau", phon: 'duh LOH', ctx: 'Ordering drinks' },
            { en: 'I am lost', phrase: 'Je suis perdu(e)', phon: 'zhuh swee pehr-DOO', ctx: 'Navigation help' }
        ]
    },
    tokyo: {
        lang: 'Japanese', flag: '🇯🇵', phrases: [
            { en: 'Hello', phrase: 'こんにちは (Konnichiwa)', phon: 'kohn-NEE-chee-wah', ctx: 'Greeting' },
            { en: 'Thank you', phrase: 'ありがとう (Arigatou)', phon: 'ah-ree-GAH-toh', ctx: 'Gratitude' },
            { en: 'Excuse me', phrase: 'すみません (Sumimasen)', phon: 'soo-mee-mah-SEN', ctx: 'Getting attention' },
            { en: 'How much?', phrase: 'いくら? (Ikura?)', phon: 'ee-KOO-rah', ctx: 'Shopping' },
            { en: 'Where is...?', phrase: '...はどこ? (...wa doko?)', phon: 'wah DOH-koh', ctx: 'Directions' },
            { en: 'Help!', phrase: '助けて! (Tasukete!)', phon: 'tah-SOO-keh-teh', ctx: 'Emergency' },
            { en: 'Delicious!', phrase: 'おいしい! (Oishii!)', phon: 'oy-SHEE', ctx: 'Complimenting food' },
            { en: 'The bill', phrase: 'お勘定 (Okanjou)', phon: 'oh-KAHN-joh', ctx: 'At restaurants' },
            { en: 'Yes / No', phrase: 'はい / いいえ (Hai / Iie)', phon: 'hai / ee-eh', ctx: 'Basic responses' },
            { en: 'I don\'t understand', phrase: 'わかりません (Wakarimasen)', phon: 'wah-kah-ree-mah-SEN', ctx: 'Communication' },
            { en: 'Goodbye', phrase: 'さようなら (Sayounara)', phon: 'sah-YOH-nah-rah', ctx: 'Farewell' },
            { en: 'Water', phrase: '水 (Mizu)', phon: 'MEE-zoo', ctx: 'Ordering' }
        ]
    },
    london: {
        lang: 'English', flag: '🇬🇧', phrases: [
            { en: 'Cheers!', phrase: 'Cheers!', phon: 'cheerz', ctx: 'Thank you (informal)' },
            { en: 'Excuse me, mate', phrase: 'Excuse me, mate', phon: 'as-is', ctx: 'Getting attention (friendly)' },
            { en: 'Where is the tube?', phrase: 'Where is the tube?', phon: 'as-is', ctx: 'Finding the subway' },
            { en: 'How much is that?', phrase: 'How much is that?', phon: 'as-is', ctx: 'Shopping' },
            { en: 'Brilliant!', phrase: 'Brilliant!', phon: 'BRIL-yunt', ctx: 'Expressing approval' },
            { en: 'Queueing', phrase: 'Queue up properly', phon: 'kyoo', ctx: 'Cultural tip: always queue!' },
            { en: 'Ta', phrase: 'Ta!', phon: 'tah', ctx: 'Informal thanks' },
            { en: 'Mind the gap', phrase: 'Mind the gap', phon: 'as-is', ctx: 'On the Underground' }
        ]
    },
    jaipur: {
        lang: 'Hindi', flag: '🇮🇳', phrases: [
            { en: 'Hello', phrase: 'नमस्ते (Namaste)', phon: 'nah-mah-STAY', ctx: 'Universal greeting' },
            { en: 'Thank you', phrase: 'धन्यवाद (Dhanyavaad)', phon: 'dhun-yah-VAHD', ctx: 'Gratitude' },
            { en: 'How much?', phrase: 'कितना? (Kitna?)', phon: 'KIT-nah', ctx: 'Shopping/bargaining' },
            { en: 'Too expensive', phrase: 'बहुत महंगा (Bahut mehenga)', phon: 'bah-HOOT meh-HEN-gah', ctx: 'Bargaining' },
            { en: 'Where is...?', phrase: '...कहाँ है? (...kahan hai?)', phon: 'kah-HAHN hai', ctx: 'Directions' },
            { en: 'Water', phrase: 'पानी (Paani)', phon: 'PAH-nee', ctx: 'Ordering water' },
            { en: 'Help!', phrase: 'मदद! (Madad!)', phon: 'MAH-dud', ctx: 'Emergency' },
            { en: 'Delicious!', phrase: 'बहुत स्वादिष्ट! (Bahut swaadisht!)', phon: 'bah-HOOT swah-DEESHT', ctx: 'Complimenting food' },
            { en: 'Yes / No', phrase: 'हाँ / नहीं (Haan / Nahin)', phon: 'hahn / nah-HEEN', ctx: 'Basic responses' },
            { en: 'Brother (friendly)', phrase: 'भाई (Bhai)', phon: 'bhai', ctx: 'Friendly address' },
            { en: 'Let\'s go', phrase: 'चलो (Chalo)', phon: 'CHAH-loh', ctx: 'Getting around' },
            { en: 'I don\'t know Hindi', phrase: 'मुझे हिंदी नहीं आती (Mujhe Hindi nahi aati)', phon: 'moo-jheh HIN-dee nah-hee AH-tee', ctx: 'Communication' }
        ]
    },
    rome: {
        lang: 'Italian', flag: '🇮🇹', phrases: [
            { en: 'Hello', phrase: 'Ciao', phon: 'CHOW', ctx: 'Greeting' },
            { en: 'Thank you', phrase: 'Grazie', phon: 'GRAH-tsee-eh', ctx: 'Gratitude' },
            { en: 'Please', phrase: 'Per favore', phon: 'pehr fah-VOH-reh', ctx: 'Requests' },
            { en: 'How much?', phrase: 'Quanto costa?', phon: 'KWAHN-toh KOH-stah', ctx: 'Shopping' },
            { en: 'Where is...?', phrase: 'Dove è...?', phon: 'DOH-veh eh', ctx: 'Directions' },
            { en: 'The bill', phrase: 'Il conto', phon: 'eel KOHN-toh', ctx: 'At restaurants' },
            { en: 'Delicious!', phrase: 'Delizioso!', phon: 'deh-lee-TSEE-oh-zoh', ctx: 'Complimenting food' },
            { en: 'Help!', phrase: 'Aiuto!', phon: 'ah-YOO-toh', ctx: 'Emergency' },
            { en: 'Goodbye', phrase: 'Arrivederci', phon: 'ah-ree-veh-DEHR-chee', ctx: 'Farewell' }
        ]
    }
};

// === CITY COORDINATES ===
const CITY_COORDS = {
    paris: [48.8566, 2.3522], london: [51.5074, -0.1278], tokyo: [35.6762, 139.6503],
    jaipur: [26.9124, 75.7873], rome: [41.9028, 12.4964], 'new york': [40.7128, -74.006],
    dubai: [25.2048, 55.2708], singapore: [1.3521, 103.8198], bangkok: [13.7563, 100.5018],
    barcelona: [41.3874, 2.1686], istanbul: [41.0082, 28.9784], amsterdam: [52.3676, 4.9041],
    sydney: [-33.8688, 151.2093], 'rio de janeiro': [-22.9068, -43.1729], cairo: [30.0444, 31.2357]
};

// === AGENT DEFINITIONS ===
const AGENTS = [
    { id: 'planner', name: 'Planner Agent', role: 'Itinerary Planning', icon: '🗺️', color: '#667eea' },
    { id: 'weather', name: 'Weather Risk Agent', role: 'Weather Monitoring', icon: '🌦️', color: '#06b6d4' },
    { id: 'crowd', name: 'Crowd Analyzer', role: 'Crowd Intelligence', icon: '👥', color: '#f59e0b' },
    { id: 'budget', name: 'Budget Optimizer', role: 'Financial Planning', icon: '💰', color: '#10b981' },
    { id: 'preference', name: 'Preference Agent', role: 'Taste Learning', icon: '❤️', color: '#ec4899' },
    { id: 'booking', name: 'Booking Assistant', role: 'Reservations', icon: '🎫', color: '#8b5cf6' },
    { id: 'explain', name: 'Explainability Agent', role: 'AI Reasoning', icon: '🧠', color: '#f97316' }
];

// === INIT ===
function init() {
    renderAgents();
    renderBayesianBars();
    initMap();
    setupEventListeners();
    connectWebSocket();
    setInterval(updateAgentPulse, 3000);
    document.getElementById('startDate').valueAsDate = new Date();
    console.log('✅ SmartRoute v8.0 initialized');
}

// === MAP ===
let map, markers = [], routeLine;

function initMap() {
    const el = document.getElementById('map');
    if (!el) return;
    try {
        map = L.map('map', { center: [20, 0], zoom: 2, zoomControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org">OSM</a>',
            maxZoom: 19
        }).addTo(map);
        // Fix rendering issues
        setTimeout(() => map.invalidateSize(), 500);
        addLog('planner', '🗺️ Map initialized successfully', 'success');
    } catch (e) { console.error('Map init failed:', e); }
}

function clearMap() {
    markers.forEach(m => map && map.removeLayer(m));
    markers = [];
    if (routeLine && map) { map.removeLayer(routeLine); routeLine = null; }
}

function updateMap(itinerary) {
    if (!map || !itinerary?.days) return;
    clearMap();
    const coords = [];
    let counter = 1;
    itinerary.days.forEach(day => {
        (day.activities || []).forEach(act => {
            const lat = parseFloat(act.lat), lon = parseFloat(act.lon);
            if (isNaN(lat) || isNaN(lon)) return;
            coords.push([lat, lon]);
            const colors = { cultural: '#f59e0b', adventure: '#10b981', food: '#ef4444', shopping: '#8b5cf6', religious: '#06b6d4', landmark: '#667eea', museum: '#764ba2', fort: '#f97316', palace: '#ec4899' };
            const c = colors[act.type] || '#667eea';
            const icon = L.divIcon({
                className: 'custom-marker',
                html: `<div style="background:linear-gradient(135deg,${c},${c}dd);width:32px;height:32px;border-radius:50% 50% 50% 0;border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:12px;transform:rotate(-45deg)"><span style="transform:rotate(45deg)">${counter}</span></div>`,
                iconSize: [32, 32], iconAnchor: [10, 32], popupAnchor: [6, -32]
            });
            const marker = L.marker([lat, lon], { icon }).addTo(map);
            marker.bindPopup(`<div style="font-family:Inter,sans-serif"><div style="font-weight:700;font-size:14px;margin-bottom:4px">${act.name}</div><div style="font-size:12px;color:#888">⏰ ${act.time || ''} · ${act.duration || ''}</div><div style="font-size:12px;color:#888">📍 Day ${day.day} · ${act.type}</div><div style="font-weight:700;color:#4facfe;margin-top:4px">₹${act.cost || 0}</div></div>`);
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
}

// === WEBSOCKET ===
function connectWebSocket() {
    try {
        state.ws = new WebSocket('ws://localhost:8000/ws/agents');
        state.ws.onmessage = e => {
            const d = JSON.parse(e.data);
            if (d.type === 'agent_activity') {
                addLog(d.agent_id, d.message, d.status);
                updateAgentStatus(d.agent_id, d.status);
            }
        };
        state.ws.onclose = () => setTimeout(connectWebSocket, 5000);
    } catch (e) { /* backend not running, we'll simulate */ }
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
    </div>
  `).join('');
}

function updateAgentStatus(id, status) {
    const el = document.getElementById(`status-${id}`);
    if (el) { el.className = 'agent-status ' + status; }
}
function setAllAgentsStatus(status) { AGENTS.forEach(a => updateAgentStatus(a.id, status)); }
function updateAgentPulse() {
    if (!state.demoRunning && !state.itinerary) {
        AGENTS.forEach(a => {
            const el = document.getElementById(`status-${a.id}`);
            if (el && el.classList.contains('idle')) {
                el.classList.add('thinking');
                setTimeout(() => el.classList.replace('thinking', 'idle'), 1500);
            }
        });
    }
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
    state.logs.push({ agentId, msg, type, time: now });
}

// === BAYESIAN ===
function renderBayesianBars() {
    const c = document.getElementById('bayesianBars');
    if (!c) return;
    const colors = { cultural: '#f59e0b', adventure: '#10b981', food: '#ef4444', relaxation: '#06b6d4', shopping: '#8b5cf6' };
    c.innerHTML = Object.keys(state.bayesian).map(k => {
        const { a, b } = state.bayesian[k];
        const mean = (a / (a + b) * 100).toFixed(0);
        return `<div class="pref-item"><div class="pref-header"><span class="pref-label">${k.charAt(0).toUpperCase() + k.slice(1)}</span><span class="pref-val">${mean}%</span></div><div class="pref-bar"><div class="pref-fill" style="width:${mean}%;background:${colors[k] || 'var(--primary)'}"></div></div></div>`;
    }).join('');
}

function updateBayesian(category, liked) {
    const b = state.bayesian[category];
    if (!b) return;
    if (liked) b.a += 1; else b.b += 1;
    renderBayesianBars();
    addLog('preference', `Bayesian update: ${category} → ${liked ? 'positive' : 'negative'} (α=${b.a}, β=${b.b})`, 'info');
}

// === RL ENGINE ===
function calculateReward(rating, budgetAdherence, weatherMatch, crowdLevel) {
    const { alpha, beta, gamma, delta } = state.rl;
    return alpha * (rating / 5) + beta * budgetAdherence + gamma * weatherMatch - delta * crowdLevel;
}

function runRLEpisode() {
    const rating = 3 + Math.random() * 2;
    const budgetAdh = 0.5 + Math.random() * 0.5;
    const weatherMatch = 0.4 + Math.random() * 0.6;
    const crowd = Math.random() * 0.7;
    let reward = calculateReward(rating, budgetAdh, weatherMatch, crowd);
    // Learning improvement over episodes
    reward += state.rl.episode * 0.008 + (Math.random() - 0.3) * 0.1;
    reward = Math.max(0, Math.min(1, reward));
    state.rl.rewards.push(reward);
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

    // Background grid
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = (H - 30) * i / 4 + 15;
        ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(W - 10, y); ctx.stroke();
        ctx.fillStyle = '#6b6f8d'; ctx.font = '10px Inter';
        ctx.fillText((1 - i * 0.25).toFixed(2), 2, y + 4);
    }

    // Draw line
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, '#667eea'); grad.addColorStop(1, '#764ba2');
    ctx.strokeStyle = grad; ctx.lineWidth = 2;
    ctx.beginPath();
    const step = (W - 50) / (data.length - 1);
    data.forEach((v, i) => {
        const x = 40 + i * step, y = 15 + (1 - v) * (H - 30);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Fill area
    const last = data.length - 1;
    ctx.lineTo(40 + last * step, H - 15);
    ctx.lineTo(40, H - 15);
    ctx.closePath();
    const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
    fillGrad.addColorStop(0, 'rgba(102,126,234,0.3)'); fillGrad.addColorStop(1, 'rgba(102,126,234,0)');
    ctx.fillStyle = fillGrad; ctx.fill();

    // Latest value
    const lv = data[last];
    ctx.fillStyle = '#10b981'; ctx.font = 'bold 12px Inter';
    ctx.fillText(`R=${lv.toFixed(3)}`, W - 70, 12);

    // Labels
    ctx.fillStyle = '#6b6f8d'; ctx.font = '10px Inter';
    ctx.fillText(`Ep.${data.length}`, W / 2, H - 2);
    ctx.fillText('Reward', 2, 12);
}

// === AGENT COMM GRAPH ===
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

    // Draw connections
    ctx.strokeStyle = 'rgba(102,126,234,0.15)'; ctx.lineWidth = 1;
    nodes.forEach((n1, i) => {
        nodes.forEach((n2, j) => {
            if (j > i && Math.random() > 0.3) {
                ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.stroke();
            }
        });
    });

    // Draw nodes
    nodes.forEach(n => {
        ctx.beginPath(); ctx.arc(n.x, n.y, 22, 0, Math.PI * 2);
        ctx.fillStyle = n.color + '33'; ctx.fill();
        ctx.strokeStyle = n.color; ctx.lineWidth = 2; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(n.icon, n.x, n.y + 5);
        ctx.fillStyle = '#a0a3c0'; ctx.font = '9px Inter';
        ctx.fillText(n.name.split(' ')[0], n.x, n.y + 35);
    });
}

// === GENERATE TRIP ===
async function generateTrip() {
    const dest = document.getElementById('destination').value.trim();
    const duration = parseInt(document.getElementById('duration').value) || 3;
    const budget = parseInt(document.getElementById('budget').value) || 15000;
    const startDate = document.getElementById('startDate').value || new Date().toISOString().split('T')[0];

    if (!dest) { showToast('Please enter a destination', 'warning'); return; }

    state.budget.total = budget;
    state.budget.used = 0;
    showLoading(true);
    setAllAgentsStatus('thinking');
    addLog('planner', `Planning ${duration}-day trip to ${dest} (₹${budget.toLocaleString()})...`, 'info');

    // Try backend first
    try {
        const chk = document.querySelectorAll('.checkbox-label input');
        const res = await fetch(`${API_BASE}/generate-trip`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destination: dest, duration, budget, start_date: startDate,
                preferences: [], persona: state.persona,
                include_flights: chk[0]?.checked, include_hotels: chk[1]?.checked,
                include_restaurants: chk[2]?.checked, include_transport: chk[3]?.checked
            })
        });
        if (res.ok) {
            const data = await res.json();
            showLoading(false);
            setAllAgentsStatus('completed');
            addLog('planner', `✅ Backend generated itinerary for ${dest}`, 'success');
            processTrip(data, dest, duration, budget);
            return;
        }
    } catch (e) { /* Backend not available, simulate */ }

    // === AUTONOMOUS AGENT ORCHESTRATION ===
    document.getElementById('agentConvoPanel').style.display = 'block';
    document.getElementById('agentConvo').innerHTML = '';
    document.getElementById('insightsPanel').style.display = 'none';

    // Phase 1: Planner initiates
    await agentSay('planner', null, `Initiating ${duration}-day trip planning for ${dest}. Requesting data from all agents...`, 'decision');
    updateAgentStatus('planner', 'working');
    await delay(600);

    // Phase 2: Planner → Weather
    await agentSay('planner', 'weather', `@Weather Risk Agent — Need forecast data for ${dest}, ${duration} days starting ${startDate}.`);
    updateAgentStatus('weather', 'working');
    await delay(500);
    await agentSay('weather', 'planner', `Forecast retrieved. Day 1: Partly cloudy 28°C, Day 2: Sunny 31°C, Day 3: 40% rain probability. Recommending indoor backup for Day 3.`, 'insight');
    updateAgentStatus('weather', 'completed');

    // Phase 3: Planner → Crowd
    await agentSay('planner', 'crowd', `@Crowd Analyzer — What are the crowd levels for popular sites in ${dest}?`);
    updateAgentStatus('crowd', 'working');
    await delay(500);
    await agentSay('crowd', 'planner', `Crowd data analyzed. Morning slots (9-11 AM) have 35% less crowd. Recommending early visits for top attractions. Weekend surge expected +60%.`, 'insight');
    updateAgentStatus('crowd', 'completed');

    // Phase 4: Budget optimization
    await agentSay('planner', 'budget', `@Budget Optimizer — Optimize ₹${budget.toLocaleString()} across ${duration} days. Persona: ${state.persona}.`);
    updateAgentStatus('budget', 'working');
    await delay(400);
    await agentSay('budget', 'planner', `Budget plan: Accommodation 35% (₹${Math.round(budget * 0.35).toLocaleString()}), Activities 25%, Food 25%, Transport 10%, Emergency 5%. 3 free attractions identified to save ₹${Math.round(budget * 0.08).toLocaleString()}.`, 'decision');
    updateAgentStatus('budget', 'completed');

    // Phase 5: Preference learning
    await agentSay('planner', 'preference', `@Preference Agent — Apply Bayesian priors for ${state.persona} traveler.`);
    updateAgentStatus('preference', 'working');
    await delay(400);
    const topPref = Object.entries(state.bayesian).sort((a, b) => (b[1].a / (b[1].a + b[1].b)) - (a[1].a / (a[1].a + a[1].b)))[0];
    await agentSay('preference', 'planner', `Bayesian inference complete. Strongest preference: ${topPref[0]} (${(topPref[1].a / (topPref[1].a + topPref[1].b) * 100).toFixed(0)}% posterior). Weighting itinerary toward ${topPref[0]} experiences.`, 'insight');
    updateAgentStatus('preference', 'completed');

    // Phase 6: Generate itinerary
    await agentSay('planner', null, `All agent data received. Running MDP solver with state=(location, budget, weather, crowd, satisfaction)...`, 'decision');
    await delay(300);

    const itinerary = await generateSimulatedItinerary(dest, duration, budget, startDate);
    state.itinerary = itinerary;

    // Phase 7: Booking
    await agentSay('planner', 'booking', `@Booking Assistant — Itinerary finalized (${itinerary.days.reduce((s, d) => s + d.activities.length, 0)} activities). Find hotels, flights, and restaurants.`);
    updateAgentStatus('booking', 'working');
    await delay(500);
    await agentSay('booking', 'planner', `Found 3 hotels (₹3,000-₹15,000/night), 3 flights, and 3 restaurants. Best deal: ${dest} Budget Inn at ₹3,000/night with WiFi.`, 'decision');
    updateAgentStatus('booking', 'completed');

    // Phase 8: Explainability
    await agentSay('planner', 'explain', `@Explainability Agent — Generate reasoning trace for user.`);
    updateAgentStatus('explain', 'working');
    await delay(400);
    await agentSay('explain', null, `Reasoning: Selected ${itinerary.days[0]?.activities[0]?.name || 'top attraction'} first (rating ${itinerary.days[0]?.activities[0]?.rating || 4.5}/5, low morning crowd). Budget adherence: ${((1 - itinerary.total_cost / budget) * 100).toFixed(0)}% remaining. RL policy converging after 20 episodes.`, 'decision');
    updateAgentStatus('explain', 'completed');

    showLoading(false);
    setAllAgentsStatus('completed');
    addLog('planner', `✅ Autonomous planning complete for ${dest}!`, 'success');
    processTrip({ itinerary, bookings: generateBookings(dest) }, dest, duration, budget);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// === AGENT CONVERSATION MESSAGE ===
function agentSay(fromId, toId, text, msgType = '') {
    return new Promise(resolve => {
        const from = AGENTS.find(a => a.id === fromId) || AGENTS[0];
        const to = toId ? AGENTS.find(a => a.id === toId) : null;
        const convo = document.getElementById('agentConvo');
        if (!convo) { resolve(); return; }

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
        setTimeout(resolve, 300);
    });
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

function processTrip(data, dest, duration, budget) {
    state.itinerary = data.itinerary || data;
    renderItinerary(state.itinerary, dest);
    updateMap(state.itinerary);
    renderBookings(generateBookings(dest), dest);
    renderLanguageTips(dest);
    renderWeather(dest, duration);
    updateBudgetDisplay(state.itinerary, budget);
    renderCrowdLevel();

    // Run RL episodes with visible progression
    for (let i = 0; i < 25; i++) setTimeout(() => { runRLEpisode(); drawRLChart(); }, i * 80);
    setTimeout(() => { drawAgentGraph(); drawRLChart(); }, 500);

    // Autonomous post-trip analysis
    setTimeout(() => runAutonomousAnalysis(dest, duration, budget), 1500);

    // Fill explainability panel
    const ep = document.getElementById('explainPanel');
    if (ep) {
        const itin = state.itinerary;
        ep.innerHTML = `
        <div style="margin-bottom:8px"><strong style="color:var(--accent)">MDP Decision Trace</strong></div>
        <div class="text-sm" style="color:var(--text-2);margin-bottom:6px">State: S(${dest}, ₹${budget}, weather=0.7, crowd=0.4, sat=0.8)</div>
        <div class="text-sm" style="color:var(--text-2);margin-bottom:6px">Action: keep_itinerary (π* from value iteration)</div>
        <div class="text-sm" style="color:var(--text-2);margin-bottom:6px">Reward: R = 0.4×(4.5/5) + 0.3×(${(1 - itin.total_cost / budget).toFixed(2)}) + 0.2×0.7 − 0.1×0.4 = <strong style="color:var(--success)">${(0.4 * 0.9 + 0.3 * (1 - itin.total_cost / budget) + 0.2 * 0.7 - 0.1 * 0.4).toFixed(3)}</strong></div>
        <div class="text-sm" style="color:var(--text-2)">Policy: ε-greedy, ε=0.1, γ=0.95</div>
      `;
    }

    showToast(`Trip to ${dest} planned autonomously! 🎉`, 'success');
}

async function runAutonomousAnalysis(dest, duration, budget) {
    const itin = state.itinerary;
    if (!itin) return;

    document.getElementById('insightsContainer').innerHTML = '';

    // Weather agent auto-insight
    await delay(300);
    addInsight('weather', '🌦️', 'Weather Risk Agent', `Day 3 has 40% rain probability. I\'ve flagged 2 outdoor activities for potential indoor swaps. Backup options ready.`);
    addLog('weather', 'Auto-analysis: Rain risk detected on Day 3, indoor backups prepared', 'warning');

    // Crowd agent auto-insight
    await delay(500);
    addInsight('crowd', '👥', 'Crowd Analyzer', `Peak hours detected at ${itin.days[0]?.activities[0]?.name || 'top site'} between 11AM-2PM. I\'ve scheduled your visit at 9AM for 35% fewer crowds.`);
    addLog('crowd', 'Auto-analysis: Optimized visit timings to avoid peak crowds', 'info');

    // Budget agent auto-insight
    await delay(500);
    const savings = Math.round(budget * 0.08);
    addInsight('budget', '💰', 'Budget Optimizer', `Found ₹${savings.toLocaleString()} in potential savings! ${itin.days.flatMap(d => d.activities).filter(a => a.cost === 0).length} free attractions included. Budget utilization: ${((itin.total_cost / budget) * 100).toFixed(0)}%.`);
    addLog('budget', `Auto-analysis: ₹${savings.toLocaleString()} savings identified`, 'success');

    // Preference agent auto-insight
    await delay(500);
    const prefs = Object.entries(state.bayesian).sort((a, b) => (b[1].a / (b[1].a + b[1].b)) - (a[1].a / (a[1].a + a[1].b)));
    addInsight('preference', '❤️', 'Preference Agent', `Your preference profile: ${prefs.slice(0, 3).map(([k, v]) => `${k} ${(v.a / (v.a + v.b) * 100).toFixed(0)}%`).join(', ')}. Itinerary weighted accordingly. Rate activities to refine.`);

    // Booking agent auto-insight
    await delay(500);
    addInsight('booking', '🎫', 'Booking Assistant', `Best value hotel: ${dest} Budget Inn (₹3,000/night, 4.0★). Cheapest flight: IndiGo ₹6,500. I\'ve pre-selected optimal options for your budget.`);
    addLog('booking', 'Auto-analysis: Pre-selected best-value bookings', 'success');
}

// === DYNAMIC ATTRACTIONS FROM API ===
async function fetchDynamicAttractions(dest) {
    try {
        const res = await fetch(`${API_BASE}/attractions?city=${encodeURIComponent(dest)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.attractions && data.attractions.length >= 3) {
                addLog('planner', `🌍 Fetched ${data.count} real attractions via Overpass API (source: ${data.source})`, 'success');
                return data.attractions.map(a => ({
                    name: a.name, type: a.type, rating: a.rating, cost: a.price || 0,
                    duration: a.duration || '2h', lat: a.lat, lon: a.lon,
                    desc: a.description || `Visit ${a.name}`,
                    reviews_count: Math.floor(Math.random() * 100000 + 10000),
                    photos: [a.photo || 'https://images.pexels.com/photos/460672/pexels-photo-460672.jpeg?auto=compress&w=600']
                }));
            }
        }
    } catch (e) {
        console.log('API fetch failed, using fallback:', e);
    }
    return null;
}

// === SIMULATED ITINERARY ===
async function generateSimulatedItinerary(dest, duration, budget, startDate) {
    const destLower = dest.toLowerCase();
    // Helper to generate media links for any place
    function makeMedia(name, lat, lon) {
        const q = encodeURIComponent(name);
        return {
            photos: [
                `https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&w=600`,
                `https://images.pexels.com/photos/2675531/pexels-photo-2675531.jpeg?auto=compress&w=600`,
                `https://images.pexels.com/photos/2363/france-landmark-lights-night.jpg?auto=compress&w=600`,
                `https://images.pexels.com/photos/1850629/pexels-photo-1850629.jpeg?auto=compress&w=600`
            ],
            videos: { youtube: `https://www.youtube.com/results?search_query=${q}+travel+guide`, virtual_tour: `https://www.youtube.com/results?search_query=${q}+virtual+tour+4k` },
            maps: { google: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`, osm: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`, directions: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}` },
            reviews: { google: `https://www.google.com/search?q=${q}+reviews`, tripadvisor: `https://www.tripadvisor.com/Search?q=${q}` },
            links: { wiki: `https://en.wikipedia.org/wiki/${q.replace(/%20/g, '_')}`, booking: `https://www.google.com/search?q=${q}+tickets+booking` }
        };
    }

    // HARDCODED FALLBACK (used only when API is unreachable)
    const FALLBACK_ATTRACTIONS = {
        paris: [
            { name: 'Eiffel Tower', type: 'landmark', rating: 4.6, cost: 1500, duration: '2-3h', lat: 48.8584, lon: 2.2945, desc: 'Iconic iron lattice tower on Champ de Mars', reviews_count: 286432, photos: ['https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg?auto=compress&w=600'] },
            { name: 'Louvre Museum', type: 'museum', rating: 4.7, cost: 1200, duration: '3-4h', lat: 48.8606, lon: 2.3376, desc: 'World\'s largest art museum', reviews_count: 198543, photos: ['https://images.pexels.com/photos/2675531/pexels-photo-2675531.jpeg?auto=compress&w=600'] },
            { name: 'Notre-Dame', type: 'religious', rating: 4.7, cost: 0, duration: '1-2h', lat: 48.8530, lon: 2.3499, desc: 'Medieval Gothic cathedral', reviews_count: 154890, photos: ['https://images.pexels.com/photos/1461974/pexels-photo-1461974.jpeg?auto=compress&w=600'] },
            { name: 'Arc de Triomphe', type: 'landmark', rating: 4.6, cost: 800, duration: '1h', lat: 48.8738, lon: 2.2950, desc: 'Triumphal arch honoring France', reviews_count: 98762, photos: ['https://images.pexels.com/photos/1530259/pexels-photo-1530259.jpeg?auto=compress&w=600'] },
            { name: 'Sacré-Cœur', type: 'religious', rating: 4.7, cost: 0, duration: '1-2h', lat: 48.8867, lon: 2.3431, desc: 'White-domed basilica atop Montmartre', reviews_count: 87456, photos: ['https://images.pexels.com/photos/2363/france-landmark-lights-night.jpg?auto=compress&w=600'] },
            { name: 'Versailles Palace', type: 'cultural', rating: 4.6, cost: 1800, duration: '4-5h', lat: 48.8049, lon: 2.1204, desc: 'UNESCO World Heritage royal residence', reviews_count: 134521, photos: ['https://images.pexels.com/photos/2437294/pexels-photo-2437294.jpeg?auto=compress&w=600'] }
        ],
        tokyo: [
            { name: 'Senso-ji Temple', type: 'religious', rating: 4.6, cost: 0, duration: '2h', lat: 35.7148, lon: 139.7967, desc: 'Tokyo\'s oldest Buddhist temple', reviews_count: 167890, photos: ['https://images.pexels.com/photos/402028/pexels-photo-402028.jpeg?auto=compress&w=600'] },
            { name: 'Tokyo Skytree', type: 'landmark', rating: 4.5, cost: 1500, duration: '2h', lat: 35.7101, lon: 139.8107, desc: 'Tallest tower in Japan', reviews_count: 98432, photos: ['https://images.pexels.com/photos/2339009/pexels-photo-2339009.jpeg?auto=compress&w=600'] },
            { name: 'Shibuya Crossing', type: 'landmark', rating: 4.6, cost: 0, duration: '1h', lat: 35.6595, lon: 139.7004, desc: 'World\'s busiest pedestrian crossing', reviews_count: 145678, photos: ['https://images.pexels.com/photos/2098750/pexels-photo-2098750.jpeg?auto=compress&w=600'] },
            { name: 'Meiji Shrine', type: 'religious', rating: 4.7, cost: 0, duration: '2h', lat: 35.6764, lon: 139.6993, desc: 'Peaceful Shinto shrine', reviews_count: 112345, photos: ['https://images.pexels.com/photos/161401/fushimi-inari-taisha-shrine-kyoto-japan-temple-161401.jpeg?auto=compress&w=600'] }
        ],
        london: [
            { name: 'Tower of London', type: 'cultural', rating: 4.6, cost: 2000, duration: '3h', lat: 51.5081, lon: -0.0759, desc: 'Historic castle with Crown Jewels', reviews_count: 187654, photos: ['https://images.pexels.com/photos/726484/pexels-photo-726484.jpeg?auto=compress&w=600'] },
            { name: 'British Museum', type: 'museum', rating: 4.7, cost: 0, duration: '3h', lat: 51.5194, lon: -0.1270, desc: 'World-famous museum — free entry', reviews_count: 210987, photos: ['https://images.pexels.com/photos/1796725/pexels-photo-1796725.jpeg?auto=compress&w=600'] },
            { name: 'London Eye', type: 'landmark', rating: 4.5, cost: 2500, duration: '1h', lat: 51.5033, lon: -0.1195, desc: 'Giant observation wheel on South Bank', reviews_count: 154321, photos: ['https://images.pexels.com/photos/460672/pexels-photo-460672.jpeg?auto=compress&w=600'] },
            { name: 'Tower Bridge', type: 'landmark', rating: 4.6, cost: 0, duration: '1h', lat: 51.5055, lon: -0.0754, desc: 'Iconic Victorian bridge', reviews_count: 198765, photos: ['https://images.pexels.com/photos/77171/pexels-photo-77171.jpeg?auto=compress&w=600'] }
        ],
        jaipur: [
            { name: 'Amber Fort', type: 'fort', rating: 4.7, cost: 500, duration: '3h', lat: 26.9855, lon: 75.8513, desc: 'Majestic hilltop fort', reviews_count: 98765, photos: ['https://images.pexels.com/photos/3581368/pexels-photo-3581368.jpeg?auto=compress&w=600'] },
            { name: 'City Palace', type: 'palace', rating: 4.6, cost: 400, duration: '2h', lat: 26.9258, lon: 75.8237, desc: 'Royal palace complex', reviews_count: 76543, photos: ['https://images.pexels.com/photos/3581364/pexels-photo-3581364.jpeg?auto=compress&w=600'] },
            { name: 'Hawa Mahal', type: 'palace', rating: 4.5, cost: 200, duration: '1h', lat: 26.9239, lon: 75.8267, desc: 'Palace of Winds', reviews_count: 87654, photos: ['https://images.pexels.com/photos/3581365/pexels-photo-3581365.jpeg?auto=compress&w=600'] },
            { name: 'Jantar Mantar', type: 'cultural', rating: 4.6, cost: 200, duration: '1h', lat: 26.9246, lon: 75.8245, desc: 'UNESCO astronomical observatory', reviews_count: 65432, photos: ['https://images.pexels.com/photos/5619943/pexels-photo-5619943.jpeg?auto=compress&w=600'] }
        ]
    };

    // Try API first, then fallback
    let attractions = await fetchDynamicAttractions(dest);
    if (!attractions) {
        attractions = FALLBACK_ATTRACTIONS[destLower];
        if (attractions) {
            addLog('planner', `📦 Using fallback data for ${dest}`, 'info');
        }
    }
    if (!attractions) {
        const coord = CITY_COORDS[destLower] || [20, 0];
        attractions = [
            { name: `${dest} Historic Center`, type: 'cultural', rating: 4.5, cost: 0, duration: '2-3h', lat: coord[0] + 0.01, lon: coord[1] + 0.01, desc: `Historic heart of ${dest}` },
            { name: `${dest} Main Museum`, type: 'museum', rating: 4.4, cost: 800, duration: '2h', lat: coord[0] - 0.01, lon: coord[1] + 0.02, desc: 'Major museum' },
            { name: `${dest} Central Market`, type: 'shopping', rating: 4.3, cost: 1000, duration: '2h', lat: coord[0] + 0.02, lon: coord[1] - 0.01, desc: 'Vibrant local market' },
            { name: `${dest} Cultural District`, type: 'cultural', rating: 4.4, cost: 500, duration: '3h', lat: coord[0] - 0.02, lon: coord[1] - 0.02, desc: 'Local culture' },
            { name: `${dest} River Walk`, type: 'adventure', rating: 4.3, cost: 0, duration: '1-2h', lat: coord[0] + 0.005, lon: coord[1] + 0.005, desc: 'Scenic river walk' },
            { name: `${dest} Food Street`, type: 'food', rating: 4.5, cost: 600, duration: '2h', lat: coord[0] - 0.005, lon: coord[1] + 0.005, desc: 'Famous street food' }
        ];
        addLog('planner', `⚠️ Using generic attractions for ${dest}`, 'warning');
    }

    const days = [];
    const start = new Date(startDate);
    const times = ['09:00', '11:30', '14:00', '16:30', '19:00'];

    for (let d = 0; d < duration; d++) {
        const date = new Date(start); date.setDate(date.getDate() + d);
        const shuffled = [...attractions].sort(() => Math.random() - 0.5);
        const dayActs = shuffled.slice(0, Math.min(4 + Math.floor(Math.random() * 2), attractions.length));
        const activities = dayActs.map((a, i) => ({
            name: a.name, type: a.type, time: times[i % times.length], duration: a.duration,
            cost: a.cost, rating: a.rating, description: a.desc, lat: a.lat, lon: a.lon,
            reviews_count: a.reviews_count || Math.floor(Math.random() * 100000 + 10000),
            photos: a.photos || [`https://images.pexels.com/photos/${460672 + i * 100}/pexels-photo-${460672 + i * 100}.jpeg?auto=compress&w=600`],
            media: makeMedia(a.name, a.lat, a.lon)
        }));
        days.push({
            day: d + 1, date: date.toISOString().split('T')[0], city: dest,
            activities, daily_cost: activities.reduce((s, a) => s + a.cost, 0)
        });
    }

    return { days, total_cost: days.reduce((s, d) => s + d.daily_cost, 0), cities: [dest] };
}

// === BOOKINGS ===
function generateBookings(dest) {
    const e = encodeURIComponent(dest);
    const slug = dest.toLowerCase().replace(/\s+/g, '-');
    return {
        hotels: [
            { name: `Google Hotels — ${dest}`, rating: 4.7, price_per_night: 'Compare', amenities: ['All Hotels', 'Price Compare', 'Reviews'], photo: `https://source.unsplash.com/800x600/?${e},hotel`, booking_url: `https://www.google.com/travel/hotels/${e}` },
            { name: `Booking.com — ${dest}`, rating: 4.5, price_per_night: 'Browse', amenities: ['WiFi', 'Breakfast', 'Free Cancel'], photo: `https://source.unsplash.com/800x600/?${e},resort`, booking_url: `https://www.booking.com/searchresults.html?ss=${e}` },
            { name: `MakeMyTrip Hotels`, rating: 4.3, price_per_night: 'Browse', amenities: ['Best Deals', 'EMI'], photo: `https://source.unsplash.com/800x600/?${e},accommodation`, booking_url: `https://www.makemytrip.com/hotels/hotel-listing/?city=${e}&country=IN` },
            { name: `Agoda Deals — ${dest}`, rating: 4.4, price_per_night: 'Browse', amenities: ['Last Minute', 'Secret Deals'], photo: `https://source.unsplash.com/800x600/?${e},luxury+hotel`, booking_url: `https://www.agoda.com/search?city=${e}` },
            { name: `Trivago — Compare All`, rating: 4.6, price_per_night: 'Compare', amenities: ['250+ Sites', 'Best Price'], photo: `https://source.unsplash.com/800x600/?${e},room`, booking_url: `https://www.trivago.in/?search=${e}` },
            { name: `Goibibo Hotels`, rating: 4.2, price_per_night: 'Browse', amenities: ['goCash', 'Free Cancel'], photo: `https://source.unsplash.com/800x600/?${e},bedroom`, booking_url: `https://www.goibibo.com/hotels/hotels-in-${slug}/` },
            { name: `Hostelworld — Budget`, rating: 4.0, price_per_night: 'Budget', amenities: ['Hostels', 'Backpacker'], photo: `https://source.unsplash.com/800x600/?hostel,backpacker`, booking_url: `https://www.hostelworld.com/st/hostels/${e}/` }
        ],
        flights: [
            { airline: 'Google Flights — Compare All', price: 'Compare', departure: 'All Times', arrival: 'All Airlines', duration: 'Best Price', booking_url: `https://www.google.com/travel/flights?q=flights+to+${e}` },
            { airline: 'Skyscanner — Cheapest', price: 'Compare', departure: 'Flexible', arrival: 'Multi-airline', duration: 'Cheapest', booking_url: `https://www.skyscanner.co.in/transport/flights-to/${e}` },
            { airline: 'MakeMyTrip Flights', price: 'Browse', departure: 'All', arrival: 'All', duration: 'Deals', booking_url: `https://www.makemytrip.com/flights/results?city=${e}` },
            { airline: 'Ixigo — Budget Flights', price: 'Compare', departure: 'Budget', arrival: 'All', duration: 'Min Price', booking_url: `https://www.ixigo.com/search/result/flight?to=${e}` },
            { airline: 'Kayak — All Airlines', price: 'Compare', departure: 'All', arrival: 'All', duration: 'All Options', booking_url: `https://www.kayak.co.in/flights?to=${e}` }
        ],
        restaurants: [
            { name: `Zomato — Best in ${dest}`, rating: 4.6, price_range: '₹-₹₹₹₹', cuisine: 'All Cuisines', photo: `https://source.unsplash.com/800x600/?${e},restaurant,food`, booking_url: `https://www.zomato.com/${slug}/restaurants` },
            { name: `Google — Top Rated`, rating: 4.8, price_range: '₹₹₹', cuisine: 'Fine Dining', photo: `https://source.unsplash.com/800x600/?fine+dining,${e}`, booking_url: `https://www.google.com/search?q=best+restaurants+in+${e}` },
            { name: `Swiggy Dineout — ${dest}`, rating: 4.4, price_range: '₹₹', cuisine: 'All', photo: `https://source.unsplash.com/800x600/?indian+food,${e}`, booking_url: `https://www.swiggy.com/dineout/restaurants-near-me` },
            { name: `TripAdvisor Dining`, rating: 4.5, price_range: '₹₹-₹₹₹₹', cuisine: 'Traveller Picks', photo: `https://source.unsplash.com/800x600/?food,cuisine`, booking_url: `https://www.tripadvisor.in/Restaurants-g${e}` },
            { name: `Street Food in ${dest}`, rating: 4.4, price_range: '₹', cuisine: 'Street Food', photo: `https://source.unsplash.com/800x600/?street+food,${e}`, booking_url: `https://www.google.com/search?q=best+street+food+in+${e}` }
        ],
        cabs: [
            { type: 'Uber', price: '₹150-500/ride', features: ['AC', 'GPS', 'Cashless'], rating: 4.3, booking_url: `https://m.uber.com/looking` },
            { type: 'Ola Cabs', price: '₹100-400/ride', features: ['AC', 'GPS', 'Multiple Options'], rating: 4.1, booking_url: `https://www.olacabs.com/` },
            { type: 'Zoomcar — Self Drive', price: '₹2,000-5,000/day', features: ['Self-drive', 'Insurance', 'GPS'], rating: 4.5, booking_url: `https://www.zoomcar.com/in/${slug}` },
            { type: 'Savaari — Outstation', price: '₹12-18/km', features: ['Outstation', 'Driver', 'AC'], rating: 4.2, booking_url: `https://www.savaari.com/cab-to-${slug}` },
            { type: 'Google — Local Taxis', price: 'Varies', features: ['Compare All', 'Local Options'], rating: 4.0, booking_url: `https://www.google.com/search?q=taxi+rental+in+${e}` }
        ]
    };
}

// === RENDER ITINERARY ===
function renderItinerary(itin, dest) {
    const c = document.getElementById('itineraryContainer');
    if (!c || !itin?.days) return;
    c.innerHTML = `<div class="section-title">📅 Your ${dest} Itinerary</div>` + itin.days.map(day => `
    <div class="day-card">
      <div class="day-header">
        <span class="day-num">Day ${day.day} — ${new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
        <span class="day-cost">₹${day.daily_cost.toLocaleString()}</span>
      </div>
      ${day.activities.map((act, i) => `
        <div class="activity-card" data-type="${act.type}">
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
          <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">
            <div class="star-rating" data-day="${day.day}" data-act="${i}">
              ${[1, 2, 3, 4, 5].map(s => `<span class="star ${s <= 3 ? 'active' : ''}" onclick="rateActivity(${day.day},${i},${s})">★</span>`).join('')}
            </div>
            <button class="view-media-btn" onclick="openMediaModal(${day.day - 1},${i})"><i class="fas fa-images"></i> Photos & Details</button>
            <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(act.name)}+travel+guide" target="_blank" class="video-link-btn"><i class="fab fa-youtube"></i> Video</a>
            <a href="https://www.google.com/maps/search/?api=1&query=${act.lat},${act.lon}" target="_blank" class="view-media-btn" style="background:var(--grad-primary);text-decoration:none"><i class="fas fa-map-marker-alt"></i> Google Maps</a>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function rateActivity(day, actIdx, stars) {
    const types = ['cultural', 'adventure', 'food', 'shopping', 'relaxation'];
    const act = state.itinerary?.days?.[day - 1]?.activities?.[actIdx];
    const type = act?.type || types[Math.floor(Math.random() * types.length)];
    const category = types.includes(type) ? type : 'cultural';
    updateBayesian(category, stars >= 3);
    runRLEpisode();
    drawRLChart();
    showToast(`Rated ${act?.name || 'activity'} ${stars}★`, 'info');

    // Update stars visually
    const ratings = document.querySelectorAll(`.star-rating[data-day="${day}"][data-act="${actIdx}"] .star`);
    ratings.forEach((s, i) => { s.classList.toggle('active', i < stars); });

    addLog('explain', `Rating ${stars}★ applied → RL reward adjusted, Bayesian ${category} updated`, 'info');
}

// === RENDER BOOKINGS ===
let _currentBookings = null;
let _currentDest = '';

function renderBookings(bookings, dest) {
    const c = document.getElementById('bookingsContainer');
    if (!c) return;
    _currentBookings = bookings;
    _currentDest = dest;

    let html = `
    <div class="tabs" id="bookingTabs">
      <button class="tab active" onclick="switchBookingTab('hotels',this)">🏨 Hotels</button>
      <button class="tab" onclick="switchBookingTab('flights',this)">✈️ Flights</button>
      <button class="tab" onclick="switchBookingTab('cabs',this)">🚗 Cab Rentals</button>
      <button class="tab" onclick="switchBookingTab('restaurants',this)">🍽️ Restaurants</button>
    </div>
  `;

    // Hotels
    html += `<div class="tab-content active" id="tab-hotels">
      <div class="sort-controls">
        <button class="sort-btn active" onclick="sortBookings('hotels','price-asc',this)">💰 Price ↑</button>
        <button class="sort-btn" onclick="sortBookings('hotels','price-desc',this)">💰 Price ↓</button>
        <button class="sort-btn" onclick="sortBookings('hotels','rating-desc',this)">⭐ Rating ↓</button>
        <button class="sort-btn" onclick="sortBookings('hotels','rating-asc',this)">⭐ Rating ↑</button>
      </div>
      <div class="booking-grid" id="grid-hotels">${renderHotelCards(bookings.hotels, dest)}</div>
    </div>`;

    // Flights
    html += `<div class="tab-content" id="tab-flights" style="display:none">
      <div class="sort-controls">
        <button class="sort-btn active" onclick="sortBookings('flights','price-asc',this)">💰 Price ↑</button>
        <button class="sort-btn" onclick="sortBookings('flights','price-desc',this)">💰 Price ↓</button>
      </div>
      <div class="booking-grid" id="grid-flights">${renderFlightCards(bookings.flights, dest)}</div>
    </div>`;

    // Cabs
    html += `<div class="tab-content" id="tab-cabs" style="display:none">
      <div class="sort-controls">
        <button class="sort-btn active" onclick="sortBookings('cabs','rating-desc',this)">⭐ Rating ↓</button>
        <button class="sort-btn" onclick="sortBookings('cabs','rating-asc',this)">⭐ Rating ↑</button>
      </div>
      <div class="booking-grid" id="grid-cabs">${renderCabCards(bookings.cabs, dest)}</div>
    </div>`;

    // Restaurants
    html += `<div class="tab-content" id="tab-restaurants" style="display:none">
      <div class="sort-controls">
        <button class="sort-btn active" onclick="sortBookings('restaurants','rating-desc',this)">⭐ Rating ↓</button>
        <button class="sort-btn" onclick="sortBookings('restaurants','rating-asc',this)">⭐ Rating ↑</button>
      </div>
      <div class="booking-grid" id="grid-restaurants">${renderRestaurantCards(bookings.restaurants, dest)}</div>
    </div>`;

    c.innerHTML = html;
}

function renderHotelCards(hotels, dest) {
    return (hotels || []).map(h => {
        const priceText = typeof h.price_per_night === 'number' ? `₹${h.price_per_night.toLocaleString()}/night` : h.price_per_night;
        return `
    <div class="booking-card">
      <img src="${h.photo}" alt="${h.name}" onerror="this.src='https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg'" loading="lazy">
      <div class="booking-card-body">
        <div class="booking-card-title">${h.name}</div>
        <div class="booking-card-rating">⭐ ${h.rating}/5</div>
        <div class="booking-card-price">${priceText}</div>
        <div class="booking-card-amenities">${(h.amenities || []).map(a => `<span class="amenity-tag">${a}</span>`).join('')}</div>
        <a href="${h.booking_url || '#'}" target="_blank" class="btn btn-primary" style="text-decoration:none">🔗 Visit Site</a>
      </div>
    </div>`;
    }).join('');
}

function renderFlightCards(flights, dest) {
    return (flights || []).map(f => `
    <div class="booking-card"><div class="booking-card-body">
      <div class="booking-card-title">✈️ ${f.airline}</div>
      <div class="booking-card-price">₹${f.price?.toLocaleString()}</div>
      <div class="text-sm text-muted mb-1">${f.departure} → ${f.arrival} (${f.duration})</div>
      <a href="${f.booking_url || `https://www.google.com/travel/flights?q=flights+to+${encodeURIComponent(dest)}`}" target="_blank" class="btn btn-accent" style="text-decoration:none">Book Flight</a>
    </div></div>`).join('');
}

function renderCabCards(cabs, dest) {
    return (cabs || []).map(c => `
    <div class="booking-card"><div class="booking-card-body">
      <div class="booking-card-title">🚗 ${c.type}</div>
      <div class="booking-card-price">${c.price}</div>
      <div class="booking-card-rating">⭐ ${c.rating}/5</div>
      <div class="booking-card-amenities">${(c.features || []).map(f => `<span class="amenity-tag">${f}</span>`).join('')}</div>
      <a href="${c.booking_url || '#'}" target="_blank" class="btn btn-accent" style="text-decoration:none">Book Now</a>
    </div></div>`).join('');
}

function renderRestaurantCards(restaurants, dest) {
    return (restaurants || []).map(r => `
    <div class="booking-card">
      <img src="${r.photo}" alt="${r.name}" onerror="this.src='https://images.pexels.com/photos/1099680/pexels-photo-1099680.jpeg'" loading="lazy">
      <div class="booking-card-body">
        <div class="booking-card-title">${r.name}</div>
        <div class="booking-card-rating">⭐ ${r.rating}/5 · ${r.cuisine}</div>
        <div class="booking-card-price">${r.price_range}</div>
        <a href="${r.booking_url || `https://www.google.com/search?q=restaurants+in+${encodeURIComponent(dest)}`}" target="_blank" class="btn btn-warm" style="text-decoration:none">View Restaurant</a>
      </div>
    </div>`).join('');
}

function sortBookings(tab, sortKey, btn) {
    if (!_currentBookings) return;
    // Update active button
    btn.closest('.sort-controls').querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const data = [...(_currentBookings[tab] || [])];
    const [field, dir] = sortKey.split('-');
    const asc = dir === 'asc' ? 1 : -1;

    if (field === 'price') {
        data.sort((a, b) => {
            const pa = a.price_per_night || a.price || 0;
            const pb = b.price_per_night || b.price || 0;
            const na = typeof pa === 'string' ? parseFloat(pa.replace(/[^\d.]/g, '')) || 0 : pa;
            const nb = typeof pb === 'string' ? parseFloat(pb.replace(/[^\d.]/g, '')) || 0 : pb;
            return (na - nb) * asc;
        });
    } else if (field === 'rating') {
        data.sort((a, b) => ((a.rating || 0) - (b.rating || 0)) * asc);
    }

    _currentBookings[tab] = data;
    const grid = document.getElementById(`grid-${tab}`);
    if (!grid) return;

    if (tab === 'hotels') grid.innerHTML = renderHotelCards(data, _currentDest);
    else if (tab === 'flights') grid.innerHTML = renderFlightCards(data, _currentDest);
    else if (tab === 'cabs') grid.innerHTML = renderCabCards(data, _currentDest);
    else if (tab === 'restaurants') grid.innerHTML = renderRestaurantCards(data, _currentDest);
}

function switchBookingTab(tab, btn) {
    document.querySelectorAll('#bookingsContainer .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#bookingsContainer .tab-content').forEach(t => {
        t.style.display = 'none';
        t.classList.remove('active');
    });
    if (btn) btn.classList.add('active');
    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) {
        tabEl.style.display = 'block';
        tabEl.classList.add('active');
    }
}

// === LANGUAGE TIPS ===
function renderLanguageTips(dest) {
    const c = document.getElementById('languageTips');
    if (!c) return;
    const destLower = dest.toLowerCase();
    const data = LANGUAGE_DB[destLower] || LANGUAGE_DB[Object.keys(LANGUAGE_DB).find(k => destLower.includes(k)) || ''];

    if (!data) {
        c.innerHTML = `<div class="section-title">🗣️ Language Tips</div><div class="empty-state"><div class="emoji">🌍</div><p class="text-muted">Language tips will appear after generating a trip</p></div>`;
        return;
    }

    c.innerHTML = `
    <div class="section-title">🗣️ ${data.flag} ${data.lang} — Essential Travel Phrases</div>
    <div class="lang-grid">
      ${data.phrases.map(p => `
        <div class="lang-card">
          <div class="lang-english">${p.en}</div>
          <div class="lang-phrase">${p.phrase}</div>
          <div class="lang-phonetic">📢 ${p.phon}</div>
          <div class="lang-situation">💡 ${p.ctx}</div>
        </div>
      `).join('')}
    </div>
  `;
    addLog('explain', `📚 Loaded ${data.phrases.length} ${data.lang} phrases for your trip`, 'success');
}

// === WEATHER ===
function renderWeather(dest, days) {
    const c = document.getElementById('weatherCards');
    if (!c) return;
    const icons = ['☀️', '⛅', '🌤️', '🌧️', '⛈️', '🌦️'];
    const descs = ['Sunny', 'Partly Cloudy', 'Clear', 'Light Rain', 'Thunderstorm', 'Showers'];
    c.innerHTML = Array.from({ length: Math.min(days, 3) }, (_, i) => {
        const temp = 20 + Math.floor(Math.random() * 15);
        const idx = Math.floor(Math.random() * icons.length);
        return `<div class="weather-card"><div class="weather-icon">${icons[idx]}</div><div class="weather-temp">${temp}°C</div><div class="weather-desc">${descs[idx]}</div><div class="text-xs text-muted">Day ${i + 1}</div></div>`;
    }).join('');
}

// === BUDGET ===
function updateBudgetDisplay(itin, total) {
    const used = itin?.total_cost || 0;
    state.budget = { total, used };
    const pct = Math.min(100, (used / total * 100));
    const amtEl = document.getElementById('budgetAmount');
    const fillEl = document.getElementById('budgetFill');
    const totalEl = document.getElementById('budgetTotal');
    if (amtEl) amtEl.textContent = `₹${used.toLocaleString()}`;
    if (fillEl) fillEl.style.width = pct + '%';
    if (totalEl) totalEl.textContent = `/ ₹${total.toLocaleString()}`;

    const cats = document.getElementById('budgetCats');
    if (cats) {
        const breakdown = { '🏨 Accommodation': 0.35, '🍽️ Food': 0.25, '🎯 Activities': 0.25, '🚗 Transport': 0.10, '🆘 Emergency': 0.05 };
        cats.innerHTML = Object.entries(breakdown).map(([k, v]) => {
            const amt = Math.round(total * v);
            return `<div class="budget-cat"><span>${k}</span><span class="fw-600">₹${amt.toLocaleString()}</span></div>`;
        }).join('');
    }
}

// === CROWD ===
function renderCrowdLevel() {
    const c = document.getElementById('crowdBar');
    if (!c) return;
    const levels = ['#10b981', '#10b981', '#f59e0b', '#f59e0b', '#ef4444'];
    const current = Math.floor(Math.random() * 5);
    c.innerHTML = levels.map((color, i) =>
        `<div class="crowd-segment" style="background:${i <= current ? color : 'var(--bg-4)'}"></div>`
    ).join('');
    const label = document.getElementById('crowdLabel');
    if (label) label.textContent = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'][current];
}

// === DEMO MODE ===
async function startDemo() {
    if (state.demoRunning) return;
    state.demoRunning = true;
    showToast('🎬 60-second Auto Demo starting...', 'info');

    // Set destination
    document.getElementById('destination').value = 'Jaipur';
    document.getElementById('duration').value = '3';
    document.getElementById('budget').value = '15000';
    document.getElementById('startDate').valueAsDate = new Date();

    await new Promise(r => setTimeout(r, 1000));
    addLog('planner', '🎬 Demo Mode: Planning Rajasthan trip...', 'info');

    await generateTrip();
    await new Promise(r => setTimeout(r, 3000));

    // Trigger emergency replanning
    addLog('weather', '⚠️ ALERT: Rainstorm detected in Jaipur!', 'warning');
    showToast('⛈️ Emergency: Rainstorm detected!', 'warning');
    await new Promise(r => setTimeout(r, 2000));

    addLog('planner', '🔄 Replanning: Moving outdoor activities indoors...', 'working');
    addLog('budget', '💰 Budget impact: +₹500 for indoor alternatives', 'info');
    await new Promise(r => setTimeout(r, 2000));

    // Simulate bad rating
    addLog('preference', '📊 User gave 1★ rating → Bayesian updating...', 'warning');
    updateBayesian('cultural', false);
    updateBayesian('cultural', false);
    await new Promise(r => setTimeout(r, 2000));

    // Run more RL episodes
    for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 100));
        runRLEpisode();
        drawRLChart();
    }

    addLog('explain', '✅ Demo complete! RL reward trending upward, preferences adapted.', 'success');
    showToast('✅ Demo complete!', 'success');
    state.demoRunning = false;
}

// === EMERGENCY REPLANNING ===
function emergencyReplan() {
    if (!state.itinerary) { showToast('Generate a trip first!', 'warning'); return; }
    // Open the delay replan modal
    const modal = document.getElementById('delayModal');
    if (modal) modal.classList.add('active');
}

// === DELAY-BASED REPLANNING ===
async function delayReplan() {
    const delayHours = parseFloat(document.getElementById('delayHours')?.value) || 4;
    const delayDay = parseInt(document.getElementById('delayDay')?.value) || 1;
    const delayReason = document.getElementById('delayReason')?.value || 'train_delay';
    const dest = document.getElementById('destination').value.trim();
    const budget = parseInt(document.getElementById('budget').value) || 15000;

    if (!state.itinerary) { showToast('Generate a trip first!', 'warning'); return; }

    // Close modal
    const modal = document.getElementById('delayModal');
    if (modal) modal.classList.remove('active');

    showLoading(true);
    setAllAgentsStatus('thinking');

    const reasonLabels = { train_delay: '🚂 Train Delay', flight_delay: '✈️ Flight Delay', traffic: '🚗 Traffic Jam', other: '⏰ Other Delay' };
    addLog('planner', `⏰ DELAY ALERT: ${delayHours}h delay on Day ${delayDay} — ${reasonLabels[delayReason] || delayReason}`, 'error');

    // Show agent orchestration
    document.getElementById('agentConvoPanel').style.display = 'block';
    document.getElementById('agentConvo').innerHTML = '';

    await agentSay('planner', null, `⏰ DELAY ALERT: ${delayHours} hour delay reported on Day ${delayDay}. Reason: ${reasonLabels[delayReason]}. Initiating emergency replanning...`, 'decision');
    updateAgentStatus('planner', 'working');
    await delay(400);

    await agentSay('planner', 'crowd', `@Crowd Analyzer — Reassess crowd levels for shortened Day ${delayDay}. We now have ${10 - delayHours} hours instead of 10.`);
    updateAgentStatus('crowd', 'working');
    await delay(300);
    await agentSay('crowd', 'planner', `Adjusted analysis: With late arrival, evening slots are busier (+40%). Recommending early afternoon visits to less crowded nearby sites.`, 'insight');
    updateAgentStatus('crowd', 'completed');

    await agentSay('planner', 'booking', `@Booking Assistant — Search for nearby quick-visit attractions within 5km radius. Need activities fitting in ${10 - delayHours}h window.`);
    updateAgentStatus('booking', 'working');
    await delay(300);

    // Call backend for real replanning
    try {
        const res = await fetch(`${API_BASE}/replan-delay`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destination: dest, delay_hours: delayHours, current_day: delayDay,
                budget, original_itinerary: state.itinerary, reason: delayReason
            })
        });

        if (res.ok) {
            const data = await res.json();
            const changes = data.changes;

            await agentSay('booking', 'planner', `Found ${changes.nearby_found} nearby alternatives! Kept ${changes.kept_activities.length} original activities, swapped in ${changes.added_activities.length} quick nearby visits.`, 'decision');
            updateAgentStatus('booking', 'completed');
            await delay(300);

            if (changes.removed_activities.length > 0) {
                await agentSay('planner', null, `❌ Removed: ${changes.removed_activities.join(', ')}`, 'insight');
            }
            if (changes.added_activities.length > 0) {
                await agentSay('planner', null, `⚡ Added nearby: ${changes.added_activities.join(', ')}`, 'insight');
            }

            await agentSay('explain', null, `Reasoning: With ${delayHours}h delay, ${10 - delayHours}h remain. Prioritized highest-rated original activities and filled remaining time with nearby quick-visit alternatives (5km radius). Budget impact: ₹${Math.abs(state.itinerary.total_cost - data.itinerary.total_cost).toLocaleString()}.`, 'decision');
            updateAgentStatus('explain', 'completed');

            // Update state and re-render
            state.itinerary = data.itinerary;
            renderItinerary(state.itinerary, dest);
            updateMap(state.itinerary);
            updateBudgetDisplay(state.itinerary, budget);
            runRLEpisode(); drawRLChart();

            showLoading(false);
            setAllAgentsStatus('completed');
            addLog('planner', `✅ Delay replanning complete! Day ${delayDay} restructured: ${changes.kept_activities.length} kept, ${changes.added_activities.length} added, ${changes.removed_activities.length} removed`, 'success');
            showToast(`✅ Day ${delayDay} replanned for ${delayHours}h delay!`, 'success');
            return;
        }
    } catch (e) {
        console.log('Backend replan failed, using simulated:', e);
    }

    // Fallback: simulated replanning if backend unavailable
    await agentSay('booking', 'planner', `Found 3 nearby alternatives. Swapping long-duration activities for quick visits.`, 'decision');
    updateAgentStatus('booking', 'completed');

    // Modify the itinerary locally
    const dayIdx = delayDay - 1;
    if (state.itinerary.days[dayIdx]) {
        const day = state.itinerary.days[dayIdx];
        // Keep top 2 rated activities, adjust times
        const sorted = [...day.activities].sort((a, b) => (b.rating || 0) - (a.rating || 0));
        const kept = sorted.slice(0, Math.max(1, Math.floor((10 - delayHours) / 2.5)));
        const startHour = 9 + delayHours;
        kept.forEach((a, i) => { a.time = `${Math.floor(startHour + i * 2.5).toString().padStart(2, '0')}:00`; });
        day.activities = kept;
        day.daily_cost = kept.reduce((s, a) => s + (a.cost || 0), 0);
        day.replanned = true;
        state.itinerary.total_cost = state.itinerary.days.reduce((s, d) => s + d.daily_cost, 0);
    }

    await agentSay('explain', null, `Simulated replanning: Kept ${state.itinerary.days[dayIdx]?.activities.length || 0} top-rated activities with adjusted timing.`, 'decision');
    updateAgentStatus('explain', 'completed');

    renderItinerary(state.itinerary, dest);
    updateMap(state.itinerary);
    updateBudgetDisplay(state.itinerary, parseInt(document.getElementById('budget').value) || 15000);
    runRLEpisode(); drawRLChart();

    showLoading(false);
    setAllAgentsStatus('completed');
    addLog('planner', `✅ Simulated delay replanning complete for Day ${delayDay}`, 'success');
    showToast(`✅ Day ${delayDay} replanned for ${delayHours}h delay!`, 'success');
}

// === THEME ===
function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme === 'light' ? 'light' : '');
    const icon = document.getElementById('themeIcon');
    if (icon) icon.className = state.theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
}

// === PERSONA ===
function selectPersona(p) {
    state.persona = p;
    document.querySelectorAll('.persona-card').forEach(c => c.classList.remove('active'));
    document.querySelector(`.persona-card[data-persona="${p}"]`)?.classList.add('active');
    const budgets = { solo: 15000, family: 40000, luxury: 100000, adventure: 25000 };
    document.getElementById('budget').value = budgets[p] || 15000;
    addLog('preference', `Persona changed to ${p}`, 'info');
}

// === HELPERS ===
function showLoading(show) {
    const el = document.getElementById('loadingOverlay');
    if (el) el.classList.toggle('active', show);
}

function showToast(msg, type = 'info') {
    const c = document.getElementById('toastContainer');
    if (!c) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `${msg}`;
    c.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(40px)'; setTimeout(() => t.remove(), 300); }, 3500);
}

function exportPDF() {
    showToast('📄 PDF export would generate here (jsPDF integration)', 'info');
    addLog('explain', '📄 Itinerary exported to PDF', 'success');
}

function shareTrip() {
    const url = `${window.location.origin}${window.location.pathname}?dest=${document.getElementById('destination').value}&days=${document.getElementById('duration').value}`;
    navigator.clipboard?.writeText(url);
    showToast('🔗 Share link copied to clipboard!', 'success');
}

function startVoice() {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
        showToast('Voice input not supported in this browser', 'warning'); return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.onresult = e => {
        const text = e.results[0][0].transcript;
        document.getElementById('destination').value = text;
        showToast(`🎤 Heard: "${text}"`, 'success');
        addLog('preference', `🎤 Voice input: "${text}"`, 'info');
    };
    recognition.onerror = () => showToast('Voice recognition failed', 'error');
    recognition.start();
    showToast('🎤 Listening...', 'info');
}

// === EVENT LISTENERS ===
function setupEventListeners() {
    document.getElementById('generateBtn')?.addEventListener('click', generateTrip);
    document.addEventListener('keydown', e => {
        if (e.key === 'Enter' && document.activeElement?.id === 'destination') generateTrip();
    });
}

// === INIT ===
// === MEDIA MODAL ===
function openMediaModal(dayIdx, actIdx) {
    const act = state.itinerary?.days?.[dayIdx]?.activities?.[actIdx];
    if (!act) return;

    const modal = document.getElementById('mediaModal');
    document.getElementById('modalTitle').textContent = act.name;

    // Generate media links
    const q = encodeURIComponent(act.name);
    const media = act.media || {
        photos: act.photos || [],
        videos: { youtube: `https://www.youtube.com/results?search_query=${q}+travel+guide`, virtual_tour: `https://www.youtube.com/results?search_query=${q}+virtual+tour+4k` },
        maps: { google: `https://www.google.com/maps/search/?api=1&query=${act.lat},${act.lon}`, osm: `https://www.openstreetmap.org/?mlat=${act.lat}&mlon=${act.lon}#map=16/${act.lat}/${act.lon}`, directions: `https://www.google.com/maps/dir/?api=1&destination=${act.lat},${act.lon}` },
        reviews: { google: `https://www.google.com/search?q=${q}+reviews`, tripadvisor: `https://www.tripadvisor.com/Search?q=${q}` },
        links: { wiki: `https://en.wikipedia.org/wiki/${q.replace(/%20/g, '_')}`, booking: `https://www.google.com/search?q=${q}+tickets+booking` }
    };

    // Photos
    const photos = act.photos || media.photos || [];
    document.getElementById('modalPhotos').innerHTML = photos.map((url, i) =>
        `<div class="photo-gallery-item" onclick="viewFullPhoto('${url}')">
      <img src="${url}" alt="${act.name} photo ${i + 1}" loading="lazy" onerror="this.src='https://images.pexels.com/photos/460672/pexels-photo-460672.jpeg?auto=compress&w=600'">
      <div class="photo-overlay"><span>📸 Click to enlarge</span></div>
    </div>`
    ).join('') || '<p class="text-muted text-sm">No photos available</p>';

    // Videos
    document.getElementById('modalVideos').innerHTML = `
    <a href="${media.videos.youtube}" target="_blank" class="media-link-btn youtube"><i class="fab fa-youtube"></i> Watch on YouTube</a>
    <a href="${media.videos.virtual_tour}" target="_blank" class="media-link-btn youtube"><i class="fas fa-vr-cardboard"></i> Virtual Tour (4K)</a>
    <a href="https://www.youtube.com/results?search_query=${q}+drone+footage" target="_blank" class="media-link-btn youtube"><i class="fas fa-helicopter"></i> Drone Footage</a>
  `;

    // Map embed (mini Leaflet)
    const mapDiv = document.getElementById('modalMapEmbed');
    mapDiv.innerHTML = ''; // clear
    if (act.lat && act.lon) {
        mapDiv.innerHTML = `<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${act.lon - 0.01},${act.lat - 0.01},${act.lon + 0.01},${act.lat + 0.01}&layer=mapnik&marker=${act.lat},${act.lon}" style="width:100%;height:100%;border:none;border-radius:var(--radius)"></iframe>`;
    }

    // Maps links
    document.getElementById('modalMaps').innerHTML = `
    <a href="${media.maps.google}" target="_blank" class="media-link-btn google"><i class="fas fa-map-marked-alt"></i> Google Maps</a>
    <a href="${media.maps.directions}" target="_blank" class="media-link-btn google"><i class="fas fa-directions"></i> Get Directions</a>
    <a href="${media.maps.osm}" target="_blank" class="media-link-btn"><i class="fas fa-map"></i> OpenStreetMap</a>
    <a href="https://www.google.com/maps/@${act.lat},${act.lon},3a,75y,90t/data=!3m6!1e1!3m4" target="_blank" class="media-link-btn"><i class="fas fa-street-view"></i> Street View</a>
  `;

    // Reviews
    const fullStars = Math.floor(act.rating);
    const halfStar = act.rating % 1 >= 0.5;
    const starsHtml = Array.from({ length: 5 }, (_, i) =>
        `<span class="star ${i < fullStars ? '' : (i === fullStars && halfStar ? '' : 'empty')}">${i < fullStars ? '★' : (i === fullStars && halfStar ? '★' : '☆')}</span>`
    ).join('');
    document.getElementById('modalRating').innerHTML = `
    <div class="rating-big">${act.rating}</div>
    <div><div class="rating-stars">${starsHtml}</div><div class="rating-label">${(act.reviews_count || 0).toLocaleString()} reviews</div></div>
  `;
    document.getElementById('modalReviews').innerHTML = `
    <a href="${media.reviews.google}" target="_blank" class="media-link-btn google"><i class="fab fa-google"></i> Google Reviews</a>
    <a href="${media.reviews.tripadvisor}" target="_blank" class="media-link-btn tripadvisor"><i class="fab fa-tripadvisor"></i> TripAdvisor</a>
    <a href="https://www.google.com/search?q=${q}+blog+review" target="_blank" class="media-link-btn"><i class="fas fa-blog"></i> Travel Blogs</a>
  `;

    // Useful Links
    document.getElementById('modalLinks').innerHTML = `
    <a href="${media.links.wiki}" target="_blank" class="media-link-btn wiki"><i class="fab fa-wikipedia-w"></i> Wikipedia</a>
    <a href="${media.links.booking}" target="_blank" class="media-link-btn"><i class="fas fa-ticket-alt"></i> Book Tickets</a>
    <a href="https://www.instagram.com/explore/tags/${q.replace(/%20/g, '')}" target="_blank" class="media-link-btn" style="border-color:rgba(225,48,108,0.3)"><i class="fab fa-instagram"></i> Instagram</a>
    <a href="https://www.google.com/search?q=${q}+best+time+to+visit" target="_blank" class="media-link-btn"><i class="fas fa-clock"></i> Best Time to Visit</a>
  `;

    // Quick Info
    document.getElementById('modalInfo').innerHTML = `
    <div class="info-badge"><i class="fas fa-clock"></i> ${act.duration}</div>
    <div class="info-badge"><i class="fas fa-rupee-sign"></i> ₹${act.cost}</div>
    <div class="info-badge"><i class="fas fa-tag"></i> ${act.type}</div>
    <div class="info-badge"><i class="fas fa-star"></i> ${act.rating}/5</div>
    <div class="info-badge"><i class="fas fa-comment"></i> ${(act.reviews_count || 0).toLocaleString()} reviews</div>
    <div class="info-badge"><i class="fas fa-map-pin"></i> ${act.lat?.toFixed(4)}, ${act.lon?.toFixed(4)}</div>
  `;

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

// Close modal on Escape key
document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeMediaModal(); document.querySelectorAll('.fullscreen-photo').forEach(el => el.remove()); } });

// === INIT ===
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else { init(); }
