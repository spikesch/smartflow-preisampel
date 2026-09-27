"""Einrichtung: laufende Battery-SmartFlow-AI-Instanz auswaehlen."""

from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntryState, ConfigFlow, ConfigFlowResult

from .const import BSFAI_DOMAIN, CONF_BSFAI_ENTRY, DOMAIN


class PreisampelConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None) -> ConfigFlowResult:
        entries = self.hass.config_entries.async_entries(BSFAI_DOMAIN)
        if not entries:
            return self.async_abort(reason="bsfai_missing")
        running = {e.entry_id: e.title for e in entries if e.state is ConfigEntryState.LOADED}
        if not running:
            return self.async_abort(reason="bsfai_not_running")

        if user_input is not None:
            entry_id = user_input[CONF_BSFAI_ENTRY]
            await self.async_set_unique_id(entry_id)
            self._abort_if_unique_id_configured()
            return self.async_create_entry(
                title=f"Preisampel {running[entry_id]}",
                data={CONF_BSFAI_ENTRY: entry_id},
            )

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_BSFAI_ENTRY, default=next(iter(running))): vol.In(running),
            }),
        )
