"""Rechnet die Preisleiter, sobald BSFAI neue Werte hat."""

from __future__ import annotations

import logging
from datetime import timedelta
from typing import Any

from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from . import bsfai
from .const import DOMAIN
from .ladder import ladder, split_slots

_LOGGER = logging.getLogger(__name__)

# Toleranz des Selbsttests: BSFAI rundet seine Sensoren nicht, wir runden auf
# 5 Stellen - alles darueber ist eine echte Abweichung der Formel.
SELFTEST_TOLERANCE = 0.0005


class PreisampelCoordinator(DataUpdateCoordinator[dict[str, Any]]):
    def __init__(self, hass: HomeAssistant, bsfai_entry_id: str) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            # Rueckfallebene; im Normalfall stoesst BSFAI jede Aktualisierung an.
            update_interval=timedelta(minutes=5),
        )
        self.bsfai_entry_id = bsfai_entry_id
        self._bsfai_coord: Any = None
        self._unsub_bsfai: CALLBACK_TYPE | None = None

    @callback
    def _follow_bsfai(self) -> None:
        """An den BSFAI-Coordinator haengen. Nach einem Reload von BSFAI ist das
        ein neues Objekt - dann neu anmelden."""
        try:
            coord = bsfai.coordinator(self.hass, self.bsfai_entry_id)
        except bsfai.BsfaiNotRunning:
            return
        if coord is self._bsfai_coord:
            return
        self.detach()
        self._bsfai_coord = coord
        self._unsub_bsfai = coord.async_add_listener(self._bsfai_updated)

    @callback
    def _bsfai_updated(self) -> None:
        self.hass.async_create_task(self.async_request_refresh())

    @callback
    def detach(self) -> None:
        if self._unsub_bsfai is not None:
            self._unsub_bsfai()
            self._unsub_bsfai = None
        self._bsfai_coord = None

    async def _async_update_data(self) -> dict[str, Any]:
        self._follow_bsfai()
        now = dt_util.now()
        try:
            reading = bsfai.read(self.hass, self.bsfai_entry_id, now)
        except bsfai.BsfaiNotRunning as err:
            raise UpdateFailed("Battery SmartFlow AI läuft nicht") from err
        except bsfai.BsfaiIncompatible as err:
            raise UpdateFailed(f"Battery SmartFlow AI nicht kompatibel: {err}") from err

        slots = split_slots(reading.points)
        result = ladder(slots, reading.settings, now)
        s = reading.settings
        result.update({
            "currency": reading.currency,
            "valley_factor": s.valley_factor,
            "peak_factor": s.peak_factor,
            "margin_pct": s.margin_pct,
            "very_cheap": s.very_cheap,
            "very_expensive": s.very_expensive,
            "expensive_threshold": s.expensive_threshold,
            "avg_charge_price": s.avg_charge_price,
            "feed_in": s.feed_in,
            "efficiency": reading.efficiency,
        })
        return {
            "ladder": result,
            "entities": reading.entities,
            "bsfai_version": reading.version,
            "selftest": selftest(result, reading.live),
        }


def selftest(result: dict, live: dict[str, float | None]) -> dict:
    """Unsere Schwellen im Jetzt-Slot gegen die Live-Sensoren von BSFAI.

    Stimmen sie nicht, rechnet diese BSFAI-Version anders als die Ampel - dann
    sind die Farben nicht vertrauenswuerdig, und die Karte sagt das.
    """
    index = result.get("now_index")
    if index is None:
        return {"status": "no_now_slot"}
    compare = {}
    ok = True
    for key, series in (("valley", "valley"), ("peak", "peak"), ("effective", "effective")):
        ours = result[series][index]
        theirs = live.get(key)
        if theirs is None:
            compare[key] = {"ours": ours, "bsfai": None}
            continue
        match = abs(ours - theirs) <= SELFTEST_TOLERANCE
        ok = ok and match
        compare[key] = {"ours": ours, "bsfai": round(theirs, 5), "ok": match}
    return {"status": "ok" if ok else "mismatch", "values": compare}
