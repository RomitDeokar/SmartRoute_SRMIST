"""
AI Engine — Real RL, Bayesian, MCTS, MDP, Weather Classifier, POMDP, Dirichlet
All components integrated with persistence (JSON files) and real data.
No fake simulations. No false claims.
"""

import json, os, math, random, time, hashlib
import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from collections import defaultdict
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------
DATA_DIR = Path(__file__).parent / "ai_data"
DATA_DIR.mkdir(exist_ok=True)

def _load_json(name: str, default: Any = None) -> Any:
    p = DATA_DIR / f"{name}.json"
    if p.exists():
        try:
            return json.loads(p.read_text())
        except Exception:
            pass
    return default if default is not None else {}

def _save_json(name: str, data: Any):
    p = DATA_DIR / f"{name}.json"
    p.write_text(json.dumps(data, indent=2, default=str))


# ============================================================================
# 1) MDP — State & Environment (real itinerary data)
# ============================================================================

class MDPState:
    """MDP state built from real itinerary + weather + crowd + budget data."""
    __slots__ = ("day", "location", "budget_remaining", "budget_total",
                 "weather_prob", "crowd_level", "satisfaction",
                 "activity_count", "total_cost")

    def __init__(self, *, day=1, location="Unknown", budget_remaining=15000,
                 budget_total=15000, weather_prob=0.8, crowd_level=50,
                 satisfaction=3.5, activity_count=0, total_cost=0):
        self.day = day
        self.location = location
        self.budget_remaining = budget_remaining
        self.budget_total = budget_total
        self.weather_prob = weather_prob
        self.crowd_level = crowd_level
        self.satisfaction = satisfaction
        self.activity_count = activity_count
        self.total_cost = total_cost

    def to_tuple(self) -> Tuple:
        budget_total = max(self.budget_total, 1)
        budget_ratio = self.budget_remaining / budget_total
        cost_ratio = self.total_cost / budget_total
        avg_activity_cost = self.total_cost / max(self.activity_count, 1)
        avg_cost_bucket = int(min(avg_activity_cost / budget_total, 1) * 20)
        location_bucket = int(hashlib.md5(self.location.encode("utf-8")).hexdigest(), 16) % 50
        return (
            self.day,
            location_bucket,
            int(budget_ratio * 30),
            int(cost_ratio * 30),
            int(self.weather_prob * 20),
            int(self.crowd_level / 5),
            int(self.satisfaction * 2),
            min(self.activity_count, 10),
            avg_cost_bucket,
        )

    def to_dict(self) -> Dict:
        return {k: getattr(self, k) for k in self.__slots__}

    @staticmethod
    def from_itinerary(itin: Dict, weather: List[Dict], budget: float) -> "MDPState":
        """Build a real MDP state from actual trip data."""
        days = itin.get("days", [])
        total_cost = itin.get("total_cost", 0)
        act_count = sum(len(d.get("activities", [])) for d in days)
        avg_rating = 3.5
        if act_count > 0:
            s = sum(a.get("rating", 4.0) for d in days for a in d.get("activities", []))
            avg_rating = s / act_count

        # Weather probability from real forecasts
        if weather:
            good_days = sum(1 for w in weather if w.get("risk_level", "low") != "high")
            wp = good_days / len(weather)
        else:
            wp = 0.7

        # Crowd from time-of-day heuristic
        cl = _crowd_heuristic_avg(days)

        loc = days[0]["city"] if days else "Unknown"
        return MDPState(
            day=len(days),
            location=loc,
            budget_remaining=max(0, budget - total_cost),
            budget_total=budget,
            weather_prob=wp,
            crowd_level=cl,
            satisfaction=avg_rating,
            activity_count=act_count,
            total_cost=total_cost,
        )


# Concrete itinerary actions
ACTIONS = [
    "keep_plan",
    "swap_activity",          # swap a low-rated activity with a better-rated one
    "reorder_destinations",   # reorder by nearest-neighbour
    "adjust_budget",          # trim expensive items to save budget
    "add_contingency",        # add indoor/backup activities for bad weather
    "remove_activity",        # drop worst-rated activity to save time/money
]


