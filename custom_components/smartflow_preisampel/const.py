"""Konstanten der SmartFlow Preisampel."""

DOMAIN = "smartflow_preisampel"
BSFAI_DOMAIN = "battery_smartflow_ai"

CONF_BSFAI_ENTRY = "bsfai_entry_id"

CARD_FILENAME = "smartflow-preisampel-card.js"
STATIC_URL = f"/{DOMAIN}"

# Reihenfolge = Rangfolge der Einstufung im Chart (sehr billig ... sehr teuer).
CLASSES = ("b", "l", "m", "h", "p", "x")

# BSFAI-Regler, die die Karte simuliert und uebernehmen kann.
# Schluessel = BSFAI-Setting-Key (unique_id-Suffix der number-Entity).
REGULATOR_KEYS = (
    "valley_factor",
    "peak_factor",
    "profit_margin_pct",
    "very_cheap_price",
    "very_expensive_threshold",
)

# BSFAI-Sensoren, deren Historie der Verlaufsbalken braucht.
STATUS_SENSOR_KEYS = ("ai_status", "decision_reason")

# BSFAI-Defaults (const.py 5.1.2) als letzte Rueckfallebene.
DEFAULT_VALLEY_FACTOR = 0.85
DEFAULT_PEAK_FACTOR = 1.35
DEFAULT_PROFIT_MARGIN_PCT = 27.0
