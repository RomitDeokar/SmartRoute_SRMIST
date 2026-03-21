// ============================================
// Smart Route SRMist — Agentic Booking Workflow Engine
// Drives the full travel-booking pipeline:
//   Trip → Flights → Trains → Hotels → Cabs → Review → Pay → Confirmed
// Auto-prompts user, searches automatically, handles payments
// Origin-aware: books from user's location to destination
// ============================================

(() => {
'use strict';

// === AGENTIC STATE ===
const agenticState = {
    currentStep: 'trip_planned',
    tripId: '',
    selections: {
        flight: null,
        train: null,
        hotel: null,
        cab: null,
    },
    results: {
        flights: [],
        trains: [],
        hotels: [],
        cabs: [],
    },
    cart: [],
    paymentMethod: 'card',
    history: [],
    historyOpen: false,
    paymentAutoTriggered: false,
};

const DEFAULT_PRICE_LABEL = 'Check provider link';
const getPriceLabel = (item) => item?.price_label || (item?.price ? `₹${Number(item.price).toLocaleString()}` : DEFAULT_PRICE_LABEL);
const getPriceEstimate = (item) => {
    if (!item) return 0;
    return item?.price ?? item?.price_per_night ?? item?.total_price ?? item?.estimated_price ?? 0;
};
const shouldAutoSelect = () => (typeof state !== 'undefined' ? state.autoMode === true : false);
const pickBestOption = (items, scoreFn) => {
    if (!items?.length) return null;
    return items.reduce((best, item) => (scoreFn(item) > scoreFn(best) ? item : best), items[0]);
};

// === SMART CITY EXTRACTION ===
// Centralized backend resolver to avoid mapping drift
async function resolveBookingCity(placeName) {
    if (!placeName) return '';
    try {
        const res = await fetch(`${API_BASE}/agentic/resolve-city`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ place_name: placeName })
        });
        if (res.ok) {
            const data = await res.json();
            if (data?.city) return data.city;
        }
    } catch (e) {
        // Fall back to raw input if backend is unavailable
    }
    return placeName.trim();
}

// Expose to global scope for inline onclick handlers
window.agenticState = agenticState;
window.toggleAutoBooking = function(enabled) {
    if (typeof state !== 'undefined') {
        state.autoMode = !!enabled;
    }
    const mode = enabled ? 'ON (auto-select)' : 'OFF (manual)';
    if (typeof showToast === 'function') showToast(`Automation ${mode}`, 'info');
};

// === STEP MANAGEMENT ===
const STEPS = ['trip_planned', 'choose_flights', 'choose_trains', 'choose_hotels', 'choose_cabs', 'review_cart', 'payment', 'confirmed'];

function setWizardStep(stepId) {
    agenticState.currentStep = stepId;
    const idx = STEPS.indexOf(stepId);

    // Update progress bar
    document.querySelectorAll('.wizard-step').forEach((el, i) => {
        el.classList.remove('active', 'completed');
        if (i < idx) el.classList.add('completed');
        else if (i === idx) el.classList.add('active');
    });
    document.querySelectorAll('.wizard-connector').forEach((el, i) => {
        el.classList.toggle('done', i < idx);
    });

    // Show wizard
    const wizard = document.getElementById('agenticWizard');
    if (wizard) wizard.style.display = 'block';

    // Log
    if (typeof addLog === 'function') addLog('booking', `Workflow step: ${stepId}`, 'info');
}

function showAgentPrompt(text, actions) {
    const banner = document.getElementById('agentPromptBanner');
    const textEl = document.getElementById('agentPromptText');
    const actionsEl = document.getElementById('agentPromptActions');
    if (!banner) return;
    banner.style.display = 'flex';
    if (textEl) textEl.innerHTML = text;
    if (actionsEl && actions) actionsEl.innerHTML = actions;
}