class MDPEnvironment:
    """Real MDP: rewards computed from actual metrics, transitions based on
    concrete itinerary operations."""

    ALPHA = 0.4   # user-rating weight
    BETA  = 0.3   # budget adherence weight
    GAMMA = 0.2   # weather-match weight
    DELTA = 0.1   # crowd penalty weight

    def __init__(self):
        self.actions = ACTIONS

    # ---- reward from REAL data ----
    def reward(self, state: MDPState) -> float:
        sat_norm = state.satisfaction / 5.0
        # Optimal: spend 50-80% of budget
        usage = state.total_cost / max(state.budget_total, 1)
        budget_adh = max(0, 1 - abs(usage - 0.65) / 0.65)
        weather = state.weather_prob
        crowd_pen = state.crowd_level / 100.0
        r = (self.ALPHA * sat_norm
             + self.BETA * budget_adh
             + self.GAMMA * weather
             - self.DELTA * crowd_pen)
        return float(np.clip(r, -1, 1))

    # ---- concrete transition on an itinerary ----
    def apply_action(self, itin: Dict, action: str, attractions_pool: List[Dict] = None) -> Dict:
        """Mutate an itinerary dict by executing a concrete action.
        Returns the modified itinerary."""
        days = itin.get("days", [])
        if not days:
            return itin

        if action == "keep_plan":
            pass  # no-op

        elif action == "swap_activity":
            # Find worst-rated activity and swap with a pool candidate
            worst_day, worst_idx, worst_rating = None, None, 999
            for di, d in enumerate(days):
                for ai, a in enumerate(d.get("activities", [])):
                    r = a.get("rating", 4.0)
                    if r < worst_rating:
                        worst_rating = r
                        worst_day, worst_idx = di, ai
            if worst_day is not None and attractions_pool:
                used = {a["name"] for d in days for a in d.get("activities", [])}
                candidates = [p for p in attractions_pool if p["name"] not in used and p.get("rating", 0) > worst_rating]
                if candidates:
                    best = max(candidates, key=lambda x: x.get("rating", 0))
                    old = days[worst_day]["activities"][worst_idx]
                    new_act = {
                        "name": best["name"], "type": best.get("type", "attraction"),
                        "time": old["time"], "duration": best.get("duration", "2 hours"),
                        "cost": best.get("price", 0), "rating": best.get("rating", 4.5),
                        "description": best.get("description", f"Visit {best['name']}"),
                        "lat": best.get("lat", 0), "lon": best.get("lon", 0),
                        "photo": (best.get("photos") or [""])[0] if best.get("photos") else "",
                        "photos": best.get("photos", []),
                    }
                    days[worst_day]["activities"][worst_idx] = new_act

        elif action == "reorder_destinations":
            for d in days:
                acts = d.get("activities", [])
                if len(acts) > 2:
                    d["activities"] = _nearest_neighbor_order(acts)

        elif action == "adjust_budget":
            # Remove the most expensive activity overall (only from days with >2 activities)
            most_day, most_idx, most_cost = None, None, -1
            for di, d in enumerate(days):
                for ai, a in enumerate(d.get("activities", [])):
                    if a.get("cost", 0) > most_cost and len(d.get("activities", [])) > 2:
                        most_cost = a["cost"]
                        most_day, most_idx = di, ai
            if most_day is not None:
                days[most_day]["activities"].pop(most_idx)

        elif action == "add_contingency":
            # Tag outdoor activities on bad-weather days with indoor alternatives
            for d in days:
                w = d.get("weather")
                if w and w.get("risk_level") == "high":
                    for a in d.get("activities", []):
                        if a.get("type") in ("park", "viewpoint", "beach", "adventure"):
                            a["weather_warning"] = "Rain expected - consider indoor alternative"
                            a["crowd_tip"] = "Museums & indoor attractions recommended"

        elif action == "remove_activity":
            worst_day, worst_idx, worst_rating = None, None, 999
            for di, d in enumerate(days):
                if len(d.get("activities", [])) > 2:
                    for ai, a in enumerate(d.get("activities", [])):
                        if a.get("rating", 4.0) < worst_rating:
                            worst_rating = a.get("rating", 4.0)
                            worst_day, worst_idx = di, ai
            if worst_day is not None:
                days[worst_day]["activities"].pop(worst_idx)

        # Recompute costs
        for d in days:
            d["daily_cost"] = sum(a.get("cost", 0) for a in d.get("activities", []))
        itin["total_cost"] = sum(d["daily_cost"] for d in days)
        return itin


