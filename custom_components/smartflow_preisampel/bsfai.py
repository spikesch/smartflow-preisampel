"""Zugriff auf eine laufende Battery-SmartFlow-AI-Instanz.

Einzige Stelle, die BSFAI-Interna anfasst. Preise, Regler, Durchschnitts-
Ladepreis und Einspeisepreis kommen direkt aus dem BSFAI-Coordinator - damit
rechnet die Ampel mit genau den Werten, mit denen BSFAI entscheidet, egal
welcher Stromanbieter dahinter steckt. Baut eine kuenftige BSFAI-Version etwas
um, meldet BsfaiIncompatible klar, WAS fehlt, statt still falsch zu rechnen.
"""

from __future__ import annotations

import importlib
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er

from .const import (
    BSFAI_DOMAIN,
    DEFAULT_PEAK_FACTOR,
    DEFAULT_PROFIT_MARGIN_PCT,
    DEFAULT_VALLEY_FACTOR,
    REGULATOR_KEYS,
    STATUS_SENSOR_KEYS,
)
from .ladder import Settings

_LOGGER = logging.getLogger(__name__)


class BsfaiNotRunning(Exception):
    """BSFAI ist nicht geladen (noch im Start, deaktiviert oder entfernt)."""


class BsfaiIncompatible(Exception):
    """Diese BSFAI-Version passt nicht zu dem, was die Ampel erwartet."""


@dataclass
class BsfaiReading:
    points: list[tuple[datetime, datetime, float]]
    settings: Settings
    currency: str
    version: str | None
    live: dict[str, float | None]
    entities: dict[str, str | None] = field(default_factory=dict)
    efficiency: float | None = None
    battery: dict[str, float | None] | None = None


# Unter dieser Lademenge haengt das Verhaeltnis Entladen/Laden noch stark vom
# Ladestand beim Start ab - dann lieber gar keine Verlustkorrektur.
MIN_EFFICIENCY_KWH = 20.0


# Akku-Regler fuer die Ersparnis-Schaetzung: Schluessel in der Leiter -> BSFAI-Setting-Key
BATTERY_SETTINGS = {
    "soc_min": "soc_min",
    "soc_max": "soc_max",
    "max_charge_w": "max_charge",
    "max_discharge_w": "max_discharge",
    "base_load_w": "forecast_base_load",
}


def _setting_value(hass: HomeAssistant, entry_id: str, coord: Any, key: str) -> float | None:
    """Wert eines BSFAI-Reglers, wie BSFAI ihn anzeigt.

    Zuerst die number-Entity: sie zeigt auch BSFAIs Standardwert, wenn der
    Nutzer den Regler nie verstellt hat. NICHT _get_setting(key, None) - fehlt
    der Schluessel in den Optionen, ruft BSFAI float(None) auf und wirft.
    """
    entity_id = er.async_get(hass).async_get_entity_id("number", BSFAI_DOMAIN, f"{entry_id}_{key}")
    state = hass.states.get(entity_id) if entity_id else None
    value = _float(state.state, None) if state else None
    if value is not None:
        return value
    runtime = getattr(coord, "runtime_settings", None) or {}
    value = _float(runtime.get(key), None)
    if value is not None:
        return value
    options = getattr(getattr(coord, "entry", None), "options", None) or {}
    return _float(options.get(key), None)


def _battery(hass: HomeAssistant, entry_id: str, coord: Any,
             soc_entity: str | None) -> dict[str, float | None] | None:
    """Akkugroesse, Grenzen und Leistungen fuer Ersparnis in Euro und Optimieren.

    Rein optional: was hier schiefgeht, darf die Integration nicht aufhalten -
    dann zeigt die Karte nur keinen Euro-Betrag und kann nicht optimieren.
    """
    try:
        capacity = float(coord._get_battery_capacity())
        if not capacity > 0.0:
            return None
        state = hass.states.get(soc_entity) if soc_entity else None
        result: dict[str, float | None] = {
            "capacity_kwh": capacity,
            "soc": _float(state.state, None) if state else None,
        }
        for name, key in BATTERY_SETTINGS.items():
            result[name] = _setting_value(hass, entry_id, coord, key)
        return result
    except Exception as err:  # noqa: BLE001
        _LOGGER.debug("Akkudaten von BSFAI nicht lesbar: %s", err)
        return None


def _efficiency(economics: Any) -> float | None:
    """Gemessener Wirkungsgrad seit Start: kWh aus dem Akku / kWh hinein.

    Aus BSFAIs Kostenbuch (EconomicsEngine._total, intern). Naeherung: was der
    Akku ins Netz statt ins Haus abgibt, zaehlt BSFAI dort nicht als Entladung.
    """
    totals = getattr(economics, "_total", None)
    try:
        charged = float(totals.grid_charge_kwh) + float(totals.pv_charge_kwh)
        discharged = float(totals.battery_discharge_kwh)
    except Exception:  # noqa: BLE001
        return None
    if charged < MIN_EFFICIENCY_KWH or discharged <= 0.0:
        return None
    ratio = discharged / charged
    return ratio if 0.5 <= ratio <= 1.0 else None