function hideAllPanels() {
    ['flightResultsPanel', 'trainResultsPanel', 'hotelResultsPanel', 'cabResultsPanel', 'reviewCartPanel', 'paymentPanel', 'confirmationPanel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

// === AUTO-START AFTER TRIP GENERATION ===
// Hook into processTrip — robust even if load order changes
function wrapProcessTrip() {
    if (!window.processTrip || window.processTrip.__agenticWrapped) return false;
    const original = window.processTrip;
    const wrapped = async function(data, dest, duration, budget) {
        const result = await original(data, dest, duration, budget);
        setTimeout(() => startAgenticWizard(dest, duration, budget, data), 600);
        return result;
    };
    wrapped.__agenticWrapped = true;
    window.processTrip = wrapped;
    return true;
}

function ensureProcessTripHook() {
    if (wrapProcessTrip()) return;
    if (window.__agenticProcessTripWatch) return;
    let current = window.processTrip;
    Object.defineProperty(window, 'processTrip', {
        configurable: true,
        get() { return current; },
        set(fn) {
            current = fn;
            wrapProcessTrip();
        }
    });
    window.__agenticProcessTripWatch = true;
    if (current) wrapProcessTrip();
}

ensureProcessTripHook();
window.addEventListener('processTripReady', ensureProcessTripHook);

async function startAgenticWizard(dest, duration, budget, data) {
    setWizardStep('trip_planned');

    const startDate = document.getElementById('startDate')?.value || new Date().toISOString().split('T')[0];
    const endDate = (() => {
        const d = new Date(startDate);
        d.setDate(d.getDate() + duration);
        return d.toISOString().split('T')[0];
    })();

    // Store context with backend-resolved city extraction for booking
    const origin = (typeof state !== 'undefined' && state.origin) ? state.origin : document.getElementById('origin')?.value || '';
    const destCity = (await resolveBookingCity(dest)) || dest;
    const originCity = (await resolveBookingCity(origin)) || origin;
    agenticState.context = { dest, destCity, duration, budget, startDate, endDate, origin, originCity };

    const originMsg = origin ? ` from <strong>${origin}</strong>` : '';
    showAgentPrompt(
        `Your <strong>${duration}-day ${dest}</strong> itinerary${originMsg} is ready! I can now help you book <strong>flights, trains, hotels, and local transport</strong>. Prices include live web hints plus provider links. What would you like to do first?`,
        `<button class="btn btn-primary btn-sm" onclick="agenticSearchFlights()"><i class="fas fa-plane"></i> Search Flights</button>
         <button class="btn btn-sm" style="background:rgba(6,182,212,0.15);color:#06b6d4" onclick="agenticSearchTrains()"><i class="fas fa-train"></i> Search Trains</button>
         <button class="btn btn-sm" style="background:rgba(16,185,129,0.15);color:#10b981" onclick="agenticSearchHotels()"><i class="fas fa-hotel"></i> Search Hotels</button>
         <button class="btn btn-sm" style="background:rgba(245,158,11,0.15);color:#f59e0b" onclick="agenticSearchCabs()"><i class="fas fa-car"></i> Search Cabs</button>
         <button class="btn btn-sm" style="background:rgba(139,92,246,0.15);color:#8b5cf6" onclick="agenticSkipToReview()"><i class="fas fa-forward"></i> Skip Booking</button>`
    );

    // Scroll to wizard
    document.getElementById('agenticWizard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================
// FLIGHT SEARCH
// ============================================
window.agenticSearchFlights = async function() {
    const ctx = agenticState.context;
    if (!ctx) { showToast('Generate a trip first!', 'warning'); return; }

    setWizardStep('choose_flights');
    hideAllPanels();

    showAgentPrompt('🔍 <strong>Flight Agent</strong> is searching for the best flights...', '');
    if (typeof showLoading === 'function') showLoading(true);
    if (typeof addLog === 'function') addLog('booking', `Searching flights to ${ctx.dest}`, 'working');

    try {
        const persona = (typeof state !== 'undefined' && state.persona) ? state.persona : 'solo';
        const rawOrigin = ctx.origin || (typeof state !== 'undefined' && state.origin) || document.getElementById('origin')?.value || '';
        const originCity = ctx.originCity || (await resolveBookingCity(rawOrigin)) || rawOrigin || 'Delhi';
        const destCity = ctx.destCity || (await resolveBookingCity(ctx.dest)) || ctx.dest;
        const res = await fetch(`${API_BASE}/agentic/flights/search`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                origin: originCity,
                destination: destCity,
                departure_date: ctx.startDate,
                return_date: ctx.endDate,
                passengers: 1,
                cabin_class: persona === 'luxury' ? 'business' : 'economy',
                persona
            })
        });
        const data = await res.json();
        if (typeof showLoading === 'function') showLoading(false);

        if (data.success && data.flights?.length) {
            agenticState.results.flights = data.flights;
            agenticState.tripId = data.trip_id || agenticState.tripId;
            renderFlightResults(data.flights);
            showAgentPrompt(
                `✈️ <strong>Flight Agent found ${data.flights.length} options!</strong> Prices use live web hints + booking links. Pick any option.`,
                `<button class="btn btn-sm" style="background:rgba(6,182,212,0.15);color:#06b6d4" onclick="agenticSearchTrains()"><i class="fas fa-train"></i> Search Trains</button>
                 <button class="btn btn-sm" style="background:rgba(16,185,129,0.15);color:#10b981" onclick="agenticSearchHotels()"><i class="fas fa-arrow-right"></i> Skip → Hotels</button>`
            );
            if (shouldAutoSelect()) {
                const best = pickBestOption(data.flights, f => f.rating || 0);
                if (best) {
                    setTimeout(() => {
                        selectFlight(best.id);
                        setTimeout(() => agenticSearchHotels(), 800);
                    }, 500);
                }
            }
        } else {
            showAgentPrompt('No flights found. Try trains instead.', 
                `<button class="btn btn-sm" style="background:rgba(6,182,212,0.15);color:#06b6d4" onclick="agenticSearchTrains()"><i class="fas fa-train"></i> Search Trains</button>
                 <button class="btn btn-primary btn-sm" onclick="agenticSearchHotels()"><i class="fas fa-hotel"></i> Search Hotels</button>`);
        }
    } catch (e) {
        if (typeof showLoading === 'function') showLoading(false);
        showAgentPrompt('Flight search failed. Try trains or hotels instead.', 
            `<button class="btn btn-primary btn-sm" onclick="agenticSearchFlights()"><i class="fas fa-redo"></i> Retry</button>
             <button class="btn btn-sm" style="background:rgba(6,182,212,0.15);color:#06b6d4" onclick="agenticSearchTrains()"><i class="fas fa-train"></i> Trains</button>
             <button class="btn btn-sm" style="background:rgba(16,185,129,0.15);color:#10b981" onclick="agenticSearchHotels()"><i class="fas fa-hotel"></i> Hotels</button>`);
    }
};

function renderFlightResults(flights) {
    const panel = document.getElementById('flightResultsPanel');
    const list = document.getElementById('flightResultsList');
    if (!panel || !list) return;
    panel.style.display = 'block';

    list.innerHTML = flights.map(f => {
        const bookingUrls = f.booking_urls || {};
        return `
        <div class="flight-result-card ${agenticState.selections.flight?.id === f.id ? 'selected' : ''}" 
             onclick="selectFlight('${f.id}')" data-id="${f.id}">
            <div class="flight-airline">
                <div class="flight-airline-logo">${f.airline_code}</div>
                <div class="flight-airline-name">${f.airline}</div>
            </div>
            <div class="flight-route">
                <div class="flight-time">
                    <div class="flight-time-val">${f.departure}</div>
                    <div class="flight-time-code">${f.origin}</div>
                </div>
                <div class="flight-duration-line">
                    <div class="line"></div>
                    <div class="flight-duration-text">${f.duration}</div>
                    <div class="flight-stops">${f.stops === 0 ? 'Non-stop' : f.stops + ' stop'} ${f.stop_info || ''}</div>
                </div>
                <div class="flight-time">
                    <div class="flight-time-val">${f.arrival}</div>
                    <div class="flight-time-code">${f.destination.substring(0, 3).toUpperCase()}</div>
                </div>
            </div>
            <div class="flight-price">
                <div class="flight-price-val">${getPriceLabel(f)}</div>
                <div class="flight-price-class">${f.cabin_class}</div>
                <div class="flight-meta">
                    <span class="flight-tag">${f.baggage}</span>
                    ${f.meal ? '<span class="flight-tag">🍽️ Meal</span>' : ''}
                    ${f.refundable ? '<span class="flight-tag" style="color:var(--success)">Refundable</span>' : ''}
                    <span class="flight-tag">${f.seats_left} seats</span>
                </div>
                <div class="flight-booking-links" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">
                    <a href="${bookingUrls.google_flights || f.booking_url}" target="_blank" rel="noopener" class="flight-tag" style="color:#4285f4;text-decoration:none;cursor:pointer" onclick="event.stopPropagation()">🔗 Google Flights</a>
                    ${bookingUrls.skyscanner ? `<a href="${bookingUrls.skyscanner}" target="_blank" rel="noopener" class="flight-tag" style="color:#0770e3;text-decoration:none;cursor:pointer" onclick="event.stopPropagation()">🔗 Skyscanner</a>` : ''}
                    ${bookingUrls.makemytrip ? `<a href="${bookingUrls.makemytrip}" target="_blank" rel="noopener" class="flight-tag" style="color:#eb5b2d;text-decoration:none;cursor:pointer" onclick="event.stopPropagation()">🔗 MakeMyTrip</a>` : ''}
                    ${bookingUrls.cleartrip ? `<a href="${bookingUrls.cleartrip}" target="_blank" rel="noopener" class="flight-tag" style="color:#e74c3c;text-decoration:none;cursor:pointer" onclick="event.stopPropagation()">🔗 Cleartrip</a>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');

    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.selectFlight = function(flightId) {
    const flight = agenticState.results.flights.find(f => f.id === flightId);
    if (!flight) return;
    agenticState.selections.flight = flight;
    // Re-render to update selected state
    renderFlightResults(agenticState.results.flights);
    showToast(`Selected: ${flight.airline} ${flight.flight_no} — ${getPriceLabel(flight)}`, 'success');
    if (typeof addLog === 'function') addLog('booking', `Flight selected: ${flight.airline} (${getPriceLabel(flight)})`, 'success');

    // Auto-prompt next step
    setTimeout(() => {
        showAgentPrompt(
            `✅ Flight booked: <strong>${flight.airline} ${flight.flight_no}</strong> (${getPriceLabel(flight)}). Now let's find a hotel in <strong>${agenticState.context.dest}</strong>!`,
            `<button class="btn btn-primary btn-sm" onclick="agenticSearchHotels()"><i class="fas fa-hotel"></i> Search Hotels</button>
             <button class="btn btn-sm" style="background:rgba(139,92,246,0.15);color:#8b5cf6" onclick="agenticSkipToReview()"><i class="fas fa-forward"></i> Skip to Review</button>`
        );
    }, 400);
};

window.sortFlightResults = function(criteria) {
    const flights = [...agenticState.results.flights];
    if (criteria === 'price') flights.sort((a, b) => getPriceEstimate(a) - getPriceEstimate(b));
    else if (criteria === 'duration') flights.sort((a, b) => a.duration.localeCompare(b.duration));
    else if (criteria === 'rating') flights.sort((a, b) => b.rating - a.rating);
    agenticState.results.flights = flights;
    renderFlightResults(flights);
};

// ============================================
// HOTEL SEARCH
// ============================================
window.agenticSearchHotels = async function() {
    const ctx = agenticState.context;
    if (!ctx) { showToast('Generate a trip first!', 'warning'); return; }

    setWizardStep('choose_hotels');
    hideAllPanels();

    showAgentPrompt('🔍 <strong>Hotel Agent</strong> is finding the best stays...', '');
    if (typeof showLoading === 'function') showLoading(true);

    try {
        const persona = (typeof state !== 'undefined' && state.persona) ? state.persona : 'solo';
        const res = await fetch(`${API_BASE}/agentic/hotels/search`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destination: ctx.dest,
                check_in: ctx.startDate,
                check_out: ctx.endDate,
                guests: 1, rooms: 1,
                persona,
                budget_per_night: ctx.budget / ctx.duration * 0.35
            })
        });
        const data = await res.json();
        if (typeof showLoading === 'function') showLoading(false);

        if (data.success && data.hotels?.length) {
            agenticState.results.hotels = data.hotels;
            renderHotelResults(data.hotels);
            showAgentPrompt(
                `🏨 <strong>Hotel Agent found ${data.hotels.length} options!</strong> Prices use live web hints + booking links. Pick a hotel or skip to transport.`,
                `<button class="btn btn-sm" style="background:rgba(245,158,11,0.15);color:#f59e0b" onclick="agenticSearchCabs()"><i class="fas fa-arrow-right"></i> Skip → Transport</button>`
            );
            if (shouldAutoSelect()) {
                const best = pickBestOption(data.hotels, h => h.rating || 0);
                if (best) {
                    setTimeout(() => {
                        selectHotel(best.id);
                        setTimeout(() => agenticSearchCabs(), 800);
                    }, 500);
                }
            }
        } else {
            showAgentPrompt('No hotels found. Search cabs instead?',
                `<button class="btn btn-primary btn-sm" onclick="agenticSearchCabs()"><i class="fas fa-car"></i> Search Cabs</button>`);
        }
    } catch (e) {
        if (typeof showLoading === 'function') showLoading(false);
        showAgentPrompt('Hotel search failed.', 
            `<button class="btn btn-primary btn-sm" onclick="agenticSearchHotels()"><i class="fas fa-redo"></i> Retry</button>`);
    }
};

function renderHotelResults(hotels) {
    const panel = document.getElementById('hotelResultsPanel');
    const list = document.getElementById('hotelResultsList');
    if (!panel || !list) return;
    panel.style.display = 'block';

    list.innerHTML = hotels.map(h => {
        const photoHtml = h.photo
            ? `<div class="hotel-thumb" style="background-image:url('${h.photo}');background-size:contain;background-repeat:no-repeat;background-position:center;min-width:60px;min-height:60px;border-radius:8px"></div>`
            : `<div class="hotel-thumb">🏨</div>`;
        const bookingUrls = h.booking_urls || {};
        return `
        <div class="hotel-result-card ${agenticState.selections.hotel?.id === h.id ? 'selected' : ''}"
             onclick="selectHotel('${h.id}')" data-id="${h.id}">
            ${photoHtml}
            <div class="hotel-info">
                <div class="hotel-name">${h.name}</div>
                <div class="hotel-stars">${'⭐'.repeat(h.stars)} <span style="color:var(--text-2);font-size:0.72rem">${h.rating}/5 (${h.reviews_count.toLocaleString()} reviews)</span></div>
                <div style="font-size:0.75rem;color:var(--text-2)">${h.room_type} · ${h.distance_center}</div>
                <div class="hotel-amenities">
                    ${h.amenities.slice(0, 5).map(a => `<span class="hotel-amenity-tag">${a}</span>`).join('')}
                    ${h.amenities.length > 5 ? `<span class="hotel-amenity-tag">+${h.amenities.length - 5}</span>` : ''}
                </div>
                <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap">
                    ${h.free_cancellation ? '<span class="flight-tag" style="color:var(--success)">Free cancellation</span>' : ''}
                    ${h.pay_at_hotel ? '<span class="flight-tag">Pay at hotel</span>' : ''}
                </div>
                <div class="hotel-booking-links" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px">
                    <a href="${h.booking_url || '#'}" target="_blank" rel="noopener" class="flight-tag" style="color:#003580;text-decoration:none;cursor:pointer;font-size:0.65rem" onclick="event.stopPropagation()">🔗 Book Direct</a>
                    ${bookingUrls.booking_com ? `<a href="${bookingUrls.booking_com}" target="_blank" rel="noopener" class="flight-tag" style="color:#003580;text-decoration:none;cursor:pointer;font-size:0.65rem" onclick="event.stopPropagation()">🔗 Booking.com</a>` : ''}
                    ${bookingUrls.makemytrip ? `<a href="${bookingUrls.makemytrip}" target="_blank" rel="noopener" class="flight-tag" style="color:#eb5b2d;text-decoration:none;cursor:pointer;font-size:0.65rem" onclick="event.stopPropagation()">🔗 MakeMyTrip</a>` : ''}
                    ${bookingUrls.google_hotels ? `<a href="${bookingUrls.google_hotels}" target="_blank" rel="noopener" class="flight-tag" style="color:#4285f4;text-decoration:none;cursor:pointer;font-size:0.65rem" onclick="event.stopPropagation()">🔗 Google Hotels</a>` : ''}
                </div>
            </div>
            <div class="hotel-price">
                <div class="hotel-price-val">${getPriceLabel(h)}</div>
                <div class="hotel-price-night">per night</div>
                <div class="hotel-price-total">Total: ${getPriceLabel(h)}</div>
                <div style="font-size:0.65rem;color:var(--text-3)">${h.nights} night${h.nights > 1 ? 's' : ''}</div>
            </div>
        </div>`;
    }).join('');

    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.selectHotel = function(hotelId) {
    const hotel = agenticState.results.hotels.find(h => h.id === hotelId);
    if (!hotel) return;
    agenticState.selections.hotel = hotel;
    renderHotelResults(agenticState.results.hotels);
    showToast(`Selected: ${hotel.name} — ${getPriceLabel(hotel)}`, 'success');
    if (typeof addLog === 'function') addLog('booking', `Hotel selected: ${hotel.name} (${getPriceLabel(hotel)})`, 'success');

    setTimeout(() => {
        showAgentPrompt(
            `✅ Hotel: <strong>${hotel.name}</strong> (${getPriceLabel(hotel)}). Now let's arrange local transport!`,
            `<button class="btn btn-primary btn-sm" onclick="agenticSearchCabs()"><i class="fas fa-car"></i> Search Cabs</button>
             <button class="btn btn-sm" style="background:rgba(139,92,246,0.15);color:#8b5cf6" onclick="agenticSkipToReview()"><i class="fas fa-forward"></i> Skip to Review</button>`
        );
    }, 400);
};

window.sortHotelResults = function(criteria) {
    const hotels = [...agenticState.results.hotels];
    if (criteria === 'price') hotels.sort((a, b) => getPriceEstimate(a) - getPriceEstimate(b));
    else if (criteria === 'rating') hotels.sort((a, b) => b.rating - a.rating);
    else if (criteria === 'stars') hotels.sort((a, b) => b.stars - a.stars);
    agenticState.results.hotels = hotels;
    renderHotelResults(hotels);
};

// ============================================
// CAB SEARCH
// ============================================
window.agenticSearchCabs = async function() {
    const ctx = agenticState.context;
    if (!ctx) { showToast('Generate a trip first!', 'warning'); return; }

    setWizardStep('choose_cabs');
    hideAllPanels();

    showAgentPrompt('🔍 <strong>Transport Agent</strong> is finding local cabs...', '');
    if (typeof showLoading === 'function') showLoading(true);

    try {
        const persona = (typeof state !== 'undefined' && state.persona) ? state.persona : 'solo';
        const cabType = persona === 'luxury' ? 'luxury' : persona === 'family' ? 'suv' : 'sedan';
        const res = await fetch(`${API_BASE}/agentic/cabs/search`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destination: ctx.dest,
                date: ctx.startDate,
                cab_type: cabType,
                duration_hours: 8,
                persona
            })
        });
        const data = await res.json();
        if (typeof showLoading === 'function') showLoading(false);

        if (data.success && data.cabs?.length) {
            agenticState.results.cabs = data.cabs;
            renderCabResults(data.cabs);
            showAgentPrompt(
                `🚗 <strong>Transport Agent found ${data.cabs.length} options!</strong> Prices use live web hints + booking links. Select one or go to review.`,
                `<button class="btn btn-sm" style="background:rgba(139,92,246,0.15);color:#8b5cf6" onclick="agenticSkipToReview()"><i class="fas fa-arrow-right"></i> Skip → Review</button>`
            );
            if (shouldAutoSelect()) {
                const best = pickBestOption(data.cabs, c => c.driver_rating || 0);
                if (best) {
                    setTimeout(() => {
                        selectCab(best.id);
                        setTimeout(() => agenticSkipToReview(), 800);
                    }, 500);
                }
            }
        } else {
            showAgentPrompt('No cabs found. Proceed to review?',
                `<button class="btn btn-primary btn-sm" onclick="agenticSkipToReview()"><i class="fas fa-shopping-cart"></i> Review</button>`);
        }
    } catch (e) {
        if (typeof showLoading === 'function') showLoading(false);
        showAgentPrompt('Cab search failed.',
            `<button class="btn btn-primary btn-sm" onclick="agenticSearchCabs()"><i class="fas fa-redo"></i> Retry</button>
             <button class="btn btn-sm" style="background:rgba(139,92,246,0.15);color:#8b5cf6" onclick="agenticSkipToReview()"><i class="fas fa-forward"></i> Review</button>`);
    }
};