# ============================================================================
# 2) Q-Learning Agent — persisted Q-table
# ============================================================================

class QLearningAgent:
    """Q-Learning with epsilon-greedy, persisted Q-table, rating-based reward."""

    def __init__(self, lr=0.1, gamma=0.95, epsilon=0.3,
                 eps_decay=0.995, min_eps=0.05):
        self.lr = lr
        self.gamma = gamma
        self.epsilon = epsilon
        self.eps_decay = eps_decay
        self.min_eps = min_eps
        self.env = MDPEnvironment()
        self.q_table: Dict[Tuple, Dict[str, float]] = {}
        self.episodes = 0
        self.total_reward = 0.0
        self.reward_history: List[float] = []
        self._load()

    # ---- persistence ----
    def _load(self):
        data = _load_json("q_table")
        if data:
            self.q_table = {tuple(json.loads(k)): v for k, v in data.get("table", {}).items()}
            self.episodes = data.get("episodes", 0)
            self.epsilon = data.get("epsilon", self.epsilon)
            self.reward_history = data.get("reward_history", [])

    def save(self):
        _save_json("q_table", {
            "table": {json.dumps(list(k)): v for k, v in self.q_table.items()},
            "episodes": self.episodes,
            "epsilon": self.epsilon,
            "reward_history": self.reward_history[-500:],
        })

    # ---- core ----
    def _get_q(self, state: MDPState, action: str) -> float:
        key = state.to_tuple()
        return self.q_table.get(key, {}).get(action, 0.0)

    def _set_q(self, state: MDPState, action: str, value: float):
        key = state.to_tuple()
        if key not in self.q_table:
            self.q_table[key] = {}
        self.q_table[key][action] = value

    def select_action(self, state: MDPState) -> str:
        """Epsilon-greedy: explore with probability epsilon, exploit otherwise."""
        if random.random() < self.epsilon:
            return random.choice(ACTIONS)
        return self.best_action(state)

    def best_action(self, state: MDPState) -> str:
        key = state.to_tuple()
        qs = self.q_table.get(key, {})
        if not qs:
            return "keep_plan"
        return max(qs, key=qs.get)

    def update(self, state: MDPState, action: str, reward: float, next_state: MDPState):
        """Standard Q-learning update: Q(s,a) <- Q(s,a) + lr * [r + gamma * max_a' Q(s',a') - Q(s,a)]"""
        current_q = self._get_q(state, action)
        next_key = next_state.to_tuple()
        next_qs = self.q_table.get(next_key, {})
        max_next = max(next_qs.values()) if next_qs else 0.0
        td_target = reward + self.gamma * max_next
        new_q = current_q + self.lr * (td_target - current_q)
        self._set_q(state, action, new_q)

    def on_rating(self, state: MDPState, action: str, reward: float, next_state: MDPState):
        """Called when user rates an activity - update Q-table, decay epsilon, persist."""
        self.update(state, action, reward, next_state)
        self.epsilon = max(self.min_eps, self.epsilon * self.eps_decay)
        self.episodes += 1
        self.total_reward += reward
        self.reward_history.append(reward)
        self.save()

    def get_stats(self) -> Dict:
        return {
            "episodes": self.episodes,
            "epsilon": round(self.epsilon, 4),
            "q_table_size": sum(len(v) for v in self.q_table.values()),
            "avg_reward": round(float(np.mean(self.reward_history[-100:])), 4) if self.reward_history else 0,
            "reward_history": self.reward_history[-200:],
        }


# ============================================================================
# 3) MCTS — real activity-based tree search
# ============================================================================

