// ============================================
// SmartRoute v7.0 - Agentic AI Frontend
// Real-time agent monitoring and automation
// ============================================

const API_BASE_URL = 'http://localhost:8000';

let currentItinerary = null;
let websocket = null;
let agentActivities = [];
let bookingResults = {
    hotels: [],
    flights: [],
    restaurants: []
};

// ============================================
// Initialize Application
// ============================================

function initializeApp() {
    console.log('🤖 Initializing SmartRoute v7.0 - Agentic AI...');
    
    // Initialize map
    if (typeof initMap === 'function') {
        initMap();
    }
    
    // Set default date
    const dateInput = document.getElementById('startDate');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    // Check backend health
    checkBackendHealth();
    
    // Setup event listeners
    setupEventListeners();
    
    // Connect to WebSocket for real-time agent updates
    connectWebSocket();
    
    console.log('✅ Agentic AI system initialized');
}

// ============================================
// WebSocket Connection for Real-Time Updates
// ============================================

function connectWebSocket() {
    try {
        websocket = new WebSocket('ws://localhost:8000/ws/agents');
        
        websocket.onopen = () => {
            console.log('🔌 Connected to agent activity stream');
            showToast('Connected to AI agents', 'success');
        };
        
        websocket.onmessage = (event) => {
            const activity = JSON.parse(event.data);
            handleAgentActivity(activity);
        };
        
        websocket.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
        };
        
        websocket.onclose = () => {
            console.log('🔌 Disconnected from agent stream');
            // Reconnect after 5 seconds
            setTimeout(connectWebSocket, 5000);
        };
    } catch (error) {
        console.error('❌ WebSocket connection failed:', error);
    }
}

function handleAgentActivity(activity) {
    console.log('🤖 Agent Activity:', activity);
    
    // Add to activities log
    agentActivities.push(activity);
    
    // Update agent status display
    updateAgentDisplay(activity);
    
    // Add to real-time log
    addToActivityLog(activity);
    
    // Show toast for important activities
    if (activity.message.includes('✅')) {
        showToast(`${activity.agent_name}: Task completed`, 'success');
    }
}

function updateAgentDisplay(activity) {
    const agentId = activity.agent_id;
    const agentElement = document.getElementById(`agent-${agentId}`);
    
    if (agentElement) {
        const statusDot = agentElement.querySelector('.agent-status-dot');
        const statusText = agentElement.querySelector('.agent-status-text');
        const activityText = agentElement.querySelector('.agent-activity');
        
        // Update status dot color
        if (statusDot) {
            statusDot.className = 'agent-status-dot';
            if (activity.status === 'working') {
                statusDot.classList.add('status-working');
            } else if (activity.status === 'completed') {
                statusDot.classList.add('status-completed');
            } else if (activity.status === 'error') {
                statusDot.classList.add('status-error');
            }
        }
        
        // Update status text
        if (statusText) {
            statusText.textContent = activity.status.toUpperCase();
        }
        
        // Update activity text
        if (activityText) {
            activityText.textContent = activity.message;
        }
    }
}

function addToActivityLog(activity) {
    const logContainer = document.getElementById('agentActivityLog');
    if (!logContainer) return;
    
    const logEntry = document.createElement('div');
    logEntry.className = 'log-entry';
    logEntry.innerHTML = `
        <div class="log-timestamp">${new Date(activity.timestamp).toLocaleTimeString()}</div>
        <div class="log-agent">${activity.agent_name}</div>
        <div class="log-message">${activity.message}</div>
    `;
    
    logContainer.insertBefore(logEntry, logContainer.firstChild);
    
    // Keep only last 50 entries
    while (logContainer.children.length > 50) {
        logContainer.removeChild(logContainer.lastChild);
    }
}

// ============================================
// Event Listeners
// ============================================

function setupEventListeners() {
    // Generate trip button
    const generateBtn = document.getElementById('generateTripBtn');
    if (generateBtn) {
        generateBtn.addEventListener('click', handleGenerateTrip);
    }
    
    // Autonomous planning button
    const autonomousBtn = document.getElementById('autonomousPlanBtn');
    if (autonomousBtn) {
        autonomousBtn.addEventListener('click', handleAutonomousPlanning);
    }
    
    // Modal close
    const modalClose = document.querySelector('.modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', closeMediaModal);
    }
    
    // Close modal on outside click
    const modalOverlay = document.getElementById('mediaModal');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeMediaModal();
            }
        });
    }
    
    console.log('✅ Event listeners setup complete');
}