function renderCabResults(cabs) {
    const panel = document.getElementById('cabResultsPanel');
    const list = document.getElementById('cabResultsList');
    if (!panel || !list) return;
    panel.style.display = 'block';

    list.innerHTML = cabs.map(c => `
        <div class="cab-result-card ${agenticState.selections.cab?.id === c.id ? 'selected' : ''}"
             onclick="selectCab('${c.id}')" data-id="${c.id}">
            <div class="cab-icon">${c.icon}</div>
            <div class="cab-info">
                <div class="cab-provider">${c.provider}</div>
                <div class="cab-meta">
                    ${c.cab_type.toUpperCase()} · ${c.duration_hours}hrs · ~${c.estimated_km}km · ETA: ${c.eta_minutes} min
                </div>
                <div class="cab-meta">⭐ ${c.driver_rating} driver rating</div>
                <div class="cab-features">
                    ${c.features.map(f => `<span class="flight-tag">${f}</span>`).join('')}
                </div>
            </div>
            <div class="cab-price">
                <div class="cab-price-val">${getPriceLabel(c)}</div>
                <div style="font-size:0.65rem;color:var(--text-3)">Includes live web hint</div>
            </div>
        </div>
    `).join('');

    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.selectCab = function(cabId) {
    const cab = agenticState.results.cabs.find(c => c.id === cabId);
    if (!cab) return;
    agenticState.selections.cab = cab;
    renderCabResults(agenticState.results.cabs);
    showToast(`Selected: ${cab.provider} — ${getPriceLabel(cab)}`, 'success');

    setTimeout(() => {
        showAgentPrompt(
            `✅ All set! Let's review your complete booking before payment.`,
            `<button class="btn btn-primary btn-sm" onclick="agenticSkipToReview()"><i class="fas fa-shopping-cart"></i> Review & Pay</button>`
        );
    }, 400);
};

// ============================================
// TRAIN SEARCH
// ============================================
window.agenticSearchTrains = async function() {
    const ctx = agenticState.context;
    if (!ctx) { showToast('Generate a trip first!', 'warning'); return; }

    setWizardStep('choose_trains');
    hideAllPanels();

    showAgentPrompt('🔍 <strong>Transport Agent</strong> is searching trains...', '');
    if (typeof showLoading === 'function') showLoading(true);

    try {
        const persona = (typeof state !== 'undefined' && state.persona) ? state.persona : 'solo';
        const rawOrigin = ctx.origin || (typeof state !== 'undefined' && state.origin) || document.getElementById('origin')?.value || '';
        const originCity = ctx.originCity || (await resolveBookingCity(rawOrigin)) || rawOrigin || 'Chennai';
        const destCity = ctx.destCity || (await resolveBookingCity(ctx.dest)) || ctx.dest;
        const trainClass = persona === 'luxury' ? '1AC' : persona === 'family' ? '2AC' : '3AC';
        const res = await fetch(`${API_BASE}/agentic/trains/search`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                origin: originCity,
                destination: destCity,
                departure_date: ctx.startDate,
                passengers: 1,
                train_class: trainClass,
                persona
            })
        });
        const data = await res.json();
        if (typeof showLoading === 'function') showLoading(false);

        if (data.success && data.trains?.length) {
            agenticState.results.trains = data.trains;
            renderTrainResults(data.trains);
            showAgentPrompt(
                `🚂 <strong>Found ${data.trains.length} trains!</strong> Prices use live web hints + booking links. Select one or proceed.`,
                `<button class="btn btn-sm" style="background:rgba(16,185,129,0.15);color:#10b981" onclick="agenticSearchHotels()"><i class="fas fa-arrow-right"></i> Next → Hotels</button>`
            );
            if (shouldAutoSelect()) {
                const best = pickBestOption(data.trains, t => t.rating || 0);
                if (best) {
                    setTimeout(() => {
                        selectTrain(best.id);
                        setTimeout(() => agenticSearchHotels(), 800);
                    }, 500);
                }
            }
        } else {
            showAgentPrompt('No direct trains found on this route. Try flights or proceed to hotels.',
                `<button class="btn btn-primary btn-sm" onclick="agenticSearchFlights()"><i class="fas fa-plane"></i> Flights</button>
                 <button class="btn btn-sm" style="background:rgba(16,185,129,0.15);color:#10b981" onclick="agenticSearchHotels()"><i class="fas fa-hotel"></i> Hotels</button>`);
        }
    } catch (e) {
        if (typeof showLoading === 'function') showLoading(false);
        showAgentPrompt('Train search failed.',
            `<button class="btn btn-primary btn-sm" onclick="agenticSearchTrains()"><i class="fas fa-redo"></i> Retry</button>
             <button class="btn btn-sm" style="background:rgba(16,185,129,0.15);color:#10b981" onclick="agenticSearchHotels()"><i class="fas fa-hotel"></i> Hotels</button>`);
    }
};

