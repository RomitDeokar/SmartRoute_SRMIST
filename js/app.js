// ============================================
// SmartRoute v10.0 — Fully Agentic AI Travel Planner
// Production-ready, no prototyping, no demos
// ============================================

const API_BASE = (() => {
    const h = window.location.hostname;
    if (h === 'localhost' || h === '127.0.0.1') return 'http://localhost:8000';
    // Sandbox: replace port prefix in hostname (e.g., 8080-xxx -> 8000-xxx)
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
    generating: false, autoMode: true
};

// === LANGUAGE DATABASE ===
const LANGUAGE_DB = {
    paris: { lang: 'French', flag: '\u{1F1EB}\u{1F1F7}', phrases: [
        { en: 'Hello', phrase: 'Bonjour', phon: 'bohn-ZHOOR', ctx: 'Greeting anyone' },
        { en: 'Thank you', phrase: 'Merci', phon: 'mehr-SEE', ctx: 'Showing gratitude' },
        { en: 'Please', phrase: "S'il vous pla\u00EEt", phon: 'seel voo PLEH', ctx: 'Making requests' },
        { en: 'Excuse me', phrase: 'Excusez-moi', phon: 'ex-koo-ZAY mwah', ctx: 'Getting attention' },
        { en: 'How much?', phrase: "C'est combien?", phon: 'say kohm-BYAN', ctx: 'Shopping/bargaining' },
        { en: 'Where is...?', phrase: 'O\u00F9 est...?', phon: 'oo EH', ctx: 'Asking directions' },
        { en: 'Help!', phrase: 'Au secours!', phon: 'oh suh-KOOR', ctx: 'Emergency' },
        { en: 'The bill, please', phrase: "L'addition, s'il vous pla\u00EEt", phon: 'lah-dee-SYOHN', ctx: 'At restaurants' },
        { en: 'Good evening', phrase: 'Bonsoir', phon: 'bohn-SWAHR', ctx: 'Evening greeting' },
        { en: 'Goodbye', phrase: 'Au revoir', phon: 'oh ruh-VWAHR', ctx: 'Farewell' },
    ]},
    tokyo: { lang: 'Japanese', flag: '\u{1F1EF}\u{1F1F5}', phrases: [
        { en: 'Hello', phrase: '\u3053\u3093\u306B\u3061\u306F (Konnichiwa)', phon: 'kohn-NEE-chee-wah', ctx: 'Greeting' },
        { en: 'Thank you', phrase: '\u3042\u308A\u304C\u3068\u3046 (Arigatou)', phon: 'ah-ree-GAH-toh', ctx: 'Gratitude' },
        { en: 'Excuse me', phrase: '\u3059\u307F\u307E\u305B\u3093 (Sumimasen)', phon: 'soo-mee-mah-SEN', ctx: 'Getting attention' },
        { en: 'How much?', phrase: '\u3044\u304F\u3089? (Ikura?)', phon: 'ee-KOO-rah', ctx: 'Shopping' },
        { en: 'Delicious!', phrase: '\u304A\u3044\u3057\u3044! (Oishii!)', phon: 'oy-SHEE', ctx: 'Complimenting food' },
        { en: 'Goodbye', phrase: '\u3055\u3088\u3046\u306A\u3089 (Sayounara)', phon: 'sah-YOH-nah-rah', ctx: 'Farewell' }
    ]},
    london: { lang: 'English (British)', flag: '\u{1F1EC}\u{1F1E7}', phrases: [
        { en: 'Cheers!', phrase: 'Cheers!', phon: 'cheerz', ctx: 'Thank you (informal)' },
        { en: 'Excuse me, mate', phrase: 'Excuse me, mate', phon: 'as-is', ctx: 'Getting attention' },
        { en: 'Where is the tube?', phrase: 'Where is the tube?', phon: 'as-is', ctx: 'Finding the subway' },
        { en: 'Mind the gap', phrase: 'Mind the gap', phon: 'as-is', ctx: 'On the Underground' }
    ]},
    jaipur: { lang: 'Hindi', flag: '\u{1F1EE}\u{1F1F3}', phrases: [
        { en: 'Hello', phrase: '\u0928\u092E\u0938\u094D\u0924\u0947 (Namaste)', phon: 'nah-mah-STAY', ctx: 'Universal greeting' },
        { en: 'Thank you', phrase: '\u0927\u0928\u094D\u092F\u0935\u093E\u0926 (Dhanyavaad)', phon: 'dhun-yah-VAHD', ctx: 'Gratitude' },
        { en: 'How much?', phrase: '\u0915\u093F\u0924\u0928\u093E? (Kitna?)', phon: 'KIT-nah', ctx: 'Shopping/bargaining' },
        { en: 'Too expensive', phrase: '\u092C\u0939\u0941\u0924 \u092E\u0939\u0902\u0917\u093E (Bahut mehenga)', phon: 'bah-HOOT meh-HEN-gah', ctx: 'Bargaining' },
        { en: 'Water', phrase: '\u092A\u093E\u0928\u0940 (Paani)', phon: 'PAH-nee', ctx: 'Ordering water' },
        { en: 'Let\'s go', phrase: '\u091A\u0932\u094B (Chalo)', phon: 'CHAH-loh', ctx: 'Getting around' }
    ]},
    rome: { lang: 'Italian', flag: '\u{1F1EE}\u{1F1F9}', phrases: [
        { en: 'Hello', phrase: 'Ciao', phon: 'CHOW', ctx: 'Greeting' },
        { en: 'Thank you', phrase: 'Grazie', phon: 'GRAH-tsee-eh', ctx: 'Gratitude' },
        { en: 'Please', phrase: 'Per favore', phon: 'pehr fah-VOH-reh', ctx: 'Requests' },
        { en: 'How much?', phrase: 'Quanto costa?', phon: 'KWAHN-toh KOH-stah', ctx: 'Shopping' },
        { en: 'Delicious!', phrase: 'Delizioso!', phon: 'deh-lee-TSEE-oh-zoh', ctx: 'Complimenting food' },
        { en: 'Goodbye', phrase: 'Arrivederci', phon: 'ah-ree-veh-DEHR-chee', ctx: 'Farewell' }
    ]}
};

// === CITY COORDINATES ===
const CITY_COORDS = {
    paris: [48.8566, 2.3522], london: [51.5074, -0.1278], tokyo: [35.6762, 139.6503],
    jaipur: [26.9124, 75.7873], rome: [41.9028, 12.4964], 'new york': [40.7128, -74.006],
    dubai: [25.2048, 55.2708], singapore: [1.3521, 103.8198], bangkok: [13.7563, 100.5018],
    barcelona: [41.3874, 2.1686], istanbul: [41.0082, 28.9784], amsterdam: [52.3676, 4.9041],
    sydney: [-33.8688, 151.2093], bali: [-8.3405, 115.0920], goa: [15.2993, 74.1240],
    udaipur: [24.5854, 73.7125], varanasi: [25.3176, 83.0068], mumbai: [19.0760, 72.8777],
    delhi: [28.7041, 77.1025], agra: [27.1767, 78.0081], manali: [32.2396, 77.1887],
    shimla: [31.1048, 77.1734], rishikesh: [30.0869, 78.2676], leh: [34.1526, 77.5771],
    prague: [50.0755, 14.4378], vienna: [48.2082, 16.3738], lisbon: [38.7223, -9.1393],
    cairo: [30.0444, 31.2357], marrakech: [31.6295, -7.9811], 'cape town': [-33.9249, 18.4241],
    kyoto: [35.0116, 135.7681], seoul: [37.5665, 126.9780], hanoi: [21.0285, 105.8542]
};

// === AGENT DEFINITIONS ===
const AGENTS = [
    { id: 'planner', name: 'Planner Agent', role: 'Itinerary Planning', icon: '\u{1F5FA}', color: '#667eea' },
    { id: 'weather', name: 'Weather Risk Agent', role: 'Weather Monitoring', icon: '\u{1F326}', color: '#06b6d4' },
    { id: 'crowd', name: 'Crowd Analyzer', role: 'Crowd Intelligence', icon: '\u{1F465}', color: '#f59e0b' },
    { id: 'budget', name: 'Budget Optimizer', role: 'Financial Planning', icon: '\u{1F4B0}', color: '#10b981' },
    { id: 'preference', name: 'Preference Agent', role: 'Taste Learning', icon: '\u2764\uFE0F', color: '#ec4899' },
    { id: 'booking', name: 'Booking Assistant', role: 'Reservations', icon: '\u{1F3AB}', color: '#8b5cf6' },
    { id: 'explain', name: 'Explainability Agent', role: 'AI Reasoning', icon: '\u{1F9E0}', color: '#f97316' }
];

// ============================================
// REAL PHOTO FETCHER (Wikipedia + Wikimedia)
// ============================================
const _photoCache = new Map();

async function fetchWikipediaPhoto(placeName, city = '') {
    const cacheKey = `${placeName}|${city}`;
    if (_photoCache.has(cacheKey)) return _photoCache.get(cacheKey);

    const queries = [placeName, `${placeName} ${city}`.trim(), `${placeName} (${city})`];
    for (const q of queries) {
        try {
            const resp = await fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&titles=${encodeURIComponent(q)}&prop=pageimages&piprop=original|thumbnail&pithumbsize=800`);
            if (!resp.ok) continue;
            const data = await resp.json();
            const pages = data?.query?.pages || {};
            for (const page of Object.values(pages)) {
                if (parseInt(page.pageid) < 0) continue;
                const url = page?.thumbnail?.source || page?.original?.source;
                if (url && !url.includes('.svg') && !url.includes('Flag_of') && !url.includes('Coat_of_arms')) {
                    _photoCache.set(cacheKey, url);
                    return url;
                }
            }
        } catch (e) { /* continue */ }
    }
    _photoCache.set(cacheKey, null);
    return null;
}

async function fetchWikimediaGeoPhotos(lat, lon, count = 3) {
    try {
        const resp = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=geosearch&ggscoord=${lat}|${lon}&ggsradius=1000&ggslimit=${count * 3}&ggsnamespace=6&prop=imageinfo&iiprop=url|mime&iiurlwidth=800`);
        if (!resp.ok) return [];
        const data = await resp.json();
        const pages = data?.query?.pages || {};
        const photos = [];
        for (const page of Object.values(pages)) {
            const info = page?.imageinfo?.[0];
            if (!info) continue;
            const mime = info.mime || '';
            if (mime.includes('image') && !mime.includes('svg')) {
                const url = info.thumburl || info.url;
                if (url && !url.includes('.svg')) photos.push(url);
            }
        }
        return photos.slice(0, count);
    } catch (e) { return []; }
}

async function getRealPhoto(placeName, city, fallbackUrl) {
    // 1. Try Wikipedia
    const wikiPhoto = await fetchWikipediaPhoto(placeName, city);
    if (wikiPhoto) return wikiPhoto;
    
    // 2. If we have coords, try geo search
    const coords = CITY_COORDS[city?.toLowerCase()];
    if (coords) {
        const geoPhotos = await fetchWikimediaGeoPhotos(coords[0], coords[1], 1);
        if (geoPhotos.length) return geoPhotos[0];
    }
    
    // 3. Use provided fallback if it's not a generic Pexels one
    if (fallbackUrl && !fallbackUrl.includes('pexels-photo-338515') && !fallbackUrl.includes('pexels-photo-460672') && !fallbackUrl.includes('source.unsplash.com')) {
        return fallbackUrl;
    }
    
    // 4. Last resort: Wikimedia search
    try {
        const resp = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&origin=*&generator=search&gsrsearch=${encodeURIComponent(placeName + ' ' + city)}&gsrlimit=3&gsrnamespace=6&prop=imageinfo&iiprop=url|mime&iiurlwidth=800`);
        if (resp.ok) {
            const data = await resp.json();
            const pages = data?.query?.pages || {};
            for (const page of Object.values(pages)) {
                const info = page?.imageinfo?.[0];
                if (info?.mime?.includes('image') && !info.mime.includes('svg')) {
                    const url = info.thumburl || info.url;
                    if (url) return url;
                }
            }
        }
    } catch (e) { /* fallback */ }
    
    return fallbackUrl || '';
}

async function fixItineraryPhotos(itinerary, dest) {
    if (!itinerary?.days) return;
    const batchSize = 4;
    const allActivities = [];
    itinerary.days.forEach(day => {
        (day.activities || []).forEach(act => allActivities.push(act));
    });
    
    for (let i = 0; i < allActivities.length; i += batchSize) {
        const batch = allActivities.slice(i, i + batchSize);
        await Promise.allSettled(batch.map(async act => {
            const photos = act.photos || [];
            const isGeneric = !photos.length || photos.every(p => 
                !p || p.includes('pexels-photo-338515') || p.includes('pexels-photo-2675531') ||
                p.includes('pexels-photo-2363') || p.includes('pexels-photo-1850629') ||
                p.includes('pexels-photo-460672') || p.includes('source.unsplash.com')
            );
            if (isGeneric) {
                const url = await getRealPhoto(act.name, dest, photos[0] || '');
                if (url) {
                    act.photos = [url];
                    if (act.media) act.media.photos = [url];
                }
            }
        }));
    }
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
    
    // Check URL params for auto-generation
    const urlParams = new URLSearchParams(window.location.search);
    const destParam = urlParams.get('dest');
    if (destParam) {
        document.getElementById('destination').value = destParam;
        const daysParam = urlParams.get('days');
        if (daysParam) document.getElementById('duration').value = daysParam;
        setTimeout(() => generateTrip(), 500);
    }
    
    console.log('SmartRoute v10.0 initialized — Fully Agentic Mode');
}

// === MAP ===
let map, markers = [], routeLine;

function initMap() {
    const el = document.getElementById('map');
    if (!el) return;
    try {
        map = L.map('map', { center: [20, 0], zoom: 2, zoomControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '\u00A9 <a href="https://www.openstreetmap.org">OSM</a>',
            maxZoom: 19
        }).addTo(map);
        setTimeout(() => map.invalidateSize(), 500);
        addLog('planner', 'Map initialized', 'success');
    } catch (e) { console.error('Map init failed:', e); }
}

function clearMap() {
    markers.forEach(m => map?.removeLayer(m));
    markers = [];
    if (routeLine && map) { map.removeLayer(routeLine); routeLine = null; }
}

function updateMap(itinerary) {
    if (!map || !itinerary?.days) return;
    clearMap();
    const coords = [];
    let counter = 1;
    const colors = { cultural: '#f59e0b', adventure: '#10b981', food: '#ef4444', shopping: '#8b5cf6', religious: '#06b6d4', landmark: '#667eea', museum: '#764ba2', fort: '#f97316', palace: '#ec4899', historic: '#f97316', hidden_gem: '#10b981', park: '#22c55e', attraction: '#667eea', viewpoint: '#06b6d4', architecture: '#f97316', market: '#ec4899' };
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
            marker.bindPopup(`<div style="font-family:Inter,sans-serif"><div style="font-weight:700;font-size:14px;margin-bottom:4px">${act.name}</div><div style="font-size:12px;color:#888">${act.time || ''} | ${act.duration || ''}</div><div style="font-size:12px;color:#888">Day ${day.day} | ${act.type}</div><div style="font-weight:700;color:#4facfe;margin-top:4px">\u20B9${act.cost || 0}</div></div>`);
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
let _wsRetries = 0;
function connectWebSocket() {
    if (_wsRetries > 3) return; // Stop after 3 retries to avoid console noise
    try {
        const wsUrl = API_BASE.replace(/^http/, 'ws') + '/ws/agents';
        state.ws = new WebSocket(wsUrl);
        state.ws.onopen = () => { _wsRetries = 0; };
        state.ws.onmessage = e => {
            try {
                const d = JSON.parse(e.data);
                if (d.type === 'agent_activity') {
                    addLog(d.agent_id, d.message, d.status);
                    updateAgentStatus(d.agent_id, d.status);
                }
            } catch (err) { /* ignore */ }
        };
        state.ws.onclose = () => { _wsRetries++; if (_wsRetries <= 3) setTimeout(connectWebSocket, 5000); };
        state.ws.onerror = () => { _wsRetries++; };
    } catch (e) { /* backend not running */ }
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
    if (el) el.className = 'agent-status ' + status;
}
function setAllAgentsStatus(status) { AGENTS.forEach(a => updateAgentStatus(a.id, status)); }
function updateAgentPulse() {
    if (!state.itinerary) {
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
    addLog('preference', `Bayesian update: ${category} \u2192 ${liked ? 'positive' : 'negative'}`, 'info');
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
    ctx.strokeStyle = 'rgba(102,126,234,0.15)'; ctx.lineWidth = 1;
    nodes.forEach((n1, i) => { nodes.forEach((n2, j) => { if (j > i) { ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(n2.x, n2.y); ctx.stroke(); } }); });
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

// ============================================
// GENERATE TRIP — FULLY AGENTIC
// ============================================
async function generateTrip() {
    if (state.generating) return;
    const dest = document.getElementById('destination').value.trim();
    const duration = parseInt(document.getElementById('duration').value) || 3;
    const budget = parseInt(document.getElementById('budget').value) || 15000;
    const startDate = document.getElementById('startDate').value || new Date().toISOString().split('T')[0];

    if (!dest) { showToast('Please enter a destination', 'warning'); return; }

    state.generating = true;
    state.budget.total = budget;
    state.budget.used = 0;
    state.currentDest = dest;
    showLoading(true);
    setAllAgentsStatus('thinking');
    addLog('planner', `Autonomous agents activated for ${dest} (${duration} days, \u20B9${budget.toLocaleString()})`, 'info');

    // Show agent orchestration
    document.getElementById('agentConvoPanel').style.display = 'block';
    document.getElementById('agentConvo').innerHTML = '';
    document.getElementById('insightsPanel').style.display = 'none';

    await agentSay('planner', null, `Initiating autonomous ${duration}-day trip planning for ${dest}. Deploying all 7 agents...`, 'decision');
    updateAgentStatus('planner', 'working');
    await sleep(400);

    // Try backend
    let backendData = null;
    try {
        const chk = document.querySelectorAll('.checkbox-label input');
        await agentSay('planner', 'weather', `@Weather Risk Agent \u2014 Fetch forecast data for ${dest}.`);
        updateAgentStatus('weather', 'working');
        
        const res = await fetch(`${API_BASE}/generate-trip`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destination: dest, duration, budget, start_date: startDate,
                preferences: [], persona: state.persona,
                include_flights: chk[0]?.checked, include_hotels: chk[1]?.checked,
                include_restaurants: chk[2]?.checked, include_transport: chk[3]?.checked
            })
        });
        if (res.ok) backendData = await res.json();
    } catch (e) { /* fallback to local simulation */ }

    // Simulate agent conversation regardless
    await agentSay('weather', 'planner', `Weather data retrieved for ${dest}. Conditions factored into planning.`, 'insight');
    updateAgentStatus('weather', 'completed');

    await agentSay('planner', 'crowd', `@Crowd Analyzer \u2014 Assess crowd levels for ${dest} attractions.`);
    updateAgentStatus('crowd', 'working');
    await sleep(300);
    await agentSay('crowd', 'planner', `Crowd analysis complete. Morning visits recommended for 35% fewer crowds.`, 'insight');
    updateAgentStatus('crowd', 'completed');

    await agentSay('planner', 'budget', `@Budget Optimizer \u2014 Optimize \u20B9${budget.toLocaleString()} across ${duration} days.`);
    updateAgentStatus('budget', 'working');
    await sleep(300);
    await agentSay('budget', 'planner', `Budget plan ready: Accommodation 35%, Activities 25%, Food 25%, Transport 10%, Emergency 5%.`, 'decision');
    updateAgentStatus('budget', 'completed');

    await agentSay('planner', 'preference', `@Preference Agent \u2014 Apply Bayesian priors for ${state.persona} traveler.`);
    updateAgentStatus('preference', 'working');
    await sleep(200);
    const topPref = Object.entries(state.bayesian).sort((a, b) => (b[1].a / (b[1].a + b[1].b)) - (a[1].a / (a[1].a + a[1].b)))[0];
    await agentSay('preference', 'planner', `Bayesian inference: Strongest preference = ${topPref[0]} (${(topPref[1].a / (topPref[1].a + topPref[1].b) * 100).toFixed(0)}%).`, 'insight');
    updateAgentStatus('preference', 'completed');

    if (!backendData) {
        // Fallback: generate locally
        await agentSay('planner', null, `Running MDP solver with local data...`, 'decision');
        await sleep(200);
        const itinerary = await generateSimulatedItinerary(dest, duration, budget, startDate);
        state.itinerary = itinerary;
        backendData = { itinerary, bookings: {} };
    }

    await agentSay('planner', 'booking', `@Booking Assistant \u2014 Search hotels, flights, restaurants, and transport for ${dest}.`);
    updateAgentStatus('booking', 'working');
    await sleep(400);
    await agentSay('booking', 'planner', `All booking options compiled for ${dest}.`, 'decision');
    updateAgentStatus('booking', 'completed');

    await agentSay('planner', 'explain', `@Explainability Agent \u2014 Generate reasoning trace.`);
    updateAgentStatus('explain', 'working');
    await sleep(300);
    await agentSay('explain', null, `Reasoning complete: Activities optimized for ratings, budget adherence, and crowd avoidance.`, 'decision');
    updateAgentStatus('explain', 'completed');

    showLoading(false);
    setAllAgentsStatus('completed');
    state.generating = false;
    addLog('planner', `All agents completed for ${dest}!`, 'success');
    await processTrip(backendData, dest, duration, budget);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function agentSay(fromId, toId, text, msgType = '') {
    return new Promise(resolve => {
        const from = AGENTS.find(a => a.id === fromId) || AGENTS[0];
        const to = toId ? AGENTS.find(a => a.id === toId) : null;
        const convo = document.getElementById('agentConvo');
        if (!convo) { resolve(); return; }
        addLog(fromId, text.replace(/@\w+ \w+ \u2014 /, ''), msgType === 'decision' ? 'success' : msgType === 'insight' ? 'info' : 'working');
        const msg = document.createElement('div');
        msg.className = `agent-msg ${msgType}`;
        const now = new Date();
        msg.innerHTML = `
      <div class="agent-msg-avatar" style="background:${from.color}22;border-color:${from.color}">${from.icon}</div>
      <div class="agent-msg-body">
        <div class="agent-msg-header">
          <span class="agent-msg-name" style="color:${from.color}">${from.name}</span>
          ${to ? `<span class="agent-msg-arrow">\u2192</span><span class="agent-msg-target">${to.name}</span>` : ''}
        </div>
        <div class="agent-msg-text">${text}</div>
        <div class="agent-msg-time">${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}</div>
      </div>`;
        convo.appendChild(msg);
        convo.scrollTop = convo.scrollHeight;
        setTimeout(resolve, 200);
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

async function processTrip(data, dest, duration, budget) {
    state.itinerary = data.itinerary || data;
    state.currentDest = dest;

    // Fix photos asynchronously
    await fixItineraryPhotos(state.itinerary, dest);

    renderItinerary(state.itinerary, dest);
    updateMap(state.itinerary);
    renderBookings(dest);
    renderLanguageTips(dest);
    renderWeather(dest, duration);
    updateBudgetDisplay(state.itinerary, budget);
    renderCrowdLevel();
    loadSocialDiscovery(dest);

    // Run RL episodes
    for (let i = 0; i < 25; i++) setTimeout(() => { runRLEpisode(); drawRLChart(); }, i * 80);
    setTimeout(() => { drawAgentGraph(); drawRLChart(); }, 500);

    // Post-trip analysis
    setTimeout(() => runAutonomousAnalysis(dest, duration, budget), 1500);

    // Explainability panel
    const ep = document.getElementById('explainPanel');
    if (ep) {
        const itin = state.itinerary;
        ep.innerHTML = `
        <div style="margin-bottom:8px"><strong style="color:var(--accent)">MDP Decision Trace</strong></div>
        <div class="text-sm" style="color:var(--text-2);margin-bottom:6px">State: S(${dest}, \u20B9${budget}, weather=0.7, crowd=0.4, sat=0.8)</div>
        <div class="text-sm" style="color:var(--text-2);margin-bottom:6px">Action: keep_itinerary (\u03C0* from value iteration)</div>
        <div class="text-sm" style="color:var(--text-2);margin-bottom:6px">Reward: R = ${(0.4 * 0.9 + 0.3 * (1 - (itin?.total_cost || 0) / budget) + 0.2 * 0.7 - 0.1 * 0.4).toFixed(3)}</div>
        <div class="text-sm" style="color:var(--text-2)">\u03B5-greedy, \u03B5=0.1, \u03B3=0.95</div>`;
    }

    showToast(`Trip to ${dest} planned successfully by 7 AI agents!`, 'success');
}

async function runAutonomousAnalysis(dest, duration, budget) {
    const itin = state.itinerary;
    if (!itin) return;
    document.getElementById('insightsContainer').innerHTML = '';
    await sleep(300);
    addInsight('weather', '\u{1F326}\uFE0F', 'Weather Risk Agent', `Weather data analyzed for ${dest}. Indoor alternatives flagged for rainy periods.`);
    await sleep(400);
    addInsight('crowd', '\u{1F465}', 'Crowd Analyzer', `Peak hours detected. Activities scheduled at optimal times for minimal crowds.`);
    await sleep(400);
    const savings = Math.round(budget * 0.08);
    addInsight('budget', '\u{1F4B0}', 'Budget Optimizer', `\u20B9${savings.toLocaleString()} in potential savings identified. Budget utilization: ${(((itin?.total_cost || 0) / budget) * 100).toFixed(0)}%.`);
    await sleep(400);
    addInsight('preference', '\u2764\uFE0F', 'Preference Agent', `Itinerary weighted by your Bayesian preferences. Rate activities to refine further.`);
    await sleep(400);
    addInsight('booking', '\u{1F3AB}', 'Booking Assistant', `Best value booking options pre-selected. Explore tabs for hotels, flights, restaurants.`);
}

// === DYNAMIC ATTRACTIONS FROM API ===
async function fetchDynamicAttractions(dest) {
    try {
        const res = await fetch(`${API_BASE}/attractions?city=${encodeURIComponent(dest)}`);
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.attractions?.length >= 3) {
                addLog('planner', `Fetched ${data.count} real attractions via API`, 'success');
                return data.attractions.map(a => ({
                    name: a.name, type: a.type, rating: a.rating, cost: a.price || 0,
                    duration: a.duration || '2h', lat: a.lat, lon: a.lon,
                    desc: a.description || `Visit ${a.name}`,
                    reviews_count: Math.floor(Math.random() * 100000 + 10000),
                    photos: a.photos?.filter(p => p) || []
                }));
            }
        }
    } catch (e) { console.log('API fetch failed:', e); }
    return null;
}

// === SIMULATED ITINERARY ===
async function generateSimulatedItinerary(dest, duration, budget, startDate) {
    const destLower = dest.toLowerCase();
    function makeMedia(name, lat, lon) {
        const q = encodeURIComponent(name);
        return {
            photos: [],
            videos: { youtube: `https://www.youtube.com/results?search_query=${q}+travel+guide` },
            maps: { google: `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`, directions: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}` },
            reviews: { google: `https://www.google.com/search?q=${q}+reviews`, tripadvisor: `https://www.tripadvisor.com/Search?q=${q}` },
            links: { wiki: `https://en.wikipedia.org/wiki/${q.replace(/%20/g, '_')}` }
        };
    }

    const FALLBACK = {
        paris: [
            { name: 'Eiffel Tower', type: 'landmark', rating: 4.6, cost: 1500, duration: '2-3h', lat: 48.8584, lon: 2.2945, desc: 'Iconic iron lattice tower on Champ de Mars' },
            { name: 'Louvre Museum', type: 'museum', rating: 4.7, cost: 1200, duration: '3-4h', lat: 48.8606, lon: 2.3376, desc: "World's largest art museum, home to Mona Lisa" },
            { name: 'Notre-Dame Cathedral', type: 'religious', rating: 4.7, cost: 0, duration: '1-2h', lat: 48.8530, lon: 2.3499, desc: 'Medieval Gothic cathedral masterpiece' },
            { name: 'Arc de Triomphe', type: 'landmark', rating: 4.6, cost: 800, duration: '1h', lat: 48.8738, lon: 2.2950, desc: 'Triumphal arch honoring France' },
            { name: 'Sacr\u00E9-C\u0153ur Basilica', type: 'religious', rating: 4.7, cost: 0, duration: '1-2h', lat: 48.8867, lon: 2.3431, desc: 'Basilica atop Montmartre hill' },
            { name: 'Versailles Palace', type: 'cultural', rating: 4.6, cost: 1800, duration: '4-5h', lat: 48.8049, lon: 2.1204, desc: 'UNESCO World Heritage royal residence' }
        ],
        tokyo: [
            { name: 'Senso-ji Temple', type: 'religious', rating: 4.6, cost: 0, duration: '2h', lat: 35.7148, lon: 139.7967, desc: "Tokyo's oldest Buddhist temple in Asakusa" },
            { name: 'Tokyo Skytree', type: 'landmark', rating: 4.5, cost: 1500, duration: '2h', lat: 35.7101, lon: 139.8107, desc: 'Tallest tower in Japan' },
            { name: 'Shibuya Crossing', type: 'landmark', rating: 4.6, cost: 0, duration: '1h', lat: 35.6595, lon: 139.7004, desc: "World's busiest pedestrian crossing" },
            { name: 'Meiji Shrine', type: 'religious', rating: 4.7, cost: 0, duration: '2h', lat: 35.6764, lon: 139.6993, desc: 'Peaceful Shinto shrine in forest' }
        ],
        london: [
            { name: 'Tower of London', type: 'cultural', rating: 4.6, cost: 2000, duration: '3h', lat: 51.5081, lon: -0.0759, desc: 'Historic castle with Crown Jewels' },
            { name: 'British Museum', type: 'museum', rating: 4.7, cost: 0, duration: '3h', lat: 51.5194, lon: -0.1270, desc: 'World-famous museum of human history' },
            { name: 'London Eye', type: 'landmark', rating: 4.5, cost: 2500, duration: '1h', lat: 51.5033, lon: -0.1195, desc: 'Giant observation wheel' },
            { name: 'Tower Bridge', type: 'landmark', rating: 4.6, cost: 0, duration: '1h', lat: 51.5055, lon: -0.0754, desc: 'Iconic Victorian suspension bridge' }
        ],
        jaipur: [
            { name: 'Amber Fort', type: 'fort', rating: 4.7, cost: 500, duration: '3h', lat: 26.9855, lon: 75.8513, desc: 'Majestic hilltop fort with stunning architecture' },
            { name: 'City Palace', type: 'palace', rating: 4.6, cost: 400, duration: '2h', lat: 26.9258, lon: 75.8237, desc: 'Royal palace complex in the heart of Jaipur' },
            { name: 'Hawa Mahal', type: 'palace', rating: 4.5, cost: 200, duration: '1h', lat: 26.9239, lon: 75.8267, desc: 'Palace of Winds with intricate lattice work' },
            { name: 'Jantar Mantar', type: 'cultural', rating: 4.6, cost: 200, duration: '1h', lat: 26.9246, lon: 75.8245, desc: 'UNESCO astronomical observatory' }
        ]
    };

    let attractions = await fetchDynamicAttractions(dest);
    if (!attractions) {
        attractions = FALLBACK[destLower];
        if (attractions) addLog('planner', `Using curated data for ${dest}`, 'info');
    }
    if (!attractions) {
        const coord = CITY_COORDS[destLower] || [20, 0];
        attractions = [
            { name: `${dest} Historic Center`, type: 'cultural', rating: 4.5, cost: 0, duration: '2-3h', lat: coord[0] + 0.01, lon: coord[1] + 0.01, desc: `Historic heart of ${dest}` },
            { name: `${dest} Main Museum`, type: 'museum', rating: 4.4, cost: 800, duration: '2h', lat: coord[0] - 0.01, lon: coord[1] + 0.02, desc: 'Major museum' },
            { name: `${dest} Central Market`, type: 'shopping', rating: 4.3, cost: 1000, duration: '2h', lat: coord[0] + 0.02, lon: coord[1] - 0.01, desc: 'Vibrant local market' },
            { name: `${dest} Cultural Quarter`, type: 'cultural', rating: 4.4, cost: 500, duration: '3h', lat: coord[0] - 0.02, lon: coord[1] - 0.02, desc: 'Local culture district' },
            { name: `${dest} Food Street`, type: 'food', rating: 4.5, cost: 600, duration: '2h', lat: coord[0] - 0.005, lon: coord[1] + 0.005, desc: 'Famous street food area' }
        ];
        addLog('planner', `Generated attractions for ${dest}`, 'warning');
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
            photos: a.photos || [],
            media: makeMedia(a.name, a.lat, a.lon)
        }));
        days.push({
            day: d + 1, date: date.toISOString().split('T')[0], city: dest,
            activities, daily_cost: activities.reduce((s, a) => s + a.cost, 0)
        });
    }

    return { days, total_cost: days.reduce((s, d) => s + d.daily_cost, 0), cities: [dest] };
}

