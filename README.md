# Smart Route SRMist — Agentic AI Travel Planner

A multi-agent travel planning system with real reinforcement learning, Bayesian preference learning, and Monte Carlo Tree Search.

## Quick Start

```bash
# Install dependencies
cd backend
pip install fastapi uvicorn httpx python-dotenv pydantic numpy scipy

# Start backend (port 8000)
python smartroute_server.py

# Serve frontend (port 8080)
cd ..   # back to project root
python3 -m http.server 8080
```

Open `http://localhost:8080` in your browser.

## Architecture

### Backend (`backend/smartroute_server.py`)
- **FastAPI** server with REST endpoints and WebSocket
- **AI Engine** (`backend/ai_engine.py`): Q-Learning, MCTS, Bayesian Beta model, Naive Bayes weather classifier, POMDP belief state
- **APIs**: Overpass (OSM), OpenTripMap, Wikipedia for attractions; OpenMeteo for weather
- **Booking search**: flights, trains, hotels, cabs with real booking platform URLs
- **Persistence**: Q-table, Bayesian preferences, POMDP belief saved to `backend/ai_data/*.json`

### Frontend (`index.html`, `js/app.js`, `js/agentic.js`)
- Single-page app with dark/light theme
- Leaflet map with route visualisation
- Real-time agent status via WebSocket
- Bayesian preference bars (synced from backend)
- RL reward chart (real data from backend, no random walk)
- MDP decision trace and POMDP belief display
- Activity rating updates Q-table and Bayesian model on the backend

### 7 Agents
| Agent | Role | Implementation |
|-------|------|----------------|
| Planner | Itinerary generation + MCTS optimisation | MCTS with UCB1, nearest-neighbor TSP |
| Weather | Forecast + risk assessment | OpenMeteo API + Naive Bayes classifier |
| Crowd | Crowd level estimation | Time-of-day heuristic (not real-time data) |
| Budget | Cost optimisation | MDP reward-based budget adherence |
| Preference | Taste learning | Beta distribution, updated per rating |
| Booking | Reservations | Flight/train/hotel/cab search + URLs |
| Explain | Reasoning display | MDP trace, POMDP belief, Q-stats |

## AI Components

### Q-Learning
- ε-greedy action selection with decay
- Q-table persisted to JSON
- Updated on every user activity rating
- Actions: keep_plan, swap_activity, reorder_destinations, adjust_budget, add_contingency, remove_activity

### MCTS (Monte Carlo Tree Search)
- 50 iterations with UCB1 exploration
- Operates on real itinerary variants
- Actions add/swap/reorder actual activities
- Selects highest-reward itinerary

### Bayesian Beta Model
- Per-category (cultural, adventure, food, relaxation, shopping, nature, nightlife)
- Rating ≥ 4 → α += 1; Rating < 4 → β += 1
- 95% confidence intervals via scipy
- Persisted to JSON

### Naive Bayes Weather Classifier
- Classifies OpenMeteo data into P(sunny), P(cloudy), P(rainy)
- Gaussian likelihood model
- Probabilities fed into MDP reward

### POMDP Belief State
- Hidden states: excellent, good, average, poor trip quality
- Bayesian belief update on each observation (ratings, weather)
- Displayed in the UI

### MDP Reward Function
```
R = α × satisfaction_norm + β × budget_adherence + γ × weather_prob − δ × crowd_penalty
```
Where α=0.4, β=0.3, γ=0.2, δ=0.1.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| POST | `/generate-trip` | Generate full itinerary |
| POST | `/nearby` | Find nearby places |
| POST | `/replan` | Emergency replanning |
| POST | `/ai/rate` | Rate activity → update RL + Bayesian + POMDP |
| POST | `/ai/mdp-trace` | Get MDP decision trace |
| GET | `/ai/state` | Get full AI state |
| GET | `/ai/bayesian` | Get Bayesian preferences |
| GET | `/ai/q-stats` | Get Q-learning statistics |
| GET | `/ai/pomdp` | Get POMDP belief |
| GET | `/ai/dirichlet` | Get Dirichlet preferences |
| POST | `/agentic/flights/search` | Search flights |
| POST | `/agentic/trains/search` | Search trains |
| POST | `/agentic/hotels/search` | Search hotels |
| POST | `/agentic/cabs/search` | Search cabs |
| WS | `/ws/agents` | Real-time agent messages |

## File Structure

```
├── index.html                  # Main UI
├── js/
│   ├── app.js                  # Core app logic
│   └── agentic.js              # Agentic booking workflow
├── css/                        # Stylesheets
├── backend/
│   ├── smartroute_server.py    # FastAPI server
│   ├── ai_engine.py            # AI components (RL, Bayesian, Dirichlet, MCTS, POMDP)
│   └── ai_data/                # Persisted state (auto-created)
├── FEATURES.md                 # Accurate feature status
└── README.md                   # This file
```

## Limitations

- Crowd levels use a time-of-day heuristic, not real-time data
- Flight/train/hotel prices are simulated (distance-based formula, not live API)
- No DQN, PPO, or Hierarchical RL (only Q-Learning and MCTS)
- No LangChain integration (removed)
- Weather classifier uses pre-set Gaussian likelihood parameters, not trained on large datasets
- Dirichlet model tracks activity-type proportions, not full multinomial over individual activities