function renderTrainResults(trains) {
    const panel = document.getElementById('trainResultsPanel');
    const list = document.getElementById('trainResultsList');
    if (!panel || !list) return;
    panel.style.display = 'block';

    list.innerHTML = trains.map(t => {
        const availClass = t.availability === 'Available' ? 'success' : (t.availability.startsWith('RAC') ? 'warning' : 'error');
        const irctcUrl = `https://www.irctc.co.in/nget/train-search`;
        const confirmtktUrl = `https://www.confirmtkt.com/train-details/${t.train_number}`;
        const railYatriUrl = `https://www.railyatri.in/train-enquiry/${t.train_number}`;
        return `
        <div class="flight-result-card ${agenticState.selections.train?.id === t.id ? 'selected' : ''}"
             onclick="selectTrain('${t.id}')" data-id="${t.id}" style="cursor:pointer">
            <div class="flight-main">
                <div class="flight-airline">
                    <span style="font-size:1.3rem">🚂</span>
                    <div>
                        <div class="airline-name">${t.train_name}</div>
                        <div class="flight-number">#${t.train_number}</div>
                    </div>
                </div>
                <div class="flight-timing">
                    <div class="flight-time">${t.departure}</div>
                    <div class="flight-city">${t.origin}</div>
                </div>
                <div class="flight-duration">
                    <div class="flight-dur-line"></div>
                    <div>${t.duration}</div>
                    <div class="flight-stops-info">${t.stops} stop(s) · ${t.day_of_arrival}</div>
                </div>
                <div class="flight-timing">
                    <div class="flight-time">${t.arrival}</div>
                    <div class="flight-city">${t.destination}</div>
                </div>
                <div class="flight-price-col">
                    <div class="flight-price" style="color:var(--success);font-weight:700;font-size:1.1rem">${getPriceLabel(t)}</div>
                    <div style="font-size:0.65rem;color:var(--text-3)">${t.train_class} class</div>
                    <div style="font-size:0.65rem;color:var(--${availClass});font-weight:600">${t.availability}</div>
                </div>
            </div>
            <div class="flight-meta" style="padding:6px 12px;display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border)">
                <span class="flight-tag">${t.train_class}</span>
                ${t.pantry ? '<span class="flight-tag">🍽️ Pantry</span>' : ''}
                <span class="flight-tag">⭐ ${t.rating}</span>
                <span class="flight-tag">📅 ${t.runs_on}</span>
                ${t.available_classes.map(c => `<span class="flight-tag" style="font-size:0.6rem">${c}</span>`).join('')}
                <a href="${irctcUrl}" target="_blank" class="flight-tag" style="color:var(--primary);text-decoration:none;font-weight:600" onclick="event.stopPropagation()">🔗 IRCTC</a>
                <a href="${confirmtktUrl}" target="_blank" class="flight-tag" style="color:#e74c3c;text-decoration:none" onclick="event.stopPropagation()">🔗 ConfirmTkt</a>
                <a href="${railYatriUrl}" target="_blank" class="flight-tag" style="color:#4CAF50;text-decoration:none" onclick="event.stopPropagation()">🔗 RailYatri</a>
            </div>
        </div>`;
    }).join('');

    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

window.selectTrain = function(trainId) {
    const train = agenticState.results.trains.find(t => t.id === trainId);
    if (!train) return;
    agenticState.selections.train = train;
    renderTrainResults(agenticState.results.trains);
    showToast(`Selected: ${train.train_name} — ${getPriceLabel(train)}`, 'success');

    setTimeout(() => {
        showAgentPrompt(
            `🚂 Train booked! Now let's find your hotel.`,
            `<button class="btn btn-primary btn-sm" onclick="agenticSearchHotels()"><i class="fas fa-hotel"></i> Search Hotels</button>`
        );
    }, 400);
};

window.sortTrainResults = function(by) {
    const trains = agenticState.results.trains;
    if (!trains) return;
    if (by === 'price') trains.sort((a, b) => getPriceEstimate(a) - getPriceEstimate(b));
    else if (by === 'duration') trains.sort((a, b) => parseInt(a.duration) - parseInt(b.duration));
    else if (by === 'rating') trains.sort((a, b) => b.rating - a.rating);
    renderTrainResults(trains);
};

// ============================================
// REVIEW CART
// ============================================
window.agenticSkipToReview = function() {
    setWizardStep('review_cart');
    hideAllPanels();

    const panel = document.getElementById('reviewCartPanel');
    if (panel) panel.style.display = 'block';

    // Build cart
    agenticState.cart = [];
    const sel = agenticState.selections;
    if (sel.flight) agenticState.cart.push({ type: 'flight', item: sel.flight, price: getPriceEstimate(sel.flight), price_label: getPriceLabel(sel.flight) });
    if (sel.train) agenticState.cart.push({ type: 'train', item: sel.train, price: getPriceEstimate(sel.train), price_label: getPriceLabel(sel.train) });
    if (sel.hotel) agenticState.cart.push({ type: 'hotel', item: sel.hotel, price: getPriceEstimate(sel.hotel), price_label: getPriceLabel(sel.hotel) });
    if (sel.cab) agenticState.cart.push({ type: 'cab', item: sel.cab, price: getPriceEstimate(sel.cab), price_label: getPriceLabel(sel.cab) });

    renderCart();
    showAgentPrompt(
        agenticState.cart.length > 0
            ? `🛒 Review your ${agenticState.cart.length} booking(s) below. Everything look good?`
            : `You haven't selected any bookings yet. Go back to search, or proceed to confirm just the itinerary.`,
        agenticState.cart.length > 0
            ? `<button class="btn btn-primary btn-sm" onclick="agenticProceedToPayment()"><i class="fas fa-credit-card"></i> Proceed to Payment</button>`
            : `<button class="btn btn-primary btn-sm" onclick="agenticSearchFlights()"><i class="fas fa-plane"></i> Search Flights</button>
               <button class="btn btn-sm" style="background:rgba(16,185,129,0.15);color:#10b981" onclick="agenticSearchHotels()"><i class="fas fa-hotel"></i> Hotels</button>
               <button class="btn btn-sm" style="background:rgba(245,158,11,0.15);color:#f59e0b" onclick="agenticConfirmWithoutPayment()"><i class="fas fa-check"></i> Confirm Itinerary Only</button>`
    );
};

function renderCart() {
    const summary = document.getElementById('cartSummary');
    const totalEl = document.getElementById('cartTotal');
    if (!summary) return;

    const icons = { flight: '✈️', hotel: '🏨', cab: '🚗', train: '🚂' };
    const labels = {
        flight: (item) => `${item.airline} ${item.flight_no} · ${item.departure} → ${item.arrival}`,
        train: (item) => `${item.train_name} #${item.train_number} · ${item.departure} → ${item.arrival} · ${item.train_class}`,
        hotel: (item) => `${item.name} · ${item.nights} night(s) · ${item.room_type}`,
        cab: (item) => `${item.provider} · ${item.cab_type} · ${item.duration_hours}hrs`,
    };

    if (agenticState.cart.length === 0) {
        summary.innerHTML = '<div class="empty-state"><div class="emoji">🛒</div><p>No items in cart. Search flights, trains, hotels, or cabs first.</p></div>';
        if (totalEl) totalEl.innerHTML = '';
        return;
    }

    summary.innerHTML = agenticState.cart.map((c, i) => `
        <div class="cart-item">
            <div class="cart-item-icon ${c.type}">${icons[c.type]}</div>
            <div class="cart-item-info">
                <div class="cart-item-title">${c.type.charAt(0).toUpperCase() + c.type.slice(1)}</div>
                <div class="cart-item-desc">${labels[c.type](c.item)}</div>
            </div>
            <div class="cart-item-price">${c.price_label || DEFAULT_PRICE_LABEL}</div>
            <div class="cart-item-remove" onclick="removeFromCart(${i})" title="Remove"><i class="fas fa-trash-alt"></i></div>
        </div>
    `).join('');

    const hasLivePrices = agenticState.cart.every(c => typeof c.price === 'number' && c.price > 0);
    const total = agenticState.cart.reduce((s, c) => s + (c.price || 0), 0);
    if (totalEl) {
        totalEl.innerHTML = hasLivePrices
            ? `
            <div class="cart-total-label">Total Amount</div>
            <div class="cart-total-value">₹${total.toLocaleString()}</div>
        `
            : `
            <div class="cart-total-label">Total Amount</div>
            <div class="cart-total-value">${DEFAULT_PRICE_LABEL}</div>
            <div class="text-xs text-muted" style="margin-top:4px">Live pricing is shown on provider sites.</div>
        `;
    }
}

window.removeFromCart = function(idx) {
    const removed = agenticState.cart.splice(idx, 1);
    if (removed[0]) {
        agenticState.selections[removed[0].type] = null;
    }
    renderCart();
    showToast('Item removed from cart', 'info');
};

window.agenticEditSelections = function() {
    showAgentPrompt(
        'What would you like to change?',
        `<button class="btn btn-primary btn-sm" onclick="agenticSearchFlights()"><i class="fas fa-plane"></i> Flights</button>
         <button class="btn btn-sm" style="background:rgba(6,182,212,0.15);color:#06b6d4" onclick="agenticSearchTrains()"><i class="fas fa-train"></i> Trains</button>
         <button class="btn btn-sm" style="background:rgba(16,185,129,0.15);color:#10b981" onclick="agenticSearchHotels()"><i class="fas fa-hotel"></i> Hotels</button>
         <button class="btn btn-sm" style="background:rgba(245,158,11,0.15);color:#f59e0b" onclick="agenticSearchCabs()"><i class="fas fa-car"></i> Cabs</button>`
    );
};

// ============================================
// PAYMENT
// ============================================
window.agenticProceedToPayment = function() {
    if (agenticState.cart.length === 0) {
        showToast('Add items to cart first', 'warning');
        return;
    }

    setWizardStep('payment');
    hideAllPanels();

    const panel = document.getElementById('paymentPanel');
    if (panel) panel.style.display = 'block';

    const hasLivePrices = agenticState.cart.every(c => typeof c.price === 'number' && c.price > 0);
    const total = agenticState.cart.reduce((s, c) => s + (c.price || 0), 0);
    const summaryEl = document.getElementById('paymentSummaryTotal');
    if (summaryEl) {
        summaryEl.innerHTML = hasLivePrices
            ? `<span>Total to pay</span><span style="color:var(--success);font-size:1.2rem">₹${total.toLocaleString()}</span>`
            : `<span>Total to pay</span><span style="color:var(--text-2);font-size:1.1rem">${DEFAULT_PRICE_LABEL}</span>`;
    }

    const payBtn = document.getElementById('payNowBtn');
    if (payBtn) {
        payBtn.disabled = agenticState.cart.length === 0;
        if (!hasLivePrices) {
            payBtn.innerHTML = '<i class="fas fa-lock"></i> Simulate Payment';
        } else {
            payBtn.innerHTML = '<i class="fas fa-lock"></i> Pay Securely';
        }
    }

    showAgentPrompt(
        hasLivePrices
            ? `💳 Secure payment for <strong>₹${total.toLocaleString()}</strong>. Choose your preferred payment method below.`
            : `💳 Some items may still need provider confirmation. You can simulate payment here, then complete checkout on provider sites.`,
        ''
    );

    prefillPaymentFields();
    if (!hasLivePrices && shouldAutoSelect() && !agenticState.paymentAutoTriggered) {
        agenticState.paymentAutoTriggered = true;
        setTimeout(() => agenticProcessPayment(), 1200);
    }

    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

function prefillPaymentFields() {
    const card = document.getElementById('payCardNumber');
    const expiry = document.getElementById('payExpiry');
    const cvv = document.getElementById('payCVV');
    const upi = document.getElementById('payUPI');
    if (card && !card.value) card.value = '4242 4242 4242 4242';
    if (expiry && !expiry.value) expiry.value = '12/30';
    if (cvv && !cvv.value) cvv.value = '123';
    if (upi && !upi.value) upi.value = 'demo@upi';
}

window.selectPaymentMethod = function(method, el) {
    agenticState.paymentMethod = method;
    document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('active'));
    if (el) el.classList.add('active');

    const cardFields = document.getElementById('cardFields');
    const upiFields = document.getElementById('upiFields');
    if (cardFields) cardFields.style.display = method === 'card' ? 'block' : 'none';
    if (upiFields) upiFields.style.display = method === 'upi' ? 'block' : 'none';
};

window.agenticProcessPayment = async function() {
    const hasLivePrices = agenticState.cart.every(c => typeof c.price === 'number' && c.price > 0);
    const total = agenticState.cart.reduce((s, c) => s + (c.price || 0), 0);
    const simulate = !hasLivePrices;
    if (hasLivePrices && total === 0) { showToast('Nothing to pay', 'warning'); return; }

    const btn = document.getElementById('payNowBtn');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = simulate ? '<i class="fas fa-spinner fa-spin"></i> Simulating...' : '<i class="fas fa-spinner fa-spin"></i> Processing...';
    }

    if (typeof showLoading === 'function') showLoading(true);

    try {
        // Process payment for each item
        const results = [];
        for (const cartItem of agenticState.cart) {
            const amount = simulate ? 0 : cartItem.price;
            const res = await fetch(`${API_BASE}/agentic/payment/process`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    booking_id: cartItem.item.id,
                    booking_type: cartItem.type,
                    amount,
                    currency: 'INR',
                    payment_method: agenticState.paymentMethod,
                    card_last4: document.getElementById('payCardNumber')?.value?.slice(-4) || '4242',
                    upi_id: document.getElementById('payUPI')?.value || '',
                    simulated: simulate,
                })
            });
            const data = await res.json();
            results.push(data);

            // Also confirm the booking
            await fetch(`${API_BASE}/agentic/booking/confirm`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    booking_type: cartItem.type,
                    item_id: cartItem.item.id,
                    trip_id: agenticState.tripId,
                })
            });
        }

        if (typeof showLoading === 'function') showLoading(false);

        const allSuccess = results.every(r => r.success);
        if (allSuccess) {
            showToast(simulate ? 'Payment simulation complete. Bookings recorded.' : 'Payment successful! All bookings confirmed.', 'success');
            agenticShowConfirmation(results);
        } else {
            showToast('Some payments failed. Please retry.', 'error');
            if (btn) { btn.disabled = false; btn.innerHTML = simulate ? '<i class="fas fa-lock"></i> Simulate Payment' : '<i class="fas fa-lock"></i> Pay Securely'; }
        }
    } catch (e) {
        if (typeof showLoading === 'function') showLoading(false);
        showToast('Payment processing error. Please try again.', 'error');
        if (btn) { btn.disabled = false; btn.innerHTML = simulate ? '<i class="fas fa-lock"></i> Simulate Payment' : '<i class="fas fa-lock"></i> Pay Securely'; }
    }
};