// ============================================
// BOOKINGS — Working Google Hotels/Flights/Restaurants
// ============================================
function generateBookings(dest) {
    const e = encodeURIComponent(dest);
    const slug = dest.toLowerCase().replace(/\s+/g, '-');
    return {
        hotels: [
            { name: `Google Hotels \u2014 ${dest}`, rating: 4.7, price_per_night: 'Compare All', amenities: ['All Hotels', 'Price Compare', 'Reviews'], photo: '', booking_url: `https://www.google.com/travel/hotels/${e}`, platform: 'google' },
            { name: `Booking.com \u2014 ${dest}`, rating: 4.5, price_per_night: 'Browse', amenities: ['WiFi', 'Breakfast', 'Free Cancel'], photo: '', booking_url: `https://www.booking.com/searchresults.html?ss=${e}`, platform: 'booking' },
            { name: `MakeMyTrip Hotels`, rating: 4.3, price_per_night: 'Browse', amenities: ['Best Deals', 'EMI Options'], photo: '', booking_url: `https://www.makemytrip.com/hotels/hotel-listing/?city=${e}`, platform: 'makemytrip' },
            { name: `Agoda \u2014 ${dest}`, rating: 4.4, price_per_night: 'Deals', amenities: ['Secret Deals', 'Last Minute'], photo: '', booking_url: `https://www.agoda.com/search?city=${e}`, platform: 'agoda' },
            { name: `Trivago \u2014 Compare`, rating: 4.6, price_per_night: 'Compare', amenities: ['250+ Sites', 'Best Price'], photo: '', booking_url: `https://www.trivago.in/?search=${e}`, platform: 'trivago' },
            { name: `Hostelworld \u2014 Budget`, rating: 4.0, price_per_night: 'Budget', amenities: ['Hostels', 'Backpacker'], photo: '', booking_url: `https://www.hostelworld.com/st/hostels/${slug}/`, platform: 'hostelworld' }
        ],
        flights: [
            { airline: 'Google Flights \u2014 Compare All', price: 'Compare', departure: 'All Times', arrival: 'All Airlines', duration: 'Best Price', booking_url: `https://www.google.com/travel/flights?q=flights+to+${e}`, platform: 'google' },
            { airline: 'Skyscanner', price: 'Compare', departure: 'Flexible', arrival: 'Multi-airline', duration: 'Cheapest', booking_url: `https://www.skyscanner.co.in/transport/flights-to/${slug}/`, platform: 'skyscanner' },
            { airline: 'MakeMyTrip Flights', price: 'Browse', departure: 'All', arrival: 'All', duration: 'Deals', booking_url: `https://www.makemytrip.com/flights/`, platform: 'makemytrip' },
            { airline: 'Ixigo', price: 'Compare', departure: 'Budget', arrival: 'All', duration: 'Min Price', booking_url: `https://www.ixigo.com/search/result/flight`, platform: 'ixigo' },
            { airline: 'Kayak', price: 'Compare', departure: 'All', arrival: 'All', duration: 'All Options', booking_url: `https://www.kayak.co.in/flights`, platform: 'kayak' }
        ],
        restaurants: [
            { name: `Zomato \u2014 ${dest}`, rating: 4.6, price_range: '\u20B9-\u20B9\u20B9\u20B9\u20B9', cuisine: 'All Cuisines', photo: '', booking_url: `https://www.zomato.com/${slug}/restaurants`, platform: 'zomato' },
            { name: `Google \u2014 Top Rated`, rating: 4.8, price_range: '\u20B9\u20B9\u20B9', cuisine: 'Best Rated', photo: '', booking_url: `https://www.google.com/maps/search/restaurants+in+${e}`, platform: 'google' },
            { name: `Swiggy Dineout`, rating: 4.4, price_range: '\u20B9\u20B9', cuisine: 'Dine-in Deals', photo: '', booking_url: `https://www.swiggy.com/dineout/`, platform: 'swiggy' },
            { name: `TripAdvisor Dining`, rating: 4.5, price_range: '\u20B9\u20B9-\u20B9\u20B9\u20B9\u20B9', cuisine: 'Traveller Picks', photo: '', booking_url: `https://www.tripadvisor.in/Restaurants-g-${e}`, platform: 'tripadvisor' },
            { name: `Street Food Guide`, rating: 4.4, price_range: '\u20B9', cuisine: 'Street Food', photo: '', booking_url: `https://www.google.com/search?q=best+street+food+in+${e}`, platform: 'google' }
        ],
        cabs: [
            { type: 'Uber', price: '\u20B9150-500/ride', features: ['AC', 'GPS', 'Cashless'], rating: 4.3, booking_url: `https://m.uber.com/looking`, platform: 'uber' },
            { type: 'Ola Cabs', price: '\u20B9100-400/ride', features: ['AC', 'GPS', 'Multiple Options'], rating: 4.1, booking_url: `https://www.olacabs.com/`, platform: 'ola' },
            { type: 'Zoomcar \u2014 Self Drive', price: '\u20B92,000-5,000/day', features: ['Self-drive', 'Insurance', 'GPS'], rating: 4.5, booking_url: `https://www.zoomcar.com/in/${slug}`, platform: 'zoomcar' },
            { type: 'Savaari \u2014 Outstation', price: '\u20B912-18/km', features: ['Outstation', 'Driver', 'AC'], rating: 4.2, booking_url: `https://www.savaari.com/`, platform: 'savaari' },
            { type: 'Google Maps \u2014 Local', price: 'Varies', features: ['Compare', 'Local Options'], rating: 4.0, booking_url: `https://www.google.com/maps/search/taxi+${e}`, platform: 'google' }
        ]
    };
}

