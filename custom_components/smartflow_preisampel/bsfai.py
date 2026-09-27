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

    return BsfaiReading(
        points=points,
        settings=settings,
        currency=getattr(currency, "code", str(currency)),
        version=_version(),
        live=live,
        entities=entity_ids(hass, entry_id, coord),
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
