"""Ein Sensor: aktuelle Preisstufe, die ganze Leiter haengt als Attribut dran."""

from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import CLASSES, DOMAIN
from .coordinator import PreisampelCoordinator


async def async_setup_entry(
    hass: HomeAssistant, entry: ConfigEntry, add_entities: AddEntitiesCallback
) -> None:
    add_entities([PreisampelSensor(entry.runtime_data, entry)])


class PreisampelSensor(CoordinatorEntity[PreisampelCoordinator], SensorEntity):
    _attr_has_entity_name = True
    _attr_translation_key = "preisstufe"
    _attr_device_class = SensorDeviceClass.ENUM
    _attr_options = list(CLASSES)
    _attr_icon = "mdi:traffic-light"
    # Die Leiter ist gross (192 Slots x 5 Reihen) und aendert sich laufend. Im
    # Recorder waere sie nutzlos und wuerde ab 16 KB ohnehin still verworfen.
    _unrecorded_attributes = frozenset({"ladder", "entities", "selftest", "bsfai_version"})

    def __init__(self, coordinator: PreisampelCoordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator)
        self._attr_unique_id = f"{entry.entry_id}_preisstufe"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.title,
            manufacturer="SmartFlow Preisampel",
            entry_type=DeviceEntryType.SERVICE,
        )

    @property
    def native_value(self) -> str | None:
        data = self.coordinator.data or {}
        result = data.get("ladder") or {}
        index = result.get("now_index")
        if index is None:
            return None
        return result["cls"][index]

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        data = self.coordinator.data or {}
        return {
            "ladder": data.get("ladder"),
            "entities": data.get("entities"),
            "selftest": data.get("selftest"),
            "bsfai_version": data.get("bsfai_version"),
        }