// ============================================
// Backend Communication
// ============================================

async function checkBackendHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        
        console.log('🏥 Backend health:', data);
        
        if (data.status === 'healthy') {
            showToast(`${data.agents_total} AI agents ready`, 'success');
            
            // Load agent status
            loadAgentStatus();
        }
    } catch (error) {
        console.error('❌ Backend health check failed:', error);
        showToast('Backend unavailable - check if server is running', 'error');
    }
}

async function loadAgentStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/agents/status`);
        const data = await response.json();
        
        console.log('🤖 Agent status:', data);
        
        // Display agents in sidebar
        displayAgents(data.agents);
    } catch (error) {
        console.error('❌ Failed to load agent status:', error);
    }
}

function displayAgents(agents) {
    const container = document.getElementById('agentsContainer');
    if (!container) return;
    
    container.innerHTML = agents.map(agent => `
        <div class="agent-card" id="agent-${agent.id}">
            <div class="agent-header">
                <div class="agent-icon">🤖</div>
                <div class="agent-info">
                    <div class="agent-name">${agent.name}</div>
                    <div class="agent-role">${agent.role}</div>
                </div>
                <div class="agent-status-dot"></div>
            </div>
            <div class="agent-status-text">${agent.status.toUpperCase()}</div>
            <div class="agent-activity">Idle</div>
            <div class="agent-stats">
                <span>✅ ${agent.completed_tasks} tasks</span>
            </div>
        </div>
    `).join('');
}

// ============================================
// Trip Generation
// ============================================

async function handleGenerateTrip() {
    console.log('🎯 Starting agentic trip generation...');
    
    // Get form values
    const destination = document.getElementById('destination')?.value;
    const duration = parseInt(document.getElementById('duration')?.value || '3');
    const budget = parseFloat(document.getElementById('budget')?.value || '15000');
    const startDate = document.getElementById('startDate')?.value;
    const persona = document.getElementById('personaSelect')?.value || 'solo';
    
    // Get booking options
    const includeFlights = document.getElementById('includeFlights')?.checked || false;
    const includeHotels = document.getElementById('includeHotels')?.checked !== false;
    const includeRestaurants = document.getElementById('includeRestaurants')?.checked !== false;
    const includeTransport = document.getElementById('includeTransport')?.checked !== false;
    
    // Validation
    if (!destination || destination.trim() === '') {
        showToast('Please enter a destination', 'error');
        return;
    }
    
    if (!startDate) {
        showToast('Please select a start date', 'error');
        return;
    }
    
    const tripRequest = {
        destination: destination.trim(),
        duration,
        budget,
        start_date: startDate,
        preferences: ['cultural', 'adventure', 'food'],
        persona,
        include_flights: includeFlights,
        include_hotels: includeHotels,
        include_restaurants: includeRestaurants,
        include_transport: includeTransport
    };
    
    console.log('📝 Trip request:', tripRequest);
    
    // Show loading
    showLoading(true);
    showToast('🤖 AI agents are planning your trip...', 'info');
    
    // Clear previous activities
    agentActivities = [];
    const logContainer = document.getElementById('agentActivityLog');
    if (logContainer) {
        logContainer.innerHTML = '';
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/generate-trip`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(tripRequest)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Trip generated:', data);
            
            currentItinerary = data.itinerary;
            bookingResults = data.bookings;
            
            // Display everything
            displayItinerary(data.itinerary);
            displayBookings(data.bookings);
            displayBudgetBreakdown(data.budget_breakdown);
            displayAgentSummary(data.agent_summary);
            
            // Update map
            if (typeof updateMapWithItinerary === 'function') {
                updateMapWithItinerary(data.itinerary);
            }
            
            // Update budget tracker
            updateBudgetTracker(data.itinerary);
            
            showToast('✅ Complete trip plan ready!', 'success');
        } else {
            throw new Error('Invalid response from server');
        }
        
    } catch (error) {
        console.error('❌ Error generating trip:', error);
        showToast(`Error: ${error.message}`, 'error');
        
    } finally {
        showLoading(false);
    }
}

// ============================================
// Autonomous Planning (Full Automation)
// ============================================