def coordinator(hass: HomeAssistant, entry_id: str) -> Any:
    coord = hass.data.get(BSFAI_DOMAIN, {}).get(entry_id)
    if coord is None:
        raise BsfaiNotRunning(entry_id)
    return coord


def _float(value: Any, default: float | None) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _require(obj: Any, name: str) -> Any:
    if not hasattr(obj, name):
        raise BsfaiIncompatible(f"BSFAI-Coordinator hat kein '{name}'")
    return getattr(obj, name)


def _price_profile(currency: Any) -> Any:
    try:
        module = importlib.import_module(f"custom_components.{BSFAI_DOMAIN}.price_currency")
        return module.price_input_profile(currency)
    except Exception as err:  # noqa: BLE001
        raise BsfaiIncompatible(f"price_currency.price_input_profile: {err}") from err


def read(hass: HomeAssistant, entry_id: str, now: datetime) -> BsfaiReading:
    coord = coordinator(hass, entry_id)

    import_price = _require(coord, "_get_import_market_price")(now)
    forecast = getattr(import_price, "forecast", None)
    points = []
    for point in getattr(forecast, "points", None) or ():
        try:
            points.append((point.start, point.end, float(point.price)))
        except (AttributeError, TypeError, ValueError) as err:
            raise BsfaiIncompatible(f"Preispunkt unlesbar: {err}") from err

    runtime = _require(coord, "runtime_settings")
    get_setting = _require(coord, "_get_setting")
    currency = _require(coord, "price_currency")
    profile = _price_profile(currency)

    very_cheap = runtime.get("very_cheap_price")
    avg_charge = None
    economics = getattr(coord, "_economics_engine", None)
    if economics is not None:
        try:
            avg_charge = economics.total_snapshot().average_battery_charge_price
        except Exception:  # noqa: BLE001
            avg_charge = None
    data = getattr(coord, "data", None) or {}
    if avg_charge is None:
        avg_charge = data.get("avg_charge_price")

    feed_in = None
    try:
        export_price = coord._get_export_market_price(now)
        if getattr(export_price, "valid", False):
            feed_in = _float(export_price.current_price, None)
    except Exception:  # noqa: BLE001
        feed_in = None

    settings = Settings(
        valley_factor=_float(runtime.get("valley_factor"), DEFAULT_VALLEY_FACTOR),
        peak_factor=_float(runtime.get("peak_factor"), DEFAULT_PEAK_FACTOR),
        margin_pct=_float(get_setting("profit_margin_pct", DEFAULT_PROFIT_MARGIN_PCT),
                          DEFAULT_PROFIT_MARGIN_PCT),
        very_cheap=_float(very_cheap, 0.0) or 0.0,
        very_expensive=_float(get_setting("very_expensive_threshold",
                                          profile.default_very_expensive_threshold), 0.0),
        expensive_threshold=_float(get_setting("price_threshold",
                                               profile.default_expensive_threshold), 0.0),
        avg_charge_price=_float(avg_charge, None),
        feed_in=feed_in,
    )

    live = {
        "valley": _float(data.get("current_valley_threshold"), None),
        "peak": _float(data.get("current_peak_threshold"), None),
        "effective": _float(data.get("effective_discharge_threshold"), None),
    }

    entities = entity_ids(hass, entry_id, coord)
    return BsfaiReading(
        points=points,
        settings=settings,
        currency=getattr(currency, "code", str(currency)),
        version=_version(),
        live=live,
        entities=entities,
        efficiency=_efficiency(economics),
        battery=_battery(hass, entry_id, coord, entities.get("soc")),
    )


def _version() -> str | None:
    try:
        return importlib.import_module(f"custom_components.{BSFAI_DOMAIN}.const").INTEGRATION_VERSION
    except Exception:  # noqa: BLE001
        return None


def entity_ids(hass: HomeAssistant, entry_id: str, coord: Any) -> dict[str, str | None]:
    """Regler und Statussensoren ueber ihre festen unique_ids finden - die
    entity_ids haengen von Sprache und Umbenennungen des Nutzers ab."""
    registry = er.async_get(hass)
    found: dict[str, str | None] = {}
    for key in REGULATOR_KEYS:
        found[key] = registry.async_get_entity_id("number", BSFAI_DOMAIN, f"{entry_id}_{key}")
    for key in STATUS_SENSOR_KEYS:
        found[key] = registry.async_get_entity_id(
            "sensor", BSFAI_DOMAIN, f"{BSFAI_DOMAIN}_{entry_id}_{key}")
    soc = getattr(getattr(coord, "entities", None), "soc", None)
    found["soc"] = soc if isinstance(soc, str) and soc else None
    return found
