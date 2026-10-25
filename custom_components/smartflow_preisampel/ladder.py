"""Preisleiter: Schwellen und Einstufung je 15-Minuten-Slot.

Reine Rechenlogik ohne Home-Assistant-Abhaengigkeit. Die Formeln entsprechen
Battery SmartFlow AI 5.1.2 (decision_engine._compute_*_threshold,
price_math.peak_threshold). Die Karte rechnet dieselben Formeln im Browser nach,
wenn der Simulator laeuft - wer hier etwas aendert, muss ladder() in der Karte
nachziehen.

Fuer jeden Slot gilt die Schwelle, die BSFAI zu diesem Zeitpunkt berechnet
haette: Basis ist das Mittel aller Slots AB diesem Slot (BSFAI verwirft
vergangene Slots in planning_price_points).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

SLOT = timedelta(minutes=15)


@dataclass(frozen=True)
class Settings:
    valley_factor: float
    peak_factor: float
    margin_pct: float
    very_cheap: float
    very_expensive: float
    expensive_threshold: float
    avg_charge_price: float | None
    feed_in: float | None


def split_slots(points: list[tuple[datetime, datetime, float]]) -> list[tuple[datetime, float]]:
    """Wie planning_price_points: laengere Intervalle in 15-min-Slots zerlegen,
    doppelte Intervalle nur einmal, angebrochene Reste am Ende verwerfen."""
    slots: list[tuple[datetime, float]] = []
    seen: set[datetime] = set()
    for start, end, price in sorted(points, key=lambda item: item[0]):
        cursor = start
        while cursor + SLOT <= end:
            if cursor not in seen:
                slots.append((cursor, float(price)))
                seen.add(cursor)
            cursor += SLOT
    slots.sort(key=lambda item: item[0])
    return fill_gaps(slots)


# Laengste Luecke, die aufgefuellt wird (4 h) - laengere Ausfaelle bleiben sichtbar.
MAX_GAP = timedelta(hours=4)


def fill_gaps(slots: list[tuple[datetime, float]]) -> list[tuple[datetime, float]]:
    """Fehlende Viertelstunden mit dem Preis davor auffuellen.

    Die Karte rechnet die Zeit jedes Slots als Start + Index x 15 min und
    braucht ein lueckenloses Raster. Am Tag der Zeitumstellung im Herbst
    liefert BSFAI die doppelte Stunde 02:00-03:00 nur einmal - ohne Auffuellen
    waere danach alles um eine Stunde verschoben.
    """
    out: list[tuple[datetime, float]] = []
    for start, price in slots:
        if out:
            last, last_price = out[-1]
            gap = start - last
            if SLOT < gap <= MAX_GAP:
                cursor = last + SLOT
                while cursor < start:
                    out.append((cursor, last_price))
                    cursor += SLOT
        out.append((start, price))
    return out


def peak_threshold(average: float, low: float, high: float, peak_factor: float) -> float:
    delta = max(0.0, peak_factor - 1.0)
    return average + max(abs(average) * delta, max(0.0, high - low) * 0.10)


def effective_threshold(valley: float, peak: float, s: Settings) -> float:
    margin = 1.0 + s.margin_pct / 100.0
    avg = s.avg_charge_price
    economic = avg * margin if (avg is not None and avg >= 0) else None
    avg_missing = avg is None or avg <= 0.0001

    market_anchor = max(valley, peak * 0.82)
    safety_floor = max(0.0, valley)
    if s.feed_in is not None:
        safety_floor = max(safety_floor, max(0.0, s.feed_in) * margin)
    anchor = max(0.0, s.expensive_threshold)
    mid = valley + max(0.0, market_anchor - valley) * 0.55
    dynamic = max(mid, anchor * 0.65 + market_anchor * 0.35) if anchor > 0 else mid
    fallback = min(max(safety_floor, dynamic), peak * 0.90)
    if economic is None or avg_missing:
        return fallback

    market_anchor = peak * 0.82
    effective = max(market_anchor * 0.70 + economic * 0.30, economic)
    valley_floor = valley + max(0.0, market_anchor - valley) * 0.35
    effective = max(effective, valley_floor)
    return max(valley_floor, min(effective, peak * 0.90))


def classify(price: float, valley: float, peak: float, effective: float, s: Settings) -> str:
    """Rangfolge wie in decision_engine: sehr billig vor Tal, sehr teuer vor Peak."""
    if s.very_cheap > 0 and price <= s.very_cheap:
        return "b"
    if price <= valley:
        return "l"
    if s.very_expensive > 0 and price >= s.very_expensive:
        return "x"
    if price >= peak:
        return "p"
    if price >= effective:
        return "h"
    return "m"


def ladder(slots: list[tuple[datetime, float]], s: Settings, now: datetime) -> dict:
    n = len(slots)
    if n == 0:
        return {"n": 0}

    prices = [price for _, price in slots]
    # Einmal rueckwaerts aufsummieren statt je Slot neu - sonst quadratisch.
    total, low, high = [0.0] * n, [0.0] * n, [0.0] * n
    for i in range(n - 1, -1, -1):
        nxt = i + 1 < n
        total[i] = prices[i] + (total[i + 1] if nxt else 0.0)
        low[i] = min(prices[i], low[i + 1]) if nxt else prices[i]
        high[i] = max(prices[i], high[i + 1]) if nxt else prices[i]

    valleys, peaks, effectives, classes = [], [], [], []
    now_index = None
    for i, (start, price) in enumerate(slots):
        base = total[i] / (n - i)
        valley = base * s.valley_factor
        peak = peak_threshold(base, low[i], high[i], s.peak_factor)
        effective = effective_threshold(valley, peak, s)
        valleys.append(round(valley, 5))
        peaks.append(round(peak, 5))
        effectives.append(round(effective, 5))
        classes.append(classify(price, valley, peak, effective, s))
        if start <= now < start + SLOT:
            now_index = i

    return {
        "start": slots[0][0].isoformat(),
        "step_min": 15,
        "n": n,
        "p": [round(price, 5) for price in prices],
        "valley": valleys,
        "peak": peaks,
        "effective": effectives,
        "cls": "".join(classes),
        "now_index": now_index,
    }
