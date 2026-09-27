"""SmartFlow Preisampel: Visualisierung und Simulator fuer Battery SmartFlow AI."""

from __future__ import annotations

import json
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
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


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Karte ausliefern und im Frontend laden - ohne dass der Nutzer eine
    Dashboard-Ressource von Hand anlegen muss."""
    www = Path(__file__).parent / "www"
    await hass.http.async_register_static_paths(
        [StaticPathConfig(STATIC_URL, str(www), cache_headers=False)]
    )
    # Versionsnummer in der URL, sonst behaelt der Browser nach einem Update
    # die alte Karte im Cache.
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