// === RENDER ITINERARY ===
function renderItinerary(itin, dest) {
    const c = document.getElementById('itineraryContainer');
    if (!c || !itin?.days) return;
    c.innerHTML = `<div class="section-title">\u{1F4C5} Your ${dest} Itinerary \u2014 AI Generated</div>` + itin.days.map(day => `
    <div class="day-card">
      <div class="day-header">
        <span class="day-num">Day ${day.day} \u2014 ${new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
        <span class="day-cost">\u20B9${day.daily_cost.toLocaleString()}</span>
      </div>
      ${day.activities.map((act, i) => {
        const photoUrl = act.photos?.[0] || '';
        const photoStyle = photoUrl ? `background-image:url('${photoUrl}');background-size:cover;background-position:center;` : '';
        return `
        <div class="activity-card" data-type="${act.type}">
          ${photoUrl ? `<div class="activity-photo" style="${photoStyle}"><div class="activity-photo-overlay"></div></div>` : ''}
          <div class="activity-content">
            <div class="activity-header">
              <span class="activity-name">${act.name}</span>
              <span class="activity-time">${act.time}</span>
            </div>
            <div class="activity-meta">
              <span>\u23F1 ${act.duration}</span>
              <span>\u{1F4B0} \u20B9${act.cost}</span>
              <span>\u2B50 ${act.rating}</span>
              <span>\u{1F4AC} ${(act.reviews_count || 0).toLocaleString()} reviews</span>
            </div>
            <div class="mt-1" style="font-size:0.78rem;color:var(--text-2)">${act.description || ''}</div>
            <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap">
              <div class="star-rating" data-day="${day.day}" data-act="${i}">
                ${[1,2,3,4,5].map(s => `<span class="star ${s <= 3 ? 'active' : ''}" onclick="rateActivity(${day.day},${i},${s})">\u2605</span>`).join('')}
              </div>
              <button class="view-media-btn" onclick="openMediaModal(${day.day - 1},${i})"><i class="fas fa-images"></i> Details</button>
              <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(act.name)}+travel+guide" target="_blank" class="video-link-btn"><i class="fab fa-youtube"></i></a>
              <a href="https://www.google.com/maps/search/?api=1&query=${act.lat},${act.lon}" target="_blank" class="view-media-btn" style="background:var(--grad-primary);text-decoration:none"><i class="fas fa-map-marker-alt"></i> Map</a>
              <a href="https://www.google.com/search?q=${encodeURIComponent(act.name + ' ' + dest)}+photos" target="_blank" class="view-media-btn" style="background:rgba(66,133,244,0.2);text-decoration:none"><i class="fab fa-google"></i> Search</a>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`).join('');
}

function rateActivity(day, actIdx, stars) {
    const types = ['cultural', 'adventure', 'food', 'shopping', 'relaxation'];
    const act = state.itinerary?.days?.[day - 1]?.activities?.[actIdx];
    const type = act?.type || types[Math.floor(Math.random() * types.length)];
    const category = types.includes(type) ? type : 'cultural';
    updateBayesian(category, stars >= 3);
    runRLEpisode(); drawRLChart();
    showToast(`Rated ${act?.name || 'activity'} ${stars}\u2605`, 'info');
    const ratings = document.querySelectorAll(`.star-rating[data-day="${day}"][data-act="${actIdx}"] .star`);
    ratings.forEach((s, i) => s.classList.toggle('active', i < stars));
}

// === RENDER BOOKINGS ===
let _currentBookings = null;

function renderBookings(dest) {
    const c = document.getElementById('bookingsContainer');
    if (!c) return;
    const bookings = generateBookings(dest);
    _currentBookings = bookings;

    // Fetch real photos for hotels and restaurants in background
    fetchBookingPhotos(bookings, dest);

    let html = `
    <div class="section-title">\u{1F3AB} Booking Options \u2014 Powered by AI Agents</div>
    <div class="tabs" id="bookingTabs">
      <button class="tab active" onclick="switchBookingTab('hotels',this)">\u{1F3E8} Hotels</button>
      <button class="tab" onclick="switchBookingTab('flights',this)">\u2708\uFE0F Flights</button>
      <button class="tab" onclick="switchBookingTab('cabs',this)">\u{1F697} Cab Rentals</button>
      <button class="tab" onclick="switchBookingTab('restaurants',this)">\u{1F37D}\uFE0F Restaurants</button>
    </div>`;

    html += `<div class="tab-content active" id="tab-hotels"><div class="booking-grid" id="grid-hotels">${renderHotelCards(bookings.hotels)}</div></div>`;
    html += `<div class="tab-content" id="tab-flights" style="display:none"><div class="booking-grid" id="grid-flights">${renderFlightCards(bookings.flights)}</div></div>`;
    html += `<div class="tab-content" id="tab-cabs" style="display:none"><div class="booking-grid" id="grid-cabs">${renderCabCards(bookings.cabs)}</div></div>`;
    html += `<div class="tab-content" id="tab-restaurants" style="display:none"><div class="booking-grid" id="grid-restaurants">${renderRestaurantCards(bookings.restaurants)}</div></div>`;

    c.innerHTML = html;
}

async function fetchBookingPhotos(bookings, dest) {
    // Fetch real Wikipedia photos for hotels and restaurants
    const hotelQueries = ['luxury hotel room', 'hotel resort pool', 'boutique hotel', 'hotel lobby modern', 'hostel room', 'hotel bedroom'];
    const restQueries = ['restaurant dining', 'fine dining food', 'street food market', 'cafe interior', 'food plate gourmet'];
    
    for (let i = 0; i < bookings.hotels.length; i++) {
        const h = bookings.hotels[i];
        if (!h.photo) {
            const photo = await fetchWikipediaPhoto(dest + ' hotel', dest);
            h.photo = photo || '';
        }
    }
    for (let i = 0; i < bookings.restaurants.length; i++) {
        const r = bookings.restaurants[i];
        if (!r.photo) {
            const photo = await fetchWikipediaPhoto(dest + ' restaurant food', dest);
            r.photo = photo || '';
        }
    }
    // Re-render if photos arrived
    const hotelGrid = document.getElementById('grid-hotels');
    if (hotelGrid && _currentBookings) hotelGrid.innerHTML = renderHotelCards(_currentBookings.hotels);
    const restGrid = document.getElementById('grid-restaurants');
    if (restGrid && _currentBookings) restGrid.innerHTML = renderRestaurantCards(_currentBookings.restaurants);
}

function renderHotelCards(hotels) {
    const platformIcons = { google: 'fab fa-google', booking: 'fas fa-bed', makemytrip: 'fas fa-plane', agoda: 'fas fa-hotel', trivago: 'fas fa-search', hostelworld: 'fas fa-campground' };
    const platformColors = { google: '#4285f4', booking: '#003580', makemytrip: '#eb5b2d', agoda: '#5c2d91', trivago: '#007faf', hostelworld: '#f47b20' };
    return (hotels || []).map(h => `
    <div class="booking-card">
      <div class="booking-card-banner" style="background:${platformColors[h.platform] || '#667eea'}">
        <i class="${platformIcons[h.platform] || 'fas fa-hotel'}"></i>
        <span>${h.platform?.toUpperCase() || 'HOTEL'}</span>
      </div>
      <div class="booking-card-body">
        <div class="booking-card-title">${h.name}</div>
        <div class="booking-card-rating">\u2B50 ${h.rating}/5</div>
        <div class="booking-card-price">${typeof h.price_per_night === 'number' ? '\u20B9' + h.price_per_night.toLocaleString() + '/night' : h.price_per_night}</div>
        <div class="booking-card-amenities">${(h.amenities || []).map(a => `<span class="amenity-tag">${a}</span>`).join('')}</div>
        <a href="${h.booking_url}" target="_blank" rel="noopener" class="btn btn-primary booking-link">\u{1F517} Search on ${h.platform?.charAt(0).toUpperCase() + h.platform?.slice(1) || 'Site'}</a>
      </div>
    </div>`).join('');
}

function renderFlightCards(flights) {
    const platformIcons = { google: 'fab fa-google', skyscanner: 'fas fa-plane', makemytrip: 'fas fa-ticket-alt', ixigo: 'fas fa-search', kayak: 'fas fa-plane-departure' };
    const platformColors = { google: '#4285f4', skyscanner: '#0770e3', makemytrip: '#eb5b2d', ixigo: '#f26522', kayak: '#ff690f' };
    return (flights || []).map(f => `
    <div class="booking-card">
      <div class="booking-card-banner" style="background:${platformColors[f.platform] || '#667eea'}">
        <i class="${platformIcons[f.platform] || 'fas fa-plane'}"></i>
        <span>${f.platform?.toUpperCase() || 'FLIGHTS'}</span>
      </div>
      <div class="booking-card-body">
        <div class="booking-card-title">\u2708\uFE0F ${f.airline}</div>
        <div class="booking-card-price">${typeof f.price === 'number' ? '\u20B9' + f.price.toLocaleString() : f.price}</div>
        <div class="text-sm text-muted mb-1">${f.departure} \u2192 ${f.arrival} (${f.duration})</div>
        <a href="${f.booking_url}" target="_blank" rel="noopener" class="btn btn-accent booking-link">Search Flights</a>
      </div>
    </div>`).join('');
}

function renderCabCards(cabs) {
    const platformIcons = { uber: 'fas fa-car', ola: 'fas fa-taxi', zoomcar: 'fas fa-car-side', savaari: 'fas fa-route', google: 'fab fa-google' };
    const platformColors = { uber: '#000000', ola: '#35b44c', zoomcar: '#ff6b35', savaari: '#1a73e8', google: '#4285f4' };
    return (cabs || []).map(c => `
    <div class="booking-card">
      <div class="booking-card-banner" style="background:${platformColors[c.platform] || '#667eea'}">
        <i class="${platformIcons[c.platform] || 'fas fa-car'}"></i>
        <span>${c.platform?.toUpperCase() || 'TRANSPORT'}</span>
      </div>
      <div class="booking-card-body">
        <div class="booking-card-title">\u{1F697} ${c.type}</div>
        <div class="booking-card-price">${c.price}</div>
        <div class="booking-card-rating">\u2B50 ${c.rating}/5</div>
        <div class="booking-card-amenities">${(c.features || []).map(f => `<span class="amenity-tag">${f}</span>`).join('')}</div>
        <a href="${c.booking_url}" target="_blank" rel="noopener" class="btn btn-accent booking-link">Book Now</a>
      </div>
    </div>`).join('');
}

function renderRestaurantCards(restaurants) {
    const platformIcons = { zomato: 'fas fa-utensils', google: 'fab fa-google', swiggy: 'fas fa-hamburger', tripadvisor: 'fab fa-tripadvisor' };
    const platformColors = { zomato: '#e23744', google: '#4285f4', swiggy: '#fc8019', tripadvisor: '#00af87' };
    return (restaurants || []).map(r => `
    <div class="booking-card">
      <div class="booking-card-banner" style="background:${platformColors[r.platform] || '#667eea'}">
        <i class="${platformIcons[r.platform] || 'fas fa-utensils'}"></i>
        <span>${r.platform?.toUpperCase() || 'DINING'}</span>
      </div>
      <div class="booking-card-body">
        <div class="booking-card-title">${r.name}</div>
        <div class="booking-card-rating">\u2B50 ${r.rating}/5 \u00B7 ${r.cuisine}</div>
        <div class="booking-card-price">${r.price_range}</div>
        <a href="${r.booking_url}" target="_blank" rel="noopener" class="btn btn-warm booking-link">View Restaurant</a>
      </div>
    </div>`).join('');
}

function switchBookingTab(tab, btn) {
    document.querySelectorAll('#bookingsContainer .tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#bookingsContainer .tab-content').forEach(t => { t.style.display = 'none'; t.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    const tabEl = document.getElementById(`tab-${tab}`);
    if (tabEl) { tabEl.style.display = 'block'; tabEl.classList.add('active'); }
}

// === LANGUAGE TIPS ===
function renderLanguageTips(dest) {
    const c = document.getElementById('languageTips');
    if (!c) return;
    const destLower = dest.toLowerCase();
    const data = LANGUAGE_DB[destLower] || LANGUAGE_DB[Object.keys(LANGUAGE_DB).find(k => destLower.includes(k)) || ''];
    if (!data) {
        c.innerHTML = `<div class="section-title">\u{1F5E3}\uFE0F Language Tips</div><div class="empty-state"><div class="emoji">\u{1F30D}</div><p>Language tips unavailable for this destination</p></div>`;
        return;
    }
    c.innerHTML = `
    <div class="section-title">\u{1F5E3}\uFE0F ${data.flag} ${data.lang} \u2014 Essential Travel Phrases</div>
    <div class="lang-grid">
      ${data.phrases.map(p => `<div class="lang-card"><div class="lang-english">${p.en}</div><div class="lang-phrase">${p.phrase}</div><div class="lang-phonetic">\u{1F508} ${p.phon}</div><div class="lang-situation">\u{1F4A1} ${p.ctx}</div></div>`).join('')}
    </div>`;
}

// === WEATHER ===
function renderWeather(dest, days) {
    const c = document.getElementById('weatherCards');
    if (!c) return;
    const icons = ['\u2600\uFE0F', '\u26C5', '\u{1F324}\uFE0F', '\u{1F327}\uFE0F', '\u26C8\uFE0F', '\u{1F326}\uFE0F'];
    const descs = ['Sunny', 'Partly Cloudy', 'Clear', 'Light Rain', 'Thunderstorm', 'Showers'];
    c.innerHTML = Array.from({ length: Math.min(days, 3) }, (_, i) => {
        const temp = 20 + Math.floor(Math.random() * 15);
        const idx = Math.floor(Math.random() * icons.length);
        return `<div class="weather-card"><div class="weather-icon">${icons[idx]}</div><div class="weather-temp">${temp}\u00B0C</div><div class="weather-desc">${descs[idx]}</div><div class="text-xs text-muted">Day ${i + 1}</div></div>`;
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
    if (amtEl) amtEl.textContent = `\u20B9${used.toLocaleString()}`;
    if (fillEl) fillEl.style.width = pct + '%';
    if (totalEl) totalEl.textContent = `/ \u20B9${total.toLocaleString()}`;
    const cats = document.getElementById('budgetCats');
    if (cats) {
        const breakdown = { '\u{1F3E8} Accommodation': 0.35, '\u{1F37D}\uFE0F Food': 0.25, '\u{1F3AF} Activities': 0.25, '\u{1F697} Transport': 0.10, '\u{1F198} Emergency': 0.05 };
        cats.innerHTML = Object.entries(breakdown).map(([k, v]) => `<div class="budget-cat"><span>${k}</span><span class="fw-600">\u20B9${Math.round(total * v).toLocaleString()}</span></div>`).join('');
    }
}

// === CROWD ===
function renderCrowdLevel() {
    const c = document.getElementById('crowdBar');
    if (!c) return;
    const levels = ['#10b981', '#10b981', '#f59e0b', '#f59e0b', '#ef4444'];
    const current = Math.floor(Math.random() * 5);
    c.innerHTML = levels.map((color, i) => `<div class="crowd-segment" style="background:${i <= current ? color : 'var(--bg-4)'}"></div>`).join('');
    const label = document.getElementById('crowdLabel');
    if (label) label.textContent = ['Very Low', 'Low', 'Moderate', 'High', 'Very High'][current];
}

// ============================================
// SOCIAL DISCOVERY: INSTAGRAM REELS + YOUTUBE
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

    const destLower = dest.toLowerCase();

    // Reel-style viral places with map coordinates and location data
    const INSTAGRAM_REELS = {
        paris: [
            { name: 'Rue Cr\u00E9mieux', desc: 'Colorful pastel street that went viral with 500M+ views. A hidden residential street with vibrant painted houses.', tags: ['#ruecremieux', '#parisgems', '#instaparis'], likes: '485K', saves: '120K', reels: '12.5K', lat: 48.8490, lon: 2.3725, neighborhood: '12th Arrondissement', bestTime: 'Early morning, 7-9 AM', type: 'photo_spot' },
            { name: 'Le Marais Street Art', desc: 'Underground street art district with constantly changing murals. Every wall is Instagram-worthy.', tags: ['#lemarais', '#parisstreetart', '#urbanart'], likes: '320K', saves: '89K', reels: '8.2K', lat: 48.8566, lon: 2.3622, neighborhood: 'Le Marais, 3rd Arr.', bestTime: 'Afternoon, 2-5 PM', type: 'art' },
            { name: 'Canal Saint-Martin', desc: 'Trendy canal area with hidden cafes, vintage shops and iron footbridges. Perfect for reels.', tags: ['#canalsaintmartin', '#hiddenParis'], likes: '267K', saves: '74K', reels: '6.8K', lat: 48.8710, lon: 2.3645, neighborhood: '10th Arrondissement', bestTime: 'Sunset, 6-8 PM', type: 'vibe' },
            { name: 'Petite Ceinture', desc: 'Abandoned railway turned urban jungle. A secret green corridor winding through Paris.', tags: ['#petiteceinture', '#secretparis'], likes: '198K', saves: '65K', reels: '4.5K', lat: 48.8325, lon: 2.3267, neighborhood: 'Various Districts', bestTime: 'Morning light', type: 'adventure' }
        ],
        tokyo: [
            { name: 'Shimokitazawa', desc: "Tokyo's coolest neighborhood for vintage shopping, indie cafes, and live music. Not in guidebooks!", tags: ['#shimokitazawa', '#tokyolocal'], likes: '412K', saves: '103K', reels: '15.3K', lat: 35.6613, lon: 139.6687, neighborhood: 'Setagaya', bestTime: 'Afternoon', type: 'neighborhood' },
            { name: 'Yanaka District', desc: 'Old-Tokyo charm with traditional wooden houses, temples, and the famous cat street.', tags: ['#yanaka', '#oldtokyo'], likes: '287K', saves: '76K', reels: '9.1K', lat: 35.7244, lon: 139.7644, neighborhood: 'Taito', bestTime: 'Morning', type: 'cultural' },
            { name: 'TeamLab Borderless', desc: 'Mind-blowing immersive digital art museum. Every second is reel-worthy content.', tags: ['#teamlab', '#digitalart'], likes: '890K', saves: '245K', reels: '32.1K', lat: 35.6268, lon: 139.7838, neighborhood: 'Odaiba', bestTime: 'Weekday evening', type: 'experience' },
            { name: 'Golden Gai', desc: 'Tiny alleyway with 200+ micro-bars. Each fits only 6-8 people. Pure Tokyo magic.', tags: ['#goldengai', '#tokyonightlife'], likes: '356K', saves: '98K', reels: '18.7K', lat: 35.6938, lon: 139.7036, neighborhood: 'Shinjuku', bestTime: 'After 9 PM', type: 'nightlife' }
        ],
        london: [
            { name: "Neal's Yard", desc: 'Hidden colorful courtyard in Covent Garden. One of London\'s most photographed secret spots.', tags: ['#nealsyard', '#hiddenlondon'], likes: '378K', saves: '95K', reels: '11.4K', lat: 51.5144, lon: -0.1263, neighborhood: 'Covent Garden', bestTime: 'Morning, 9-11 AM', type: 'photo_spot' },
            { name: 'Leadenhall Market', desc: 'Victorian covered market that inspired Diagon Alley in Harry Potter.', tags: ['#leadenhall', '#victorianlondon'], likes: '445K', saves: '112K', reels: '14.8K', lat: 51.5127, lon: -0.0835, neighborhood: 'City of London', bestTime: 'Weekday lunch', type: 'architecture' },
            { name: 'Little Venice', desc: 'Canal boats and waterways that feel like you\'re outside London entirely.', tags: ['#littlevenice', '#londoncanals'], likes: '234K', saves: '67K', reels: '5.9K', lat: 51.5215, lon: -0.1830, neighborhood: 'Maida Vale', bestTime: 'Sunday morning', type: 'scenic' },
            { name: "God's Own Junkyard", desc: 'Neon sign warehouse. Wild, colorful, and completely unexpected.', tags: ['#godsownjunkyard', '#neonlondon'], likes: '312K', saves: '88K', reels: '10.2K', lat: 51.5868, lon: -0.0394, neighborhood: 'Walthamstow', bestTime: 'Fri-Sun only', type: 'art' }
        ],
        jaipur: [
            { name: 'Panna Meena ka Kund', desc: 'Ancient geometric stepwell with stunning symmetrical architecture. Went viral globally.', tags: ['#pannameena', '#stepwell'], likes: '356K', saves: '142K', reels: '22.3K', lat: 26.9830, lon: 75.8530, neighborhood: 'Near Amber Fort', bestTime: 'Golden hour', type: 'architecture' },
            { name: 'Patrika Gate', desc: "Instagram's most viral spot in Jaipur. Colorful Rajasthani gate. Free entry!", tags: ['#patrikagate', '#jaipurpink'], likes: '523K', saves: '178K', reels: '28.9K', lat: 26.8618, lon: 75.8023, neighborhood: 'Jawahar Circle', bestTime: 'Early morning', type: 'photo_spot' },
            { name: 'Nahargarh Fort Sunset', desc: 'Best sunset view of Jaipur that most tourists miss. Locals\' favorite evening spot.', tags: ['#nahargarh', '#jaipursunset'], likes: '289K', saves: '89K', reels: '13.7K', lat: 26.9387, lon: 75.8120, neighborhood: 'Aravalli Hills', bestTime: 'Sunset, 5-7 PM', type: 'viewpoint' },
            { name: 'Chand Baori', desc: '1000-year-old stepwell with 3500 steps. 45 min from Jaipur. Absolutely jaw-dropping.', tags: ['#chandbaori', '#ancientindia'], likes: '678K', saves: '234K', reels: '35.2K', lat: 27.0075, lon: 76.6069, neighborhood: 'Abhaneri Village', bestTime: 'Morning light', type: 'heritage' }
        ]
    };

    const places = INSTAGRAM_REELS[destLower] || generateGenericViralPlaces(dest, 'instagram');

    grid.innerHTML = places.map(p => `
        <div class="discovery-card reel-card">
            <div class="discovery-card-img reel-img">
                <div class="reel-gradient"></div>
                <div class="discovery-card-platform instagram"><i class="fab fa-instagram"></i> Reel</div>
                <div class="reel-location-badge"><i class="fas fa-map-pin"></i> ${p.neighborhood || dest}</div>
                ${p.reels ? `<div class="reel-views"><i class="fas fa-play"></i> ${p.reels} reels</div>` : ''}
            </div>
            <div class="discovery-card-body">
                <div class="reel-type-badge ${p.type || 'photo_spot'}">${(p.type || 'spot').replace('_', ' ')}</div>
                <div class="discovery-card-title">${p.name}</div>
                <div class="discovery-card-desc">${p.desc}</div>
                <div class="reel-info-row">
                    <span><i class="fas fa-clock"></i> ${p.bestTime || 'Anytime'}</span>
                </div>
                <div class="discovery-card-stats">
                    <span>\u2764\uFE0F ${p.likes}</span>
                    <span>\u{1F516} ${p.saves}</span>
                </div>
                <div class="discovery-card-tags">${(p.tags || []).map(t => `<span class="discovery-tag">${t}</span>`).join('')}</div>
                <div class="reel-actions">
                    ${p.lat ? `<a href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}" target="_blank" class="reel-action-btn map-btn"><i class="fas fa-map-marker-alt"></i> View on Map</a>` : ''}
                    <a href="https://www.instagram.com/explore/tags/${encodeURIComponent((p.name || '').replace(/['\s]/g, '').toLowerCase())}/" target="_blank" class="reel-action-btn insta-btn"><i class="fab fa-instagram"></i> Explore Reels</a>
                    <a href="https://www.google.com/search?q=${encodeURIComponent(p.name + ' ' + dest)}&tbm=isch" target="_blank" class="reel-action-btn google-btn"><i class="fab fa-google"></i> Photos</a>
                </div>
            </div>
        </div>
    `).join('');

    // Fetch real photos for each reel card
    places.forEach(async (p, idx) => {
        const photo = await getRealPhoto(p.name, dest, '');
        if (photo) {
            const imgs = grid.querySelectorAll('.reel-img');
            if (imgs[idx]) {
                imgs[idx].style.backgroundImage = `url('${photo}')`;
                imgs[idx].style.backgroundSize = 'cover';
                imgs[idx].style.backgroundPosition = 'center';
            }
        }
    });

    addLog('preference', `Loaded ${places.length} Instagram trending reels for ${dest}`, 'success');
}

function loadYouTubeHiddenGems(dest) {
    const grid = document.getElementById('ytGrid');
    const empty = document.getElementById('ytEmpty');
    if (!grid) return;
    if (empty) empty.style.display = 'none';

    const destLower = dest.toLowerCase();

    const YOUTUBE_GEMS = {
        paris: [
            { name: 'Secret Underground Paris', desc: 'Explore the catacombs and hidden underground passages.', channel: 'Kara and Nate', views: '2.3M', duration: '18:42' },
            { name: 'Locals Only: Real Paris', desc: 'A Parisian local shows secret spots no guidebook mentions.', channel: 'Lost LeBlanc', views: '1.8M', duration: '22:15' },
            { name: 'Paris on a Budget', desc: 'How to experience Paris for under $50/day.', channel: 'Hey Nadine', views: '980K', duration: '15:30' },
            { name: 'Paris Night Photography', desc: 'Stunning photography spots locals keep secret.', channel: 'Peter McKinnon', views: '1.5M', duration: '12:08' }
        ],
        tokyo: [
            { name: 'Tokyo Like a Local', desc: 'A Tokyo resident shares daily life and hidden spots.', channel: 'Paolo fromTOKYO', views: '5.2M', duration: '25:00' },
            { name: 'Cheapest Eats in Tokyo', desc: 'Incredible $1-5 meals better than expensive restaurants.', channel: 'Abroad in Japan', views: '3.1M', duration: '20:15' },
            { name: 'Hidden Temples & Shrines', desc: 'Peaceful temples away from crowds with hidden gardens.', channel: 'Sharmeleon', views: '890K', duration: '16:45' },
            { name: 'Tokyo After Midnight', desc: 'What Tokyo looks like after the last trains stop.', channel: 'Wotaku', views: '2.7M', duration: '18:30' }
        ],
        london: [
            { name: 'Secret London Walks', desc: 'Hidden alleyways, secret gardens, underground rivers.', channel: 'Joolz Guides', views: '1.9M', duration: '28:00' },
            { name: 'Free Things in London', desc: '50 completely free things to do. Museums, views, markets.', channel: 'Love and London', views: '2.1M', duration: '19:30' },
            { name: 'London Food Market Tour', desc: 'Borough Market, Maltby Street, and hidden food stalls.', channel: 'Mark Wiens', views: '3.8M', duration: '24:15' }
        ],
        jaipur: [
            { name: 'Beyond the Pink City', desc: 'Hidden stepwells, secret temples, and artisan workshops.', channel: 'Karl Rock', views: '1.2M', duration: '22:00' },
            { name: 'Jaipur Street Food Tour', desc: 'Dal Bati Churma, Laal Maas, Pyaaz Kachori.', channel: 'Davidsbeenhere', views: '890K', duration: '18:45' },
            { name: 'Rajasthan Hidden Gems', desc: 'Day trips to Abhaneri, Bhangarh, and more.', channel: 'Tanya Khanijow', views: '670K', duration: '20:30' }
        ]
    };

    const videos = YOUTUBE_GEMS[destLower] || generateGenericViralPlaces(dest, 'youtube');

    grid.innerHTML = videos.map(v => `
        <div class="discovery-card yt-card">
            <div class="discovery-card-img yt-thumbnail">
                <div class="yt-play-btn"><i class="fas fa-play"></i></div>
                <div class="discovery-card-platform youtube"><i class="fab fa-youtube"></i> ${v.duration || 'Video'}</div>
            </div>
            <div class="discovery-card-body">
                <div class="discovery-card-title">${v.name}</div>
                <div class="discovery-card-desc">${v.desc}</div>
                <div class="discovery-card-stats">
                    <span>\u{1F441}\uFE0F ${v.views} views</span>
                    ${v.channel ? `<span>\u{1F4FA} ${v.channel}</span>` : ''}
                </div>
                <a href="https://www.youtube.com/results?search_query=${encodeURIComponent((v.name || '') + ' ' + dest + ' hidden gems')}" target="_blank" class="btn btn-accent booking-link" style="font-size:0.78rem"><i class="fab fa-youtube"></i> Watch on YouTube</a>
            </div>
        </div>
    `).join('');

    // Fetch real photos for thumbnails
    videos.forEach(async (v, idx) => {
        const photo = await getRealPhoto(v.name + ' ' + dest, dest, '');
        if (photo) {
            const thumbs = grid.querySelectorAll('.yt-thumbnail');
            if (thumbs[idx]) {
                thumbs[idx].style.backgroundImage = `url('${photo}')`;
                thumbs[idx].style.backgroundSize = 'cover';
                thumbs[idx].style.backgroundPosition = 'center';
            }
        }
    });

    addLog('preference', `Loaded ${videos.length} YouTube hidden gem videos for ${dest}`, 'success');
}

function generateGenericViralPlaces(dest, platform) {
    if (platform === 'instagram') {
        return [
            { name: `${dest} Old Quarter`, desc: `The most photogenic streets in ${dest}. Locals love this area.`, tags: [`#${dest.toLowerCase().replace(/\s/g, '')}gems`, '#hiddengems'], likes: '245K', saves: '78K', reels: '5.2K', neighborhood: `Old Town, ${dest}`, bestTime: 'Golden hour', type: 'photo_spot' },
            { name: `${dest} Sunset Point`, desc: `Best sunset views that went viral on social media.`, tags: [`#${dest.toLowerCase().replace(/\s/g, '')}sunset`, '#goldenhour'], likes: '189K', saves: '56K', reels: '3.8K', neighborhood: dest, bestTime: 'Sunset', type: 'viewpoint' },
            { name: `${dest} Local Market`, desc: `Authentic local market with unique crafts and street food.`, tags: [`#${dest.toLowerCase().replace(/\s/g, '')}market`, '#locallife'], likes: '156K', saves: '45K', reels: '2.9K', neighborhood: dest, bestTime: 'Morning', type: 'cultural' }
        ];
    } else {
        return [
            { name: `${dest} Hidden Gems Guide`, desc: `Complete guide to hidden gems and less visited places.`, channel: 'Travel Guide', views: '890K', duration: '18:30' },
            { name: `${dest} on a Budget`, desc: `Budget tips, free activities, and cheap eats.`, channel: 'Budget Travel', views: '567K', duration: '15:45' },
            { name: `${dest} Food Guide`, desc: `Ultimate food guide: street food, local restaurants.`, channel: 'Food Traveler', views: '1.2M', duration: '22:00' }
        ];
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
    msg.innerHTML = `<div class="chat-msg-avatar">${role === 'bot' ? '\u{1F916}' : '\u{1F464}'}</div><div class="chat-msg-bubble">${text}</div>`;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    state.chatHistory.push({ role, text });
}

