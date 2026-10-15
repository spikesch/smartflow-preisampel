"""Erzeugt snapshot.json fuer den Pruefstand aus der eigenen Home-Assistant-Instanz.

Liest den Sensor der Preisampel (fertig gerechnete Leiter), die Zustaende der
BSFAI-Regler und den Verlauf von KI-Status, Entscheidungsgrund und Ladestand.
Damit zeigt der Pruefstand genau das, was die Karte in HA zeigen wuerde - nur
ohne HA-Frontend, und die Uhr bleibt auf dem Moment der Aufnahme stehen.

Aufruf:
    HA_URL=http://homeassistant.local:8123 HA_TOKEN=... python tests/harness/make_snapshot.py

Optional PREISAMPEL_ENTITY=sensor....preisstufe, wenn es mehrere Preisampeln gibt.
snapshot.json enthaelt echte Preise und Entity-IDs und ist per .gitignore ausgeschlossen.
"""

import json
import os
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(__file__)
HA_URL = os.environ.get("HA_URL", "http://homeassistant.local:8123").rstrip("/")
TOKEN = os.environ["HA_TOKEN"]
# Unter diesem Namen erwartet index.html den Sensor.
HARNESS_ENTITY = "sensor.preisampel_preisstufe"


def get(path: str):
    req = urllib.request.Request(f"{HA_URL}{path}", headers={"Authorization": f"Bearer {TOKEN}"})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


states = {s["entity_id"]: s for s in get("/api/states")}

wanted = os.environ.get("PREISAMPEL_ENTITY")
candidates = [e for e, s in states.items()
              if e.startswith("sensor.") and "ladder" in s["attributes"]
              and "selftest" in s["attributes"] and "bsfai_version" in s["attributes"]]
if wanted:
    candidates = [e for e in candidates if e == wanted]
if len(candidates) != 1:
    raise SystemExit(f"Preisampel-Sensor nicht eindeutig gefunden: {candidates or 'keiner'}"
                     " - PREISAMPEL_ENTITY setzen.")
sensor = states[candidates[0]]
entities = sensor["attributes"].get("entities") or {}

snapshot_states = {HARNESS_ENTITY: {**sensor, "entity_id": HARNESS_ENTITY}}
for entity_id in entities.values():
    if entity_id and entity_id in states:
        snapshot_states[entity_id] = {"state": states[entity_id]["state"],
                                      "attributes": states[entity_id]["attributes"]}

# Verlauf ueber den Zeitraum der Leiter, im Format von history/history_during_period
# (minimal_response): je Entity eine Liste {"s": Zustand, "lu": Unix-Zeit}.
now = datetime.now(timezone.utc)
start = datetime.fromisoformat(sensor["attributes"]["ladder"]["start"]).astimezone(timezone.utc)
history_ids = [entities.get(k) for k in ("ai_status", "decision_reason", "soc") if entities.get(k)]
history = {entity_id: [] for entity_id in history_ids}
if history_ids:
    query = urllib.parse.urlencode({
        "filter_entity_id": ",".join(history_ids),
        "end_time": now.isoformat(),
        "minimal_response": "", "no_attributes": "",
    })
    stamp = urllib.parse.quote((start - timedelta(hours=1)).isoformat())
    for series in get(f"/api/history/period/{stamp}?{query}"):
        if not series:
            continue
        entity_id = series[0]["entity_id"]
        history[entity_id] = [{"s": point["state"],
                               "lu": datetime.fromisoformat(point["last_changed"]).timestamp()}
                              for point in series]

with open(os.path.join(HERE, "snapshot.json"), "w", encoding="utf-8") as f:
    json.dump({"states": snapshot_states, "history": history, "now": now.isoformat()}, f,
              ensure_ascii=False)
ladder = sensor["attributes"]["ladder"]
print(f"snapshot.json geschrieben aus {candidates[0]}: {ladder['n']} Slots, jetzt {ladder['now_index']},"
      f" Verlaufspunkte {sum(len(v) for v in history.values())}")
