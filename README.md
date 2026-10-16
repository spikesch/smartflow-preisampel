![SmartFlow Preisampel](https://raw.githubusercontent.com/spikesch/smartflow-preisampel/main/docs/logo/icon-128.png)

# SmartFlow Preisampel

**Deutsch** · [English](README.en.md)

> **Inoffizielle Erweiterung** für [Battery SmartFlow AI](https://github.com/PalmManiac/battery-smartflow-ai).
> Sie stammt nicht von den Entwicklern von Battery SmartFlow AI, und die leisten dafür auch keinen Support.
> Fehler und Wünsche bitte [hier melden](https://github.com/spikesch/smartflow-preisampel/issues), nicht bei Battery SmartFlow AI.

Die Preisampel zeigt als Diagramm, wie Battery SmartFlow AI (kurz BSFAI) die kommenden Strompreise
einstuft – von „sehr billig“ bis „sehr teuer“ – und mit welchen Schwellen es lädt und entlädt.
Mit dem eingebauten Simulator probierst du die Preis-Regler von BSFAI aus, ohne dass sich an der
Steuerung etwas ändert.

## So sieht sie aus

Zwei Stile, im Karten-Editor per Schalter umschaltbar:

**Standard** – folgt dem Design deines Dashboards (hell oder dunkel)

![Preisampel im Standard-Stil](https://raw.githubusercontent.com/spikesch/smartflow-preisampel/main/docs/preisampel-standard-de.png)

**BSFAI-Stil** – immer dunkel, in den Farben des Dashboards von Battery SmartFlow AI

![Preisampel im BSFAI-Stil](https://raw.githubusercontent.com/spikesch/smartflow-preisampel/main/docs/preisampel-bsfai-de.png)

## Was sie zeigt

- **Preisstufen** als Farbflächen je 15-Minuten-Abschnitt: sehr billig · Talpreis · neutral · teuer · Peak · sehr teuer
- **Schwellen** als Linien: Ladeschwelle (Tal), Entladeschwelle, Peak-Schwelle sowie die festen Sehr-billig- und Sehr-teuer-Schwellen
- **Verlauf**: ein Balken darunter zeigt, was BSFAI tatsächlich getan hat (lädt · entlädt · bereit), der Tooltip zusätzlich den Ladestand
- **Simulator** mit fünf Schiebern: Talpreis-Abschlag, Peakpreis-Aufschlag, Gewinnmarge, Sehr-billig- und Sehr-teuer-Schwelle.
  Die Farben folgen sofort den Schiebern, BSFAI regelt währenddessen mit seinen echten Werten weiter.
  Erst **„In BSFAI übernehmen“** schreibt die geänderten Werte – nach einer Rückfrage – in die Regler von BSFAI.
- **Sensor „Preisstufe“** mit der aktuellen Stufe, z. B. für eigene Automationen
- **Zwei Stile**: Standard (folgt dem HA-Design) oder BSFAI-Stil (dunkel wie das Dashboard von Battery SmartFlow AI)
- **Selbsttest**: Die Preisampel vergleicht ihre Schwellen laufend mit den Live-Werten von BSFAI und warnt auf der Karte,
  falls eine BSFAI-Version anders rechnet

Die Preisampel ist eine reine Anzeige. Sie trifft keine eigenen Entscheidungen und sagt nicht voraus, wann BSFAI
lädt: BSFAI berücksichtigt weit mehr als die Preisschwellen (PV-Überschuss, Ladestand, Lernplanung …).
Liegt ein Preis unter der Ladeschwelle, heißt das also nicht zwingend, dass BSFAI dann auch lädt.

## Voraussetzungen

- Home Assistant 2024.10 oder neuer
- [Battery SmartFlow AI](https://github.com/PalmManiac/battery-smartflow-ai), eingerichtet und laufend
  (getestet mit 5.1.x, zuletzt 5.1.16)
- [apexcharts-card](https://github.com/RomRider/apexcharts-card) aus HACS – die Preisampel nutzt die
  Diagramm-Bibliothek, die apexcharts-card mitbringt

Preise, Währung und Regler kommen aus deiner BSFAI-Instanz. Welcher Strompreis-Anbieter dahintersteht
(Tibber, Nord Pool, EPEX, aWATTar …), spielt keine Rolle, solange BSFAI ihn versteht.

## Installation

### Über HACS (benutzerdefiniertes Repository)

1. HACS öffnen → Menü ⋮ → **Benutzerdefinierte Repositories**
2. `https://github.com/spikesch/smartflow-preisampel` eintragen, Typ **Integration**
3. **SmartFlow Preisampel** herunterladen und Home Assistant neu starten

### Von Hand

Den Ordner `custom_components/smartflow_preisampel` nach `config/custom_components/` kopieren
und Home Assistant neu starten.

## Einrichtung

1. **Einstellungen → Geräte & Dienste → Integration hinzufügen → „SmartFlow Preisampel“**
2. Die BSFAI-Instanz auswählen (bei nur einer ist sie schon vorausgewählt)
3. Dashboard bearbeiten → **Karte hinzufügen** → **„SmartFlow Preisampel“**

Eine Dashboard-Ressource musst du nicht anlegen, die Integration lädt die Karte selbst.

### Karte per YAML

```yaml
type: custom:smartflow-preisampel-card
entity: sensor.preisampel_battery_smartflow_ai_preisstufe
```

| Option | Standard | Bedeutung |
|---|---|---|
| `entity` | – | Preisstufen-Sensor der Preisampel (Pflicht) |
| `title` | „Preisampel“ | Überschrift der Karte |
| `height` | `420` | Höhe des Diagramms in Pixel (250–900) |
| `bsfai_style` | `false` | **BSFAI-Stil**: dunkle Karte mit den Farben aus dem Dashboard von Battery SmartFlow AI, unabhängig vom HA-Design |
| `show_history` | `true` | Verlaufsbalken anzeigen (was BSFAI getan hat) |
| `show_simulator` | `true` | Simulator anzeigen |
| `simulation_on` | `true` | Simulator beim Öffnen eingeschaltet |
| `colors` | – | Eigene Farben als Hex-Werte, im Karten-Editor unter „Farben“ – gelten in beiden Stilen |

Farb-Schlüssel: `b` `l` `m` `h` `p` `x` (Preisstufen), `valley` `effective` `peak` `very_cheap` `very_expensive`
(Linien), `act_c` `act_d` `act_i` (Verlauf: lädt, entlädt, bereit).

## Wie die Schwellen entstehen

Die Formeln sind denen von BSFAI nachgebaut. Für jeden Abschnitt rechnet die Preisampel mit den Preisen
**ab diesem Abschnitt** – so, wie BSFAI zu diesem Zeitpunkt gerechnet hätte:

- **Basis** = Mittel aller Preise ab diesem Abschnitt
- **Ladeschwelle (Tal)** = Basis × (1 − Talpreis-Abschlag)
- **Peak-Schwelle** = Basis + das Größere aus Basis × Peakpreis-Aufschlag und 10 % der Preisspanne
- **Entladeschwelle** aus Peak-Schwelle, durchschnittlichem Akku-Ladepreis plus Gewinnmarge und den
  weiteren Regeln von BSFAI

## Bitte beachten

- **Interne Schnittstellen:** Die Preisampel liest ihre Werte aus der laufenden BSFAI-Instanz, teilweise über
  interne, nicht dokumentierte Funktionen. Ein BSFAI-Update kann sie deshalb ausbremsen. Dann zeigt die Karte
  „nicht kompatibel“ oder der Selbsttest warnt – bitte [hier melden](https://github.com/spikesch/smartflow-preisampel/issues).
- **„In BSFAI übernehmen“ ändert echte Einstellungen deines Speichers.** Die Nutzung erfolgt auf eigenes Risiko.
  Gesetzt werden nur die Regler, die du verschoben hast, und nur innerhalb der Grenzen, die BSFAI selbst vorgibt.
- Die Preisampel enthält keinen Code von Battery SmartFlow AI, sie ruft die installierte Integration nur zur Laufzeit auf.

## Für Entwickler

`tests/harness/` ist ein Prüfstand, der die Karte ohne Home Assistant im Browser zeigt:

```bash
HA_URL=http://homeassistant.local:8123 HA_TOKEN=<langlebiger Token> python tests/harness/make_snapshot.py
python -m http.server 8765
```

Dann `http://localhost:8765/tests/harness/index.html` öffnen (`?lang=en` für Englisch).
`snapshot.json` enthält deine echten Daten und wird nicht eingecheckt.

## Danke & Lizenz

Danke an [PalmManiac](https://github.com/PalmManiac) für Battery SmartFlow AI – ohne die Integration gäbe es hier
nichts anzuzeigen. Entwickelt mit Unterstützung von KI (Claude von Anthropic).

Lizenz: [MIT](LICENSE). Genannte Produkt- und Firmennamen gehören ihren jeweiligen Inhabern.
