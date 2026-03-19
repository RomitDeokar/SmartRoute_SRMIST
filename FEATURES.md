# Feature Implementation Status

## Multi-Agent System

### 7 Coordinated Agents
- **Planner Agent** — MCTS-based itinerary optimisation, nearest-neighbor routing
- **Weather Risk Agent** — Naive Bayes classifier on OpenMeteo data
- **Crowd Analyzer Agent** — Time-of-day crowd heuristic (not real-time footfall)
- **Budget Optimizer Agent** — Budget breakdown + MDP reward-based allocation
- **Preference Agent** — Beta distribution (Bayesian) preference learning, persisted
- **Booking Assistant Agent** — Flight/train/hotel/cab search with booking URLs
- **Explainability Agent** — MDP decision trace, POMDP belief display

### Agent Features
- Visual status indicators (idle / working / completed)
- Real-time WebSocket messages from backend during trip generation
- Agent communication graph showing actual data-flow connections
- Activity log with timestamped agent messages

---

## MDP / RL Implementation

### MDP Components
- **State Space** — day, location, budget_remaining, weather_prob, crowd_level, satisfaction
- **Action Space** — keep_plan, swap_activity, reorder_destinations, adjust_budget, add_contingency, remove_activity
- **Transition** — concrete itinerary mutations (swap/reorder/remove real activities)
- **Reward** — R = α·satisfaction + β·budget_adherence + γ·weather_match − δ·crowd_penalty (computed from real data)

### RL Algorithms
- **Q-Learning** — ε-greedy with Q-table, updated on each user rating, persisted to JSON
- **MCTS** — 50-iteration Monte Carlo Tree Search operating on real itinerary variants
- **ε-Greedy** — exploration / exploitation with decay

> **Not implemented**: DQN, PPO, Experience Replay, Hierarchical RL, Gaussian Processes.
> These were removed to avoid false claims.

### RL Features
- Backend-computed reward per rating event
- Reward history chart (real data only, no random walk)
- Q-table persistence across sessions
- Policy extraction from Q-table

---

## Bayesian Inference

### Distributions
- **Beta Distribution** — per-category binary preference (alpha, beta parameters), updated on ratings >=4 / < 4
- **Dirichlet Distribution** — models proportion of time allocated across categories Dir(alpha_1,...,alpha_K), updated on each rating with weight proportional to stars
- **Naive Bayes** — weather classification (sunny/cloudy/rainy) from OpenMeteo features (temp, humidity, cloud_cover, wind_speed, precipitation)

### Bayesian Features
- Prior initialisation (alpha=2, beta=2 uniform for Beta; alpha=2 for Dirichlet)
- Posterior updates on each user rating
- Confidence intervals (95%) via scipy Beta quantiles
- Dirichlet expected proportions and mode proportions displayed in UI
- Frontend bars read persisted backend state
- Session persistence to JSON

---

## POMDP

- **Belief state** over hidden states: excellent / good / average / poor trip quality
- **Bayesian belief update**: P(o|s) × b(s) normalised after each observation
- Observations: user ratings (high/mid/low) and weather class (sunny/cloudy/rainy)
- Belief persisted to JSON and displayed in the UI

---

## Weather

- Real OpenMeteo API data (temperature, precipitation, wind, etc.)
- Naive Bayes classifier outputs P(sunny), P(cloudy), P(rainy)
- Weather probabilities feed into MDP reward function
- Activities on high-risk days receive weather warnings

## Crowd

- Time-of-day heuristic: assigns crowd level 0-100 based on activity start time
- Not real-time footfall data — a reasonable approximation

## Budget

- Backend computes full breakdown: accommodation, food, activities, transport, emergency
- Frontend displays backend breakdown (no erroneous local calculations)
- MDP reward penalises budget over-/under-utilisation

---

## Itinerary Optimisation

- **Nearest-neighbor TSP** orders daily activities by GPS proximity
- **MCTS** evaluates multiple itinerary variants (swap, reorder, trim) and picks the highest-reward one
- Activities from real APIs (Overpass, OpenTripMap, Wikipedia)
- Zero duplicate places across days

## Booking

- Flights: search with realistic distance-based pricing, 5 booking platform URLs
- Trains: Indian rail types with class-based pricing, 3 booking platform URLs
- Hotels: brand-tier pricing with photo URLs and 6 booking platform URLs
- Cabs: category-based pricing (auto, sedan, SUV, luxury)

## Frontend

- Wikipedia/Wikimedia photo source (no Pexels)
- Real backend errors surfaced in agent conversation panel
- No silent fallback hiding — errors shown to user
- Location-specific YouTube/Instagram content with destination-aware search queries

---

## What Is NOT Implemented

The following features were previously claimed but are not present:

- DQN (Deep Q-Network)
- PPO (Proximal Policy Optimisation)
- Hierarchical RL
- Gaussian Processes
- "Emergent behavior" between agents
- LangChain-based planner agents
- Real-time crowd data from external APIs
- Hardcoded accuracy/efficiency/uptime percentages (removed)