async function handleAutonomousPlanning() {
    showToast('🤖 Agents taking full control...', 'info');
    
    // Show autonomous mode panel
    const autonomousPanel = document.getElementById('autonomousPanel');
    if (autonomousPanel) {
        autonomousPanel.style.display = 'block';
    }
    
    // Let agents work automatically with minimal input
    const destination = document.getElementById('destination')?.value || 'Paris';
    const budget = parseFloat(document.getElementById('budget')?.value || '50000');
    
    // Agents decide everything else
    showToast('🤖 Agents analyzing best options...', 'info');
    
    // Trigger full autonomous planning
    await handleGenerateTrip();
}

// ============================================
// Display Functions
// ============================================

function displayItinerary(itinerary) {
    const container = document.getElementById('itineraryContainer');
    if (!container) return;
    
    if (!itinerary || !itinerary.days || itinerary.days.length === 0) {
        container.innerHTML = '<p class="text-center">No itinerary to display</p>';
        return;
    }
    
    let html = '';
    
    itinerary.days.forEach((day, index) => {
        const dayDate = new Date(day.date);
        const formattedDate = dayDate.toLocaleDateString('en-US', { 
            weekday: 'short', 
            month: 'short', 
            day: 'numeric' 
        });
        
        html += `
            <div class="day-card" data-day="${day.day}">
                <div class="day-header">
                    <div>
                        <div class="day-title">Day ${day.day} - ${day.city}</div>
                        <div class="day-date">${formattedDate}</div>
                    </div>
                    <div class="day-cost">₹${(day.daily_cost || 0).toLocaleString()}</div>
                </div>
                <div class="activities-container">
                    ${(day.activities || []).map((activity, actIndex) => `
                        <div class="activity-card type-${activity.type || 'default'}" 
                             onclick="showActivityDetails(${index}, ${actIndex})">
                            <div class="activity-image" style="background-image: url('${activity.photo || 'https://images.pexels.com/photos/460672/pexels-photo-460672.jpeg'}')"></div>
                            <div class="activity-content">
                                <div class="activity-header">
                                    <div class="activity-name">${activity.name}</div>
                                    <div class="activity-rating">⭐ ${activity.rating || 4.5}</div>
                                </div>
                                <div class="activity-description">${activity.description || ''}</div>
                                <div class="activity-details">
                                    <span>⏰ ${activity.time}</span>
                                    <span>⏱️ ${activity.duration}</span>
                                    <span>💰 ₹${(activity.cost || 0).toLocaleString()}</span>
                                </div>
                                <button class="activity-media-btn" onclick="event.stopPropagation(); showActivityMedia('${activity.name}', ${JSON.stringify(activity.media).replace(/"/g, '&quot;')})">
                                    📸 View Photos & Videos
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    });
    
    // Add summary
    const totalCost = itinerary.total_cost || itinerary.days.reduce((sum, day) => sum + (day.daily_cost || 0), 0);
    html += `
        <div class="itinerary-summary">
            <h3>🎯 Trip Summary</h3>
            <div class="summary-stats">
                <div class="stat-item">
                    <div class="stat-label">Total Days</div>
                    <div class="stat-value">${itinerary.days.length}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Total Cost</div>
                    <div class="stat-value">₹${totalCost.toLocaleString()}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">Activities</div>
                    <div class="stat-value">${itinerary.days.reduce((sum, day) => sum + (day.activities?.length || 0), 0)}</div>
                </div>
            </div>
        </div>
    `;
    
    container.innerHTML = html;
    console.log('✅ Itinerary displayed with real attractions');
}

function displayBookings(bookings) {
    if (!bookings) return;
    
    // Display hotels
    if (bookings.hotels && bookings.hotels.length > 0) {
        displayHotels(bookings.hotels);
    }
    
    // Display flights
    if (bookings.flights && bookings.flights.length > 0) {
        displayFlights(bookings.flights);
    }
    
    // Display restaurants
    if (bookings.restaurants && bookings.restaurants.length > 0) {
        displayRestaurants(bookings.restaurants);
    }
}