window.agenticConfirmWithoutPayment = function() {
    agenticShowConfirmation([]);
};

function agenticShowConfirmation(paymentResults) {
    setWizardStep('confirmed');
    hideAllPanels();

    const panel = document.getElementById('confirmationPanel');
    if (panel) panel.style.display = 'block';

    const ctx = agenticState.context || {};
    const sel = agenticState.selections;
    const hasLivePrices = agenticState.cart.every(c => typeof c.price === 'number' && c.price > 0);
    const total = agenticState.cart.reduce((s, c) => s + (c.price || 0), 0);

    const msg = document.getElementById('confirmationMsg');
    if (msg) msg.textContent = hasLivePrices
        ? `Your ${ctx.duration || ''}-day trip to ${ctx.dest || ''} is fully booked! Total: ₹${total.toLocaleString()}`
        : `Your ${ctx.duration || ''}-day trip to ${ctx.dest || ''} is ready! Compare live prices on provider sites.`;

    const details = document.getElementById('confirmationDetails');
    if (details) {
        let html = '';
        if (sel.flight) {
            html += `<div class="confirmation-item"><div class="confirmation-item-icon">✈️</div><div class="confirmation-item-text">${sel.flight.airline} ${sel.flight.flight_no} · ${sel.flight.departure} → ${sel.flight.arrival} · ${getPriceLabel(sel.flight)}</div><div class="confirmation-item-ref">${sel.flight.id}</div></div>`;
        }
        if (sel.hotel) {
            html += `<div class="confirmation-item"><div class="confirmation-item-icon">🏨</div><div class="confirmation-item-text">${sel.hotel.name} · ${sel.hotel.nights} nights · ${getPriceLabel(sel.hotel)}</div><div class="confirmation-item-ref">${sel.hotel.id}</div></div>`;
        }
        if (sel.cab) {
            html += `<div class="confirmation-item"><div class="confirmation-item-icon">🚗</div><div class="confirmation-item-text">${sel.cab.provider} · ${sel.cab.duration_hours}hrs · ${getPriceLabel(sel.cab)}</div><div class="confirmation-item-ref">${sel.cab.id}</div></div>`;
        }
        if (sel.train) {
            html += `<div class="confirmation-item"><div class="confirmation-item-icon">🚂</div><div class="confirmation-item-text">${sel.train.train_name} #${sel.train.train_number} · ${sel.train.departure} → ${sel.train.arrival} · ${getPriceLabel(sel.train)}</div><div class="confirmation-item-ref">${sel.train.id}</div></div>`;
        }
        if (!html) {
            html = '<div class="confirmation-item"><div class="confirmation-item-icon">🗺️</div><div class="confirmation-item-text">Itinerary confirmed (no bookings added)</div></div>';
        }
        details.innerHTML = html;
    }

    showAgentPrompt(
        `🎉 <strong>Trip confirmed!</strong> All ${agenticState.cart.length} booking(s) are in your history. Have an amazing trip to <strong>${ctx.dest}</strong>!`,
        `<button class="btn btn-primary btn-sm" onclick="toggleHistory()"><i class="fas fa-history"></i> View History</button>
         <button class="btn btn-sm" style="background:rgba(6,182,212,0.15);color:#06b6d4" onclick="exportPDF()"><i class="fas fa-file-pdf"></i> Export PDF</button>`
    );

    if (typeof addLog === 'function') addLog('booking', `Trip fully confirmed! ${agenticState.cart.length} bookings`, 'success');

    // Auto-refresh history
    loadBookingHistory();

    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ============================================
// BOOKING HISTORY
// ============================================
window.toggleHistory = function() {
    agenticState.historyOpen = !agenticState.historyOpen;
    const overlay = document.getElementById('historyOverlay');
    const sidebar = document.getElementById('historySidebar');
    if (overlay) overlay.classList.toggle('active', agenticState.historyOpen);
    if (sidebar) sidebar.classList.toggle('active', agenticState.historyOpen);
    if (agenticState.historyOpen) loadBookingHistory();
};

async function loadBookingHistory() {
    try {
        const res = await fetch(`${API_BASE}/agentic/history`);
        const data = await res.json();
        if (!data.success) return;

        agenticState.history = data.history || [];

        const totalBookings = document.getElementById('histTotalBookings');
        const totalSpent = document.getElementById('histTotalSpent');
        if (totalBookings) totalBookings.textContent = data.count || 0;
        if (totalSpent) totalSpent.textContent = `₹${(data.total_spent || 0).toLocaleString()}`;

        const list = document.getElementById('historyList');
        if (!list) return;

        if (!data.history?.length) {
            list.innerHTML = '<div class="empty-state"><div class="emoji">📋</div><p>No bookings yet.</p></div>';
            return;
        }

        const icons = { flight: '✈️', hotel: '🏨', cab: '🚗', payment: '💳', confirmed: '✅' };
        list.innerHTML = data.history.map(h => {
            const icon = icons[h.type] || '📋';
            const title = h.type === 'payment'
                ? `Payment ₹${(h.amount || 0).toLocaleString()} via ${h.method || ''}`
                : `${h.type?.charAt(0).toUpperCase() + h.type?.slice(1)} Booking`;
            const time = h.confirmed_at || h.timestamp || '';
            const timeStr = time ? new Date(time).toLocaleString() : '';
            return `
                <div class="history-entry ${h.type === 'payment' ? 'payment' : ''}">
                    <div class="history-entry-icon">${icon}</div>
                    <div class="history-entry-info">
                        <div class="history-entry-title">${title}</div>
                        <div class="history-entry-time">${timeStr} · Ref: ${h.id || ''}</div>
                    </div>
                    <div class="history-entry-status ${h.status || 'confirmed'}">${h.status || 'confirmed'}</div>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('History load failed:', e);
    }
}

// ============================================
// CHATBOT INTEGRATION — handle booking intents
// ============================================
// Enhance the chatbot to detect booking-related messages
const _origGenerateChatResponse = window.generateChatResponse;
window.generateChatResponse = async function(userMsg) {
    const lower = userMsg.toLowerCase();

    // Detect booking intents
    if (/(book|search|find)\s*(a\s+)?(flight|plane)/i.test(lower)) {
        agenticSearchFlights();
        return '✈️ I\'m searching for flights now! Check the booking wizard above.';
    }
    if (/(book|search|find)\s*(a\s+)?(train|rail)/i.test(lower)) {
        agenticSearchTrains();
        return '🚂 Searching for trains now! Check the booking wizard above.';
    }
    if (/(book|search|find)\s*(a\s+)?(hotel|stay|room|accommodation)/i.test(lower)) {
        agenticSearchHotels();
        return '🏨 Searching for hotels now! See the options in the booking wizard above.';
    }
    if (/(book|search|find)\s*(a\s+)?(cab|taxi|car|transport|ride)/i.test(lower)) {
        agenticSearchCabs();
        return '🚗 Looking for local transport! Check the wizard above.';
    }
    if (/(pay|payment|checkout|confirm\s+booking)/i.test(lower)) {
        if (agenticState.cart.length > 0) {
            agenticProceedToPayment();
            return '💳 Proceeding to payment. Fill in your details in the wizard above.';
        }
        return 'You don\'t have any items in your cart yet. Search for flights, hotels, or cabs first!';
    }
    if (/(history|booking\s*history|my\s*bookings|past\s*bookings)/i.test(lower)) {
        toggleHistory();
        return '📋 Opening your booking history panel!';
    }

    // Fall through to original chatbot
    if (_origGenerateChatResponse) return _origGenerateChatResponse(userMsg);
    return 'I can help you book flights, hotels, and cabs! Just ask.';
};

console.log('Smart Route SRMist Agentic Booking Engine loaded');

})();
