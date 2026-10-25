"""Rechnet die Preisleiter, sobald BSFAI neue Werte hat."""

from __future__ import annotations

import logging
import traceback
from collections import deque
from datetime import timedelta
from typing import Any

from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from . import bsfai
from .const import DOMAIN
from .ladder import fill_gaps, ladder, split_slots

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
        # Fuer "Diagnose herunterladen": die letzten Fehler/Hinweise und der
        # Stand des letzten Abrufs - auch wenn die Einrichtung scheitert.
        self.events: deque[dict[str, str]] = deque(maxlen=30)
        self.last_info: dict[str, Any] = {}
        self._last_notes: list[str] = []
        self._last_selftest: str | None = None

    def note(self, level: int, message: str) -> None:
        """Ins HA-Protokoll schreiben und fuer die Diagnose merken."""
        _LOGGER.log(level, message)
        self.events.append({
            "time": dt_util.now().isoformat(timespec="seconds"),
            "level": logging.getLevelName(level),
            "message": message,
        })

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
        try:
            return self._update(dt_util.now())
        except UpdateFailed as err:
            self.note(logging.WARNING, str(err))
            raise
        except Exception as err:  # noqa: BLE001
            # Unerwartet: mit den letzten Zeilen des Tracebacks merken, damit
            # ein Fehlerbericht ohne HA-Protokoll auskommt.
            tail = " | ".join(line.strip() for line in traceback.format_exc().strip().splitlines()[-6:])
            self.note(logging.ERROR, f"Unerwarteter Fehler: {type(err).__name__}: {err} ({tail})")
            raise UpdateFailed(f"{type(err).__name__}: {err}") from err

    def _update(self, now: Any) -> dict[str, Any]:
        self._follow_bsfai()
        try:
            reading = bsfai.read(self.hass, self.bsfai_entry_id, now)
        except bsfai.BsfaiNotRunning as err:
            raise UpdateFailed("Battery SmartFlow AI läuft nicht") from err
        except bsfai.BsfaiIncompatible as err:
            raise UpdateFailed(f"Battery SmartFlow AI nicht kompatibel: {err}") from err

        raw = split_slots(reading.points, fill=False)
        slots = fill_gaps(raw)
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
            "battery": reading.battery,
        })
        check = selftest(result, reading.live)
        self._remember(reading, raw, slots, result, check, now)
        return {
            "ladder": result,
            "entities": reading.entities,
            "bsfai_version": reading.version,
            "selftest": check,
        }

    def _remember(self, reading: Any, raw: list, slots: list, result: dict, check: dict, now: Any) -> None:
        """Stand des Abrufs fuer die Diagnose; Hinweise und Selbsttest-Wechsel
        nur bei Aenderung protokollieren, sonst liefe das Protokoll voll."""
        self.last_info = {
            "time": now.isoformat(timespec="seconds"),
            "price_points_from_bsfai": len(reading.points),
            "slots": len(slots),
            "slots_filled": len(slots) - len(raw),
            "first_slot": slots[0][0].isoformat() if slots else None,
            "last_slot": slots[-1][0].isoformat() if slots else None,
            "now_index": result.get("now_index"),
            "selftest": check.get("status"),
            "efficiency": reading.efficiency,
            "battery_ok": reading.battery is not None,
            "notes": reading.notes,
        }
        _LOGGER.debug("Abruf: %s Preispunkte, %s Slots (%s aufgefuellt), jetzt=%s, Selbsttest=%s, Wirkungsgrad=%s, Akkudaten=%s",
                      len(reading.points), len(slots), len(slots) - len(raw), result.get("now_index"),
                      check.get("status"), reading.efficiency, "ok" if reading.battery else "fehlen")
        if reading.notes != self._last_notes:
            for message in reading.notes:
                self.note(logging.INFO, message)
            self._last_notes = list(reading.notes)
        if len(slots) != len(raw) and not any("aufgefuellt" in e["message"] for e in self.events):
            self.note(logging.INFO, f"{len(slots) - len(raw)} fehlende Viertelstunden aufgefuellt (z. B. Zeitumstellung)")
        status = check.get("status")
        if status != self._last_selftest:
            if status == "mismatch":
                self.note(logging.WARNING, f"Selbsttest: Schwellen weichen von BSFAI ab ({check.get('values')})")
            elif self._last_selftest == "mismatch":
                self.note(logging.INFO, "Selbsttest wieder in Ordnung")
            self._last_selftest = status


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