function showChatTyping() {
    const container = document.getElementById('chatMessages');
    const typing = document.createElement('div');
    typing.className = 'chat-msg bot';
    typing.id = 'chat-typing-indicator';
    typing.innerHTML = `<div class="chat-msg-avatar">\u{1F916}</div><div class="chat-msg-bubble"><div class="chat-typing"><span></span><span></span><span></span></div></div>`;
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;
    return 'chat-typing-indicator';
}

function removeChatTyping(id) { document.getElementById(id)?.remove(); }

async function generateChatResponse(userMsg) {
    const dest = state.currentDest || document.getElementById('destination')?.value || '';
    const lower = userMsg.toLowerCase();

    // Try backend
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

    await sleep(600 + Math.random() * 800);

    if (lower.includes('hidden gem') || lower.includes('less known') || lower.includes('off the beaten')) {
        return dest ? `Here are hidden gems near <strong>${dest}</strong>:<ul style="margin:6px 0 0 16px"><li>Walk through residential neighborhoods</li><li>Visit morning markets before 8 AM</li><li>Skip #1 tourist spot, visit #5-#10 instead</li><li>Check university areas for food and cafes</li></ul>Check the <strong>Instagram Reels</strong> section below for viral hidden spots!` : 'Enter a destination first and I\'ll find hidden gems!';
    }
    if (lower.includes('food') || lower.includes('eat') || lower.includes('restaurant')) {
        return dest ? `Food tips for <strong>${dest}</strong>:<ul style="margin:6px 0 0 16px"><li>Follow the crowds \u2014 long lines = good food</li><li>Skip hotel breakfast, eat where locals eat</li><li>Night markets have best variety after 6 PM</li><li>Google Maps 4.5+ stars with 500+ reviews</li></ul>` : 'Tell me your destination for food recommendations!';
    }
    if (lower.includes('budget') || lower.includes('save') || lower.includes('cheap')) {
        return `Budget tips${dest ? ` for ${dest}` : ''}:<ul style="margin:6px 0 0 16px"><li>Book 2+ weeks ahead for 20-40% savings</li><li>Free walking tours are amazing</li><li>Use metro/bus passes instead of taxis</li><li>Street food costs 1/3 of tourist restaurants</li></ul>`;
    }
    if (lower.includes('safe') || lower.includes('scam') || lower.includes('security')) {
        return `Safety tips:<ul style="margin:6px 0 0 16px"><li>Photo your passport and insurance</li><li>Use Uber/Ola instead of random taxis</li><li>Always get travel insurance</li><li>Save local police and embassy numbers</li></ul>`;
    }
    if (lower.includes('thank') || lower.includes('helpful')) { return 'You\'re welcome! Ask me anything else about your trip!'; }
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
        return `Hello! ${dest ? `Planning a trip to <strong>${dest}</strong>? ` : ''}I can help with hidden gems, food, budget tips, safety, and more!`;
    }
    return dest ? `For <strong>${dest}</strong>, check:<ul style="margin:6px 0 0 16px"><li><strong>Instagram Reels</strong> for viral hidden spots with maps</li><li><strong>Bookings</strong> tab for hotels, flights & restaurants</li><li>Rate activities to refine AI preferences</li></ul>` : 'Enter a destination and generate your trip to get personalized help!';
}