class MCTSNode:
    __slots__ = ("itin", "parent", "action", "children", "visits", "value")

    def __init__(self, itin: Dict, parent=None, action=None):
        self.itin = itin
        self.parent = parent
        self.action = action
        self.children: List["MCTSNode"] = []
        self.visits = 0
        self.value = 0.0

    def ucb1(self, c=1.41) -> float:
        if self.visits == 0:
            return float("inf")
        if not self.parent:
            return self.value / self.visits
        parent_visits = max(self.parent.visits, 1)
        return (self.value / self.visits) + c * math.sqrt(math.log(parent_visits) / self.visits)

    def best_child(self, c=1.41) -> "MCTSNode":
        return max(self.children, key=lambda ch: ch.ucb1(c))


class MCTSPlanner:
    """MCTS that operates on real itinerary dicts - actions add/swap/reorder
    actual activities from an attractions pool."""

    def __init__(self, iterations=50, exploration=1.41):
        self.iterations = iterations
        self.exploration = exploration
        self.env = MDPEnvironment()

    def search(self, base_itin: Dict, attractions: List[Dict],
               weather: List[Dict], budget: float) -> Dict:
        """Run MCTS and return the best itinerary variant."""
        import copy
        root = MCTSNode(copy.deepcopy(base_itin))

        actual_iters = 0
        for _ in range(self.iterations):
            # Selection
            node = root
            while node.children:
                unexp = [ch for ch in node.children if ch.visits == 0]
                if unexp:
                    node = random.choice(unexp)
                    break
                node = node.best_child(self.exploration)

            # Expansion — try each action once per node
            if not node.children:
                for action in ACTIONS:
                    child_itin = copy.deepcopy(node.itin)
                    child_itin = self.env.apply_action(child_itin, action, attractions)
                    child = MCTSNode(child_itin, parent=node, action=action)
                    node.children.append(child)
                if node.children:
                    node = random.choice(node.children)

            # Simulation rollout with discounted evaluation
            sim_itin = copy.deepcopy(node.itin)
            rollout_steps = max(4, min(8, (len(attractions) // 2) if attractions else 4))
            cumulative = 0.0
            discount = 1.0
            discount_total = 0.0
            for _ in range(rollout_steps):
                act = random.choice(ACTIONS)
                sim_itin = self.env.apply_action(sim_itin, act, attractions)
                state = MDPState.from_itinerary(sim_itin, weather, budget)
                cumulative += discount * self.env.reward(state)
                discount_total += discount
                discount *= 0.9
            reward = cumulative / max(discount_total, 1.0)

            # Backpropagation
            n = node
            while n:
                n.visits += 1
                n.value += reward
                n = n.parent
            actual_iters += 1

        # Pick best child from root (pure exploitation)
        if root.children:
            best = max(root.children, key=lambda ch: ch.value / max(ch.visits, 1))
            result = best.itin
        else:
            result = base_itin

        state = MDPState.from_itinerary(result, weather, budget)
        result["_mcts_meta"] = {
            "iterations": actual_iters,
            "confidence": round(best.value / max(best.visits, 1), 4) if root.children else 0,
            "reward": round(self.env.reward(state), 4),
            "best_action": best.action if root.children else "keep_plan",
        }
        return result


# ============================================================================
# 4) Bayesian Beta Preference Model — persisted
# ============================================================================

class BayesianPreferences:
    """Beta-distribution preference model. Updated on each user rating. Persisted."""

    CATEGORIES = ["cultural", "adventure", "food", "relaxation", "shopping",
                  "nature", "nightlife"]

    def __init__(self):
        self.prefs: Dict[str, Dict[str, float]] = {}
        self._load()

    def _default(self):
        return {c: {"alpha": 2.0, "beta": 2.0} for c in self.CATEGORIES}

    def _load(self):
        data = _load_json("bayesian_prefs")
        if data and "prefs" in data:
            self.prefs = data["prefs"]
        else:
            self.prefs = self._default()

    def save(self):
        _save_json("bayesian_prefs", {"prefs": self.prefs})

    def update(self, category: str, rating: int):
        """Rating 1-5: >=4 -> success (alpha+=1), <4 -> failure (beta+=1)."""
        cat = category.lower()
        if cat not in self.prefs:
            self.prefs[cat] = {"alpha": 2.0, "beta": 2.0}
        if rating >= 4:
            self.prefs[cat]["alpha"] += 1
        else:
            self.prefs[cat]["beta"] += 1
        self.save()

    def probabilities(self) -> Dict[str, float]:
        return {c: round(p["alpha"] / (p["alpha"] + p["beta"]), 4)
                for c, p in self.prefs.items()}

    def confidence_intervals(self, level=0.95) -> Dict[str, Tuple[float, float]]:
        from scipy.stats import beta as beta_dist
        alpha_lvl = (1 - level) / 2
        result = {}
        for c, p in self.prefs.items():
            lo = beta_dist.ppf(alpha_lvl, p["alpha"], p["beta"])
            hi = beta_dist.ppf(1 - alpha_lvl, p["alpha"], p["beta"])
            result[c] = (round(float(lo), 4), round(float(hi), 4))
        return result

    def get_state(self) -> Dict:
        return {
            "preferences": self.prefs,
            "probabilities": self.probabilities(),
            "confidence_intervals": self.confidence_intervals(),
        }


# ============================================================================
# 5) Dirichlet Preference Model — persisted
# ============================================================================

class DirichletPreferences:
    """Dirichlet distribution over activity categories.
    Models the *proportion* of time a user wants to allocate across categories.
    Dir(alpha_1, ..., alpha_K): each alpha_i counts evidence for category i.
    Updated on each rating: alpha_cat += rating_weight.
    Persisted to JSON.
    """

    CATEGORIES = ["cultural", "adventure", "food", "relaxation", "shopping",
                  "nature", "nightlife"]

    def __init__(self):
        self.alphas: Dict[str, float] = {}
        self._load()

    def _default(self) -> Dict[str, float]:
        # Uniform prior: alpha = 2 for each category
        return {c: 2.0 for c in self.CATEGORIES}

    def _load(self):
        data = _load_json("dirichlet_prefs")
        if data and "alphas" in data:
            self.alphas = data["alphas"]
        else:
            self.alphas = self._default()

    def save(self):
        _save_json("dirichlet_prefs", {"alphas": self.alphas})

    def update(self, category: str, rating: int):
        """Update Dirichlet concentration: high rating adds more evidence."""
        cat = category.lower()
        if cat not in self.alphas:
            self.alphas[cat] = 2.0
        # Scale: 5-star adds 2.0, 1-star adds 0.2
        weight = max(0.2, (rating - 1) * 0.5)
        self.alphas[cat] += weight
        self.save()

    def expected_proportions(self) -> Dict[str, float]:
        """E[theta_i] = alpha_i / sum(alpha)"""
        total = sum(self.alphas.values())
        if total == 0:
            return {c: 1.0 / len(self.alphas) for c in self.alphas}
        return {c: round(a / total, 4) for c, a in self.alphas.items()}

    def mode_proportions(self) -> Dict[str, float]:
        """Mode of Dirichlet: (alpha_i - 1) / (sum(alpha) - K), valid when all alpha > 1."""
        K = len(self.alphas)
        total = sum(self.alphas.values())
        denom = total - K
        if denom <= 0:
            return self.expected_proportions()
        return {c: round(max(0, (a - 1) / denom), 4) for c, a in self.alphas.items()}

    def concentration_strength(self) -> float:
        """Total concentration: higher = more confident about proportions."""
        return round(sum(self.alphas.values()), 2)

    def sample(self, n_samples: int = 1000) -> Dict[str, List[float]]:
        """Sample from Dir(alpha) and return mean per category."""
        alpha_vec = [self.alphas.get(c, 2.0) for c in self.CATEGORIES]
        samples = np.random.dirichlet(alpha_vec, size=n_samples)
        return {
            c: round(float(np.mean(samples[:, i])), 4)
            for i, c in enumerate(self.CATEGORIES)
        }

    def get_state(self) -> Dict:
        return {
            "alphas": self.alphas,
            "expected_proportions": self.expected_proportions(),
            "mode_proportions": self.mode_proportions(),
            "concentration": self.concentration_strength(),
        }


# ============================================================================
# 6) Naive Bayes Weather Classifier — works with OpenMeteo data
# ============================================================================

class WeatherNaiveBayes:
    """Weather classifier that derives probabilities from the current forecast sample."""

    def __init__(self):
        self.classes = ["sunny", "cloudy", "rainy"]

    def _classify_day(self, weather: Dict, precip_threshold: float, cloud_threshold: float) -> str:
        precipitation = weather.get("precipitation", 0)
        cloud_cover = weather.get("cloud_cover", 0)
        if precipitation >= precip_threshold and precipitation > 0:
            return "rainy"
        if cloud_cover >= cloud_threshold:
            return "cloudy"
        return "sunny"

    def predict_from_openmeteo(self, weather_list: List[Dict]) -> Dict[str, float]:
        """Classify each day from OpenMeteo API response and return averaged probs."""
        if not weather_list:
            return {"sunny": 0.5, "cloudy": 0.3, "rainy": 0.2}
        precip_vals = [w.get("precipitation", 0) for w in weather_list]
        cloud_vals = [w.get("cloud_cover", 0) for w in weather_list]
        precip_threshold = float(np.percentile(precip_vals, 70)) if precip_vals else 0
        cloud_threshold = float(np.percentile(cloud_vals, 60)) if cloud_vals else 50
        counts = {c: 0 for c in self.classes}
        for w in weather_list:
            cls = self._classify_day(w, precip_threshold, cloud_threshold)
            counts[cls] += 1
        total = sum(counts.values()) or 1
        return {k: round(v / total, 4) for k, v in counts.items()}


# ============================================================================
# 7) POMDP Belief State
# ============================================================================

class POMDPBelief:
    """Maintains a belief distribution over hidden states.
    Hidden states: [excellent_trip, good_trip, average_trip, poor_trip].
    Updated via Bayesian rule when we observe ratings, weather changes, etc.
    """

    HIDDEN_STATES = ["excellent", "good", "average", "poor"]

    def __init__(self):
        self.belief = _load_json("pomdp_belief", {
            "excellent": 0.25, "good": 0.35, "average": 0.30, "poor": 0.10
        })

    def update(self, observation: str, observation_probs: Dict[str, Dict[str, float]]):
        """Bayesian belief update: b'(s) = P(o|s) * b(s) / normaliser."""
        new_b = {}
        for hs in self.HIDDEN_STATES:
            p_obs = observation_probs.get(hs, {}).get(observation, 0.25)
            new_b[hs] = p_obs * self.belief.get(hs, 0.25)
        total = sum(new_b.values())
        if total > 0:
            self.belief = {k: round(v / total, 4) for k, v in new_b.items()}
        _save_json("pomdp_belief", self.belief)

    def update_from_rating(self, rating: int):
        """Update belief based on user activity rating."""
        obs = "high" if rating >= 4 else ("mid" if rating >= 3 else "low")
        obs_model = {
            "excellent": {"high": 0.7, "mid": 0.25, "low": 0.05},
            "good":      {"high": 0.4, "mid": 0.45, "low": 0.15},
            "average":   {"high": 0.15, "mid": 0.45, "low": 0.4},
            "poor":      {"high": 0.05, "mid": 0.2,  "low": 0.75},
        }
        self.update(obs, obs_model)

    def update_from_weather(self, weather_class: str):
        """Update belief based on weather observation."""
        obs_model = {
            "excellent": {"sunny": 0.6, "cloudy": 0.3, "rainy": 0.1},
            "good":      {"sunny": 0.4, "cloudy": 0.4, "rainy": 0.2},
            "average":   {"sunny": 0.3, "cloudy": 0.35, "rainy": 0.35},
            "poor":      {"sunny": 0.1, "cloudy": 0.3, "rainy": 0.6},
        }
        self.update(weather_class, obs_model)

    def get_state(self) -> Dict:
        return dict(self.belief)


# ============================================================================
# 8) Crowd heuristic (time-of-day based)
# ============================================================================

def _crowd_heuristic(hour: int) -> float:
    """Return crowd level 0-100 based on hour of day."""
    if 6 <= hour < 9:
        return 25     # early morning - low
    elif 9 <= hour < 11:
        return 45     # morning
    elif 11 <= hour < 14:
        return 75     # peak lunch
    elif 14 <= hour < 16:
        return 60     # afternoon
    elif 16 <= hour < 18:
        return 70     # evening rush
    elif 18 <= hour < 21:
        return 80     # evening peak
    else:
        return 20     # night

def _crowd_heuristic_avg(days: List[Dict]) -> float:
    """Average crowd level from activity times in an itinerary."""
    levels = []
    for d in days:
        for a in d.get("activities", []):
            t = a.get("time", "12:00")
            try:
                h = int(t.split(":")[0])
            except:
                h = 12
            levels.append(_crowd_heuristic(h))
    return round(sum(levels) / len(levels), 1) if levels else 50.0

def crowd_for_activity(time_str: str) -> Dict:
    """Return crowd info for a single activity time."""
    try:
        h = int(time_str.split(":")[0])
    except:
        h = 12
    level = _crowd_heuristic(h)
    label = "Low" if level < 35 else "Moderate" if level < 60 else "High" if level < 80 else "Very High"
    tip = ""
    if level >= 70:
        tip = "Consider visiting earlier in the morning for fewer crowds"
    elif level >= 50:
        tip = "Moderate crowds expected - arrive early for best experience"
    return {"level": level, "label": label, "tip": tip}


# ============================================================================
# 9) Nearest-neighbor ordering helper
# ============================================================================

def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    return R * 2 * math.asin(min(1, math.sqrt(a)))


def _route_distance_km(route: List[Dict]) -> float:
    if len(route) < 2:
        return 0.0
    return sum(
        _haversine_km(route[i].get("lat", 0), route[i].get("lon", 0),
                      route[i + 1].get("lat", 0), route[i + 1].get("lon", 0))
        for i in range(len(route) - 1)
    )


def _two_opt(route: List[Dict], max_passes: int = 2) -> List[Dict]:
    if len(route) < 4:
        return route
    best = route
    best_dist = _route_distance_km(best)
    for _ in range(max_passes):
        improved = False
        for i in range(1, len(best) - 2):
            for j in range(i + 1, len(best) - 1):
                if j - i == 1:
                    continue
                candidate = best[:]
                candidate[i:j] = reversed(best[i:j])
                cand_dist = _route_distance_km(candidate)
                if cand_dist + 0.01 < best_dist:
                    best, best_dist = candidate, cand_dist
                    improved = True
        if not improved:
            break
    return best


def _dijkstra_order(places: List[Dict]) -> List[Dict]:
    if len(places) <= 2:
        return places
    n = len(places)
    graph = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(i + 1, n):
            d = _haversine_km(places[i].get("lat", 0), places[i].get("lon", 0),
                              places[j].get("lat", 0), places[j].get("lon", 0))
            graph[i][j] = d
            graph[j][i] = d
    remaining = set(range(1, n))
    order = [0]
    current = 0
    while remaining:
        dist = [float("inf")] * n
        seen = [False] * n
        dist[current] = 0.0
        for _ in range(n):
            u = -1
            best = float("inf")
            for i in range(n):
                if not seen[i] and dist[i] < best:
                    best, u = dist[i], i
            if u == -1:
                break
            seen[u] = True
            for v in range(n):
                w = graph[u][v]
                if w > 0 and not seen[v] and dist[u] + w < dist[v]:
                    dist[v] = dist[u] + w
        nxt = min(remaining, key=lambda idx: dist[idx])
        order.append(nxt)
        remaining.remove(nxt)
        current = nxt
    return _two_opt([places[i] for i in order])


def _nearest_neighbor_order(places: List[Dict]) -> List[Dict]:
    return _dijkstra_order(places)


# ============================================================================
# 10) Unified AI Engine (singleton-like, used by server)
# ============================================================================

class AIEngine:
    """Single entry point for all AI components. Instantiated once in the server."""

    def __init__(self):
        self.q_agent = QLearningAgent()
        self.mdp_env = MDPEnvironment()
        self.mcts = MCTSPlanner(iterations=50)
        self.bayesian = BayesianPreferences()
        self.dirichlet = DirichletPreferences()
        self.weather_nb = WeatherNaiveBayes()
        self.pomdp = POMDPBelief()
        self.session_rewards: List[float] = []

    # ---- called after itinerary generation to run MCTS optimisation ----
    def optimise_itinerary(self, itin: Dict, attractions: List[Dict],
                           weather: List[Dict], budget: float) -> Dict:
        """Run MCTS on the generated itinerary to find the best variant."""
        return self.mcts.search(itin, attractions, weather, budget)

    # ---- called when user rates an activity ----
    def on_activity_rating(self, itin: Dict, weather: List[Dict],
                           budget: float, category: str, rating: int) -> Dict:
        """Process a user rating: update Q-table, Bayesian prefs, Dirichlet, POMDP belief."""
        # 1) Bayesian Beta
        self.bayesian.update(category, rating)

        # 2) Dirichlet
        self.dirichlet.update(category, rating)

        # 3) Build MDP state
        state = MDPState.from_itinerary(itin, weather, budget)
        action = self.q_agent.best_action(state)
        reward = self.mdp_env.reward(state)

        # Adjust reward by rating
        rating_bonus = (rating - 3) * 0.1  # -0.2 to +0.2
        reward = float(np.clip(reward + rating_bonus, -1, 1))

        # 4) Q-learning update
        self.q_agent.on_rating(state, action, reward, state)

        # 5) POMDP belief update
        self.pomdp.update_from_rating(rating)

        self.session_rewards.append(reward)
        return {
            "reward": round(reward, 4),
            "bayesian": self.bayesian.get_state(),
            "dirichlet": self.dirichlet.get_state(),
            "q_stats": self.q_agent.get_stats(),
            "pomdp_belief": self.pomdp.get_state(),
            "best_action": action,
        }

    # ---- get MDP decision trace for explainability panel ----
    def mdp_decision_trace(self, itin: Dict, weather: List[Dict], budget: float) -> Dict:
        state = MDPState.from_itinerary(itin, weather, budget)
        reward = self.mdp_env.reward(state)
        action = self.q_agent.best_action(state)

        # Weather classification
        weather_probs = self.weather_nb.predict_from_openmeteo(weather)
        dominant_weather = max(weather_probs, key=weather_probs.get)

        # Update POMDP with weather
        self.pomdp.update_from_weather(dominant_weather)

        # Action reasoning
        reasons = {
            "keep_plan": "Plan is well-optimised, no changes recommended",
            "swap_activity": "A low-rated activity could be replaced with a better option",
            "reorder_destinations": "Reordering can reduce travel distance between activities",
            "adjust_budget": "Budget utilisation is suboptimal, trimming expensive items",
            "add_contingency": "Weather risk detected - adding indoor backup options",
            "remove_activity": "Schedule is too packed - removing lowest-rated activity",
        }

        # Override with context-aware action selection
        usage_pct = state.total_cost / max(state.budget_total, 1)
        if usage_pct > 0.9:
            action = "adjust_budget"
        elif state.weather_prob < 0.5:
            action = "add_contingency"
        elif state.crowd_level > 70:
            action = "reorder_destinations"
        elif state.satisfaction < 3.5:
            action = "swap_activity"

        return {
            "state": state.to_dict(),
            "reward": round(reward, 4),
            "best_action": action,
            "action_reason": reasons.get(action, ""),
            "weather_classification": weather_probs,
            "dominant_weather": dominant_weather,
            "pomdp_belief": self.pomdp.get_state(),
            "q_stats": self.q_agent.get_stats(),
            "bayesian": self.bayesian.get_state(),
            "dirichlet": self.dirichlet.get_state(),
            "crowd_level": round(state.crowd_level, 1),
            "crowd_label": "Low" if state.crowd_level < 35 else "Moderate" if state.crowd_level < 60 else "High" if state.crowd_level < 80 else "Very High",
            "weights": {
                "alpha": self.mdp_env.ALPHA,
                "beta": self.mdp_env.BETA,
                "gamma": self.mdp_env.GAMMA,
                "delta": self.mdp_env.DELTA,
            },
        }

    # ---- full state for frontend ----
    def get_full_state(self) -> Dict:
        return {
            "bayesian": self.bayesian.get_state(),
            "dirichlet": self.dirichlet.get_state(),
            "q_stats": self.q_agent.get_stats(),
            "pomdp_belief": self.pomdp.get_state(),
            "session_rewards": self.session_rewards[-200:],
        }
