"""SmartFlow Preisampel: Visualisierung und Simulator fuer Battery SmartFlow AI."""

from __future__ import annotations

import json
from pathlib import Path

from aiohttp import web

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import HomeAssistantView
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import CARD_FILENAME, CONF_BSFAI_ENTRY, DOMAIN, STATIC_URL
from .coordinator import PreisampelCoordinator

PLATFORMS = [Platform.SENSOR]
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)

type PreisampelEntry = ConfigEntry[PreisampelCoordinator]


class CardView(HomeAssistantView):
    """Liefert die Karte mit "no-cache" aus.

    Ohne Cache-Header cached der Browser die Datei nach eigenem Ermessen weiter,
    auch nach einem Update - dann hilft nur noch Strg+F5 oder ein Cache-Reset
    der App. "no-cache" heisst: behalten ja, aber vor jeder Nutzung per ETag
    nachfragen. Eine neue Karte kommt damit beim naechsten normalen Laden an.
    """

    url = f"{STATIC_URL}/{CARD_FILENAME}"
    name = f"{DOMAIN}:card"
    requires_auth = False

    async def get(self, request: web.Request) -> web.FileResponse:
        path = Path(__file__).parent / "www" / CARD_FILENAME
        return web.FileResponse(path, headers={
            "Cache-Control": "no-cache",
            "Content-Type": "text/javascript; charset=utf-8",
        })


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Karte ausliefern und im Frontend laden - ohne dass der Nutzer eine
    Dashboard-Ressource von Hand anlegen muss."""
    hass.http.register_view(CardView())
    manifest = await hass.async_add_executor_job(
        (Path(__file__).parent / "manifest.json").read_text, "utf-8")
    version = json.loads(manifest).get("version", "0")
    add_extra_js_url(hass, f"{STATIC_URL}/{CARD_FILENAME}?v={version}")
    return True


async def async_setup_entry(hass: HomeAssistant, entry: PreisampelEntry) -> bool:
    coordinator = PreisampelCoordinator(hass, entry.data[CONF_BSFAI_ENTRY])
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator
    entry.async_on_unload(coordinator.detach)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: PreisampelEntry) -> bool:
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