function displayHotels(hotels) {
    const container = document.getElementById('hotelsContainer');
    if (!container) return;
    
    container.innerHTML = `
        <h3>🏨 Recommended Hotels</h3>
        <div class="booking-grid">
            ${hotels.map(hotel => `
                <div class="booking-card hotel-card">
                    <div class="booking-image" style="background-image: url('${hotel.photo}')"></div>
                    <div class="booking-info">
                        <div class="booking-name">${hotel.name}</div>
                        <div class="booking-rating">⭐ ${hotel.rating}</div>
                        <div class="booking-price">₹${hotel.price_per_night.toLocaleString()}/night</div>
                        <div class="booking-amenities">
                            ${hotel.amenities.map(a => `<span class="amenity">${a}</span>`).join('')}
                        </div>
                        <a href="${hotel.booking_url}" target="_blank" class="booking-btn">
                            Book Now →
                        </a>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function displayFlights(flights) {
    const container = document.getElementById('flightsContainer');
    if (!container) return;
    
    container.innerHTML = `
        <h3>✈️ Available Flights</h3>
        <div class="booking-list">
            ${flights.map(flight => `
                <div class="booking-card flight-card">
                    <div class="flight-info">
                        <div class="flight-airline">${flight.airline}</div>
                        <div class="flight-time">${flight.departure} → ${flight.arrival}</div>
                        <div class="flight-duration">${flight.duration}</div>
                    </div>
                    <div class="flight-price">₹${flight.price.toLocaleString()}</div>
                    <a href="${flight.booking_url}" target="_blank" class="booking-btn">Book</a>
                </div>
            `).join('')}
        </div>
    `;
}

function displayRestaurants(restaurants) {
    const container = document.getElementById('restaurantsContainer');
    if (!container) return;
    
    container.innerHTML = `
        <h3>🍽️ Recommended Restaurants</h3>
        <div class="booking-grid">
            ${restaurants.map(restaurant => `
                <div class="booking-card restaurant-card">
                    <div class="booking-image" style="background-image: url('${restaurant.photo}')"></div>
                    <div class="booking-info">
                        <div class="booking-name">${restaurant.name}</div>
                        <div class="booking-rating">⭐ ${restaurant.rating}</div>
                        <div class="booking-price">${restaurant.price_range}</div>
                        <div class="booking-cuisine">${restaurant.cuisine}</div>
                        <a href="${restaurant.booking_url}" target="_blank" class="booking-btn">
                            Reserve Table →
                        </a>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function displayBudgetBreakdown(breakdown) {
    if (!breakdown) return;
    
    const container = document.getElementById('budgetBreakdownContainer');
    if (!container) return;
    
    container.innerHTML = `
        <h3>💰 Budget Allocation</h3>
        <div class="budget-breakdown">
            ${Object.entries(breakdown).map(([category, amount]) => `
                <div class="budget-item">
                    <span class="budget-category">${category}</span>
                    <span class="budget-amount">₹${amount.toLocaleString()}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function displayAgentSummary(summary) {
    if (!summary) return;
    
    showToast(`✅ ${summary.agents_used} agents completed ${summary.tasks_completed} tasks in ${summary.total_time}`, 'success');
}

function updateBudgetTracker(itinerary) {
    if (!itinerary) return;
    
    const totalCost = itinerary.total_cost || 0;
    const budgetUsedEl = document.querySelector('.budget-used');
    const budgetFillEl = document.querySelector('.budget-fill');
    
    if (budgetUsedEl) {
        budgetUsedEl.textContent = `₹${totalCost.toLocaleString()}`;
    }
    
    if (budgetFillEl) {
        const budgetTotal = parseFloat(document.getElementById('budget')?.value || 15000);
        const percentage = Math.min((totalCost / budgetTotal) * 100, 100);
        budgetFillEl.style.width = `${percentage}%`;
    }
}

// ============================================
// UI Helpers
// ============================================

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.toggle('active', show);
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fas fa-${getToastIcon(type)}"></i>
            <span>${message}</span>
        </div>
    `;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function getToastIcon(type) {
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    return icons[type] || 'info-circle';
}

window.showActivityDetails = function(dayIndex, activityIndex) {
    if (!currentItinerary) return;
    
    const activity = currentItinerary.days[dayIndex]?.activities[activityIndex];
    if (!activity || !activity.media) return;
    
    showActivityMedia(activity.name, activity.media);
};

// ============================================
// Demo Mode
// ============================================

window.startAutoDemo = function() {
    showToast('🤖 Starting autonomous demo mode...', 'info');
    
    // Set demo values
    document.getElementById('destination').value = 'Paris';
    document.getElementById('duration').value = '3';
    document.getElementById('budget').value = '50000';
    
    setTimeout(() => {
        handleGenerateTrip();
    }, 500);
};

// ============================================
// Theme Toggle
// ============================================

window.toggleTheme = function() {
    document.body.classList.toggle('dark-mode');
    document.body.classList.toggle('light-mode');
};

// ============================================
// Initialize on Load
// ============================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

console.log('✅ SmartRoute v7.0 - Agentic AI Frontend loaded');