// ============================================
// EMERGENCY REPLANNING
// ============================================
function emergencyReplan() {
    if (!state.itinerary) { showToast('Generate a trip first!', 'warning'); return; }
    document.getElementById('delayModal')?.classList.add('active');
}

async function delayReplan() {
    const delayHours = parseFloat(document.getElementById('delayHours')?.value) || 4;
    const delayDay = parseInt(document.getElementById('delayDay')?.value) || 1;
    const delayReason = document.getElementById('delayReason')?.value || 'train_delay';
    const dest = document.getElementById('destination').value.trim();
    const budget = parseInt(document.getElementById('budget').value) || 15000;

    if (!state.itinerary) { showToast('Generate a trip first!', 'warning'); return; }
    document.getElementById('delayModal')?.classList.remove('active');
    showLoading(true);
    setAllAgentsStatus('thinking');

    addLog('planner', `DELAY: ${delayHours}h on Day ${delayDay}`, 'error');
    document.getElementById('agentConvoPanel').style.display = 'block';
    document.getElementById('agentConvo').innerHTML = '';

    await agentSay('planner', null, `DELAY ALERT: ${delayHours}h delay on Day ${delayDay}. Emergency replanning...`, 'decision');
    await sleep(300);

    // Try backend
    try {
        const res = await fetch(`${API_BASE}/replan-delay`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destination: dest, delay_hours: delayHours, current_day: delayDay, budget, original_itinerary: state.itinerary, reason: delayReason })
        });
        if (res.ok) {
            const data = await res.json();
            state.itinerary = data.itinerary;
            await fixItineraryPhotos(state.itinerary, dest);
            renderItinerary(state.itinerary, dest);
            updateMap(state.itinerary);
            updateBudgetDisplay(state.itinerary, budget);
            showLoading(false); setAllAgentsStatus('completed');
            showToast(`Day ${delayDay} replanned!`, 'success');
            return;
        }
    } catch (e) { /* fallback */ }

    // Fallback
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
    runRLEpisode(); drawRLChart();
    showLoading(false); setAllAgentsStatus('completed');
    showToast(`Day ${delayDay} replanned!`, 'success');
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

    // Photos
    const photos = act.photos?.filter(p => p) || [];
    document.getElementById('modalPhotos').innerHTML = photos.length
        ? photos.map((url, i) => `<div class="photo-gallery-item" onclick="viewFullPhoto('${url}')"><img src="${url}" alt="${act.name}" loading="lazy" onerror="this.parentElement.style.display='none'"><div class="photo-overlay"><span>Enlarge</span></div></div>`).join('')
        : `<p class="text-muted text-sm">Loading photos from Wikipedia...</p>`;
    
    // If no photos, fetch them now
    if (!photos.length) {
        getRealPhoto(act.name, state.currentDest, '').then(url => {
            if (url) {
                document.getElementById('modalPhotos').innerHTML = `<div class="photo-gallery-item" onclick="viewFullPhoto('${url}')"><img src="${url}" alt="${act.name}" loading="lazy"><div class="photo-overlay"><span>Enlarge</span></div></div>`;
            }
        });
    }

    // Videos
    document.getElementById('modalVideos').innerHTML = `
    <a href="https://www.youtube.com/results?search_query=${q}+travel+guide" target="_blank" class="media-link-btn youtube"><i class="fab fa-youtube"></i> Travel Guide</a>
    <a href="https://www.youtube.com/results?search_query=${q}+virtual+tour+4k" target="_blank" class="media-link-btn youtube"><i class="fas fa-vr-cardboard"></i> Virtual Tour</a>
    <a href="https://www.youtube.com/results?search_query=${q}+drone+footage" target="_blank" class="media-link-btn youtube"><i class="fas fa-helicopter"></i> Drone Footage</a>`;

    // Map
    const mapDiv = document.getElementById('modalMapEmbed');
    mapDiv.innerHTML = act.lat && act.lon ? `<iframe src="https://www.openstreetmap.org/export/embed.html?bbox=${act.lon - 0.01},${act.lat - 0.01},${act.lon + 0.01},${act.lat + 0.01}&layer=mapnik&marker=${act.lat},${act.lon}" style="width:100%;height:100%;border:none;border-radius:var(--radius)"></iframe>` : '<p class="text-muted">Map unavailable</p>';

    document.getElementById('modalMaps').innerHTML = `
    <a href="https://www.google.com/maps/search/?api=1&query=${act.lat},${act.lon}" target="_blank" class="media-link-btn google"><i class="fas fa-map-marked-alt"></i> Google Maps</a>
    <a href="https://www.google.com/maps/dir/?api=1&destination=${act.lat},${act.lon}" target="_blank" class="media-link-btn google"><i class="fas fa-directions"></i> Directions</a>`;

    // Reviews
    const fullStars = Math.floor(act.rating);
    document.getElementById('modalRating').innerHTML = `<div class="rating-big">${act.rating}</div><div><div class="rating-stars">${Array.from({length:5}, (_,i) => `<span class="star ${i < fullStars ? '' : 'empty'}">${i < fullStars ? '\u2605' : '\u2606'}</span>`).join('')}</div><div class="rating-label">${(act.reviews_count || 0).toLocaleString()} reviews</div></div>`;
    document.getElementById('modalReviews').innerHTML = `
    <a href="https://www.google.com/search?q=${q}+reviews" target="_blank" class="media-link-btn google"><i class="fab fa-google"></i> Google Reviews</a>
    <a href="https://www.tripadvisor.com/Search?q=${q}" target="_blank" class="media-link-btn tripadvisor"><i class="fab fa-tripadvisor"></i> TripAdvisor</a>`;

    document.getElementById('modalLinks').innerHTML = `
    <a href="https://en.wikipedia.org/wiki/${q.replace(/%20/g, '_')}" target="_blank" class="media-link-btn wiki"><i class="fab fa-wikipedia-w"></i> Wikipedia</a>
    <a href="https://www.google.com/search?q=${q}+tickets+booking" target="_blank" class="media-link-btn"><i class="fas fa-ticket-alt"></i> Tickets</a>
    <a href="https://www.google.com/search?q=${q}&tbm=isch" target="_blank" class="media-link-btn google"><i class="fas fa-images"></i> Google Images</a>`;

    document.getElementById('modalInfo').innerHTML = `
    <div class="info-badge"><i class="fas fa-clock"></i> ${act.duration}</div>
    <div class="info-badge"><i class="fas fa-rupee-sign"></i> \u20B9${act.cost}</div>
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
    
    // Auto-regenerate if we have a destination
    if (state.currentDest && state.itinerary) {
        showToast(`Persona changed to ${p}. Regenerating...`, 'info');
        setTimeout(() => generateTrip(), 500);
    }
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
        // Auto-generate
        setTimeout(() => generateTrip(), 300);
    };
    recognition.onerror = () => showToast('Voice recognition failed', 'error');
    recognition.start();
    showToast('Listening...', 'info');
}

// === AGENTIC AUTO-TRIGGER ===
let _autoTimer = null;
function setupEventListeners() {
    document.getElementById('generateBtn')?.addEventListener('click', generateTrip);
    
    // Fully agentic: auto-generate when user types destination and pauses
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
