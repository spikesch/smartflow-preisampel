"""Diagnose herunterladen: alles, was fuer einen Fehlerbericht noetig ist.

Einstellungen > Geraete & Dienste > SmartFlow Preisampel > Menue > Diagnose
herunterladen. Enthalten sind Versionen, die gefundenen BSFAI-Regler mit ihren
Werten, Akkudaten, Selbsttest, eine Zusammenfassung der Preisdaten und die
letzten Fehler/Hinweise. Keine Preisreihen, keine Zugangsdaten.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import __version__ as HA_VERSION
from homeassistant.core import HomeAssistant

from . import bsfai
from .const import DOMAIN

# Grosse Reihen der Leiter - nur ihre Laenge kommt in die Diagnose
SERIES = ("p", "valley", "peak", "effective")


def _manifest_version() -> str | None:
    try:
        return json.loads((Path(__file__).parent / "manifest.json").read_text("utf-8")).get("version")
    except Exception:  # noqa: BLE001
        return None


async def async_get_config_entry_diagnostics(hass: HomeAssistant, entry: ConfigEntry) -> dict[str, Any]:
    coordinator = getattr(entry, "runtime_data", None) or hass.data.get(DOMAIN, {}).get(entry.entry_id)
    version = await hass.async_add_executor_job(_manifest_version)
    out: dict[str, Any] = {
        "preisampel_version": version,
        "home_assistant_version": HA_VERSION,
        "config_entry_state": str(entry.state),
        "bsfai_entry_id": entry.data.get("bsfai_entry_id"),
    }
    try:
        bsfai.coordinator(hass, entry.data.get("bsfai_entry_id"))
        out["bsfai_running"] = True
    except Exception as err:  # noqa: BLE001
        out["bsfai_running"] = f"nein: {type(err).__name__}"
    if coordinator is None:
        out["hinweis"] = "Kein Coordinator - die Integration wurde noch nicht gestartet."
        return out

    data = coordinator.data or {}
    ladder = dict(data.get("ladder") or {})
    for key in SERIES:
        if key in ladder:
            ladder[key] = f"{len(ladder[key])} Werte"
    cls = ladder.get("cls") or ""
    ladder["cls"] = {k: cls.count(k) for k in "blmhpx"}

    entities = {}
    for key, entity_id in (data.get("entities") or {}).items():
        state = hass.states.get(entity_id) if entity_id else None
        entities[key] = {
            "entity_id": entity_id,
            "state": state.state if state else None,
            "unit": state.attributes.get("unit_of_measurement") if state else None,
        }

    out.update({
        "bsfai_version": data.get("bsfai_version"),
        "last_update_success": coordinator.last_update_success,
        "last_exception": repr(coordinator.last_exception) if coordinator.last_exception else None,
        "letzter_abruf": coordinator.last_info,
        "selbsttest": data.get("selftest"),
        "bsfai_entities": entities,
        "leiter": ladder,
        "ereignisse": list(coordinator.events),
    })
    return out
