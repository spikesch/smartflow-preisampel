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
  Darüber die **Ersparnis** über der Entladeschwelle je kWh und insgesamt in € – mit den echten und den Schieberwerten –
  und ein Knopf **„Optimieren“**, der Peakpreis-Aufschlag und Talpreis-Abschlag für die angezeigten Preise einstellt.
  Die Farben folgen sofort den Schiebern, BSFAI regelt währenddessen mit seinen echten Werten weiter.
  Erst **„In BSFAI übernehmen“** schreibt die geänderten Werte – nach einer Rückfrage – in die Regler von BSFAI.
- **Ersparnis** in der Kopfzeile und im Tooltip, am Schieber „Gewinnmarge“ zusätzlich der Betrag in ct (siehe [Was bedeutet die Ersparnis?](#was-bedeutet-die-ersparnis))
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
  (getestet mit 5.1.x und 5.2.x, zuletzt 5.2.6)
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

## Was bedeutet die Ersparnis?

Oben in der Kopfzeile und im Tooltip steht die **Ersparnis**, zum Beispiel „Ersparnis +17,6 ct/kWh“:

> **Ersparnis = Netzpreis − was die kWh aus dem Akku gekostet hat**

Sie zeigt, um wie viel eine kWh aus dem Akku günstiger ist als dieselbe kWh aus dem Netz.

- **Positiv** (grün): Strom aus dem Akku ist billiger als Strom aus dem Netz – jede kWh spart diesen Betrag.
- **Negativ** (rot): Der Netzstrom ist gerade billiger als der Strom im Akku – Entladen würde mehr kosten.

Eine positive Ersparnis heißt nicht, dass BSFAI jetzt entlädt: Der Akku ist begrenzt, BSFAI hebt seine Energie für
die teuersten Stunden auf, wo sie am meisten spart. Entladen wird erst über der Entladeschwelle.

**Was die kWh aus dem Akku gekostet hat** („Akku-Strom kostet“ im Tooltip):

- Grundlage ist der **Ø Akku-Ladepreis** aus dem Kostenbuch von BSFAI: alle Netzladungen zum jeweiligen Preis
  plus PV-Ladungen zum entgangenen Einspeisepreis, gemittelt über alle geladenen kWh seit Beginn.
- **Ladeverluste kommen dazu.** Von jeder kWh, die in den Akku geht, kommt weniger wieder heraus. Die Preisampel
  teilt den Ladepreis deshalb durch den **gemessenen Wirkungsgrad**: kWh aus dem Akku ÷ kWh in den Akku, ebenfalls
  aus dem Kostenbuch von BSFAI. Beispiel: 18,9 ct Ladepreis ÷ 78 % Wirkungsgrad = **24,2 ct je kWh aus dem Akku**.
- Solange BSFAI noch weniger als 20 kWh geladen hat, ist dieses Verhältnis zu ungenau. Dann rechnet die Preisampel
  ohne Ladeverluste und sagt das im Tooltip dazu.

Bitte beachten: Die Ersparnis ist eine **Durchschnittsbetrachtung**. Der Ladepreis ist ein Mittel über die ganze
Laufzeit, nicht der Preis der Energie, die gerade im Akku steckt. Der Wirkungsgrad ist eine Näherung – was der Akku
ins Netz statt ins Haus abgibt, zählt BSFAI nicht als Entladung.

### Ersparnis im Simulator – je kWh und insgesamt

Im Simulator steht, was der Akku von jetzt bis zum Ende der Preisvorschau (so weit der Graph reicht) über der
Entladeschwelle einbringt, zum Beispiel:

> Bis Fr 24:00 über der Entladeschwelle: Ø **18,4 ct/kWh** (9,3 h) · ≈ **0,91 €** → mit den Schieberwerten: Ø **26,2 ct/kWh** (0,8 h) · ≈ **0,11 €**

- **Ø je kWh:** die Ersparnis gemittelt über alle Viertelstunden, in denen der Preis die Entladeschwelle erreicht.
  In Klammern steht, wie viele Stunden das sind.
- **≈ € insgesamt:** die geschätzte Ersparnis für den ganzen Zeitraum – dieselbe Rechnung, die auch der Knopf
  „Optimieren“ verwendet (siehe dort). Sie berücksichtigt, wie viel Energie der Akku hat und wann er leer ist.
- Beides zusammen zeigt den Zielkonflikt: Eine höhere Schwelle spart je kWh mehr, betrifft aber weniger Stunden –
  im Beispiel 26,2 ct statt 18,4 ct je kWh, insgesamt aber nur 0,11 € statt 0,91 €. Maßgeblich ist der Betrag
  insgesamt.
- Sobald ein Schieber verstellt ist, stehen die Werte mit den Schieberwerten daneben. Den Betrag in € zeigt die
  Preisampel nur, wenn BSFAI Akkugröße, Ladestand und Grundlast liefert.

### Knopf „Optimieren“

Der Knopf **„Optimieren“** im Simulator sucht die Einstellung von **Peakpreis-Aufschlag** und
**Talpreis-Abschlag**, mit der die geschätzte Ersparnis bis zum Ende der Preisvorschau am größten ist, und stellt
die Schieber darauf. Darunter steht, wie sich die geschätzte Ersparnis dadurch ändert, z. B.
„geschätzte Ersparnis 0,11 € → 0,91 €“. Gewinnmarge und die festen Schwellen bleiben unverändert.

- **Nur in der Simulation.** Der Knopf verstellt ausschließlich die Schieber. BSFAI regelt weiter mit seinen echten
  Werten – die Optimierung wirkt erst, wenn du sie mit **„In BSFAI übernehmen“** überträgst.
- **Gilt nur für die angezeigten Preise.** Optimiert wird auf die Preise von jetzt bis zum Ende der Preisvorschau
  (so weit der Graph reicht). BSFAI behält die Einstellung aber, bis du sie wieder änderst – mit den Preisen von
  morgen kann ein anderer Wert besser sein. Es lohnt sich, die Optimierung bei neuen Preisen erneut anzusehen.
- **Vereinfachte Rechnung.** Für die Schätzung entlädt der Akku ab jetzt der Reihe nach in jeder Viertelstunde über
  der Entladeschwelle (Verbrauch = Grundlast aus BSFAI, höchstens die Entladeleistung) und lädt im Tal nach, wenn
  eine spätere Preisspitze den Preis um die Gewinnmarge übersteigt. PV-Überschuss, der tatsächliche Verbrauch und
  weitere Regeln von BSFAI (z. B. Lernplanung) fließen nicht ein. Das Ergebnis ist deshalb ein Richtwert.
- **Warum nicht auf die Ø Ersparnis je kWh?** Je höher die Entladeschwelle, desto höher die Ersparnis je kWh – aber in
  immer weniger Stunden, bis ein Teil des Akkus ungenutzt bleibt. Optimiert wird deshalb auf die **Ersparnis
  insgesamt** in Euro. Energie, die am Ende der Preisvorschau noch im Akku ist, zählt dabei weder als Gewinn noch als
  Verlust.
- Bei gleich guten Ergebnissen wählt der Knopf die Einstellung, die am nächsten an den bisherigen Werten liegt.
- Für die Rechnung braucht die Preisampel Akkugröße, Ladestand, Grenzen, Leistungen und Grundlast aus BSFAI. Fehlen
  sie, sagt der Knopf das.

### Der Regler „Gewinnmarge“

Am Schieber „Gewinnmarge“ zeigt die Preisampel neben den Prozent auch den Betrag in ct, der beim Verschieben
mitläuft (z. B. „20 % · 3,8 ct/kWh“). BSFAI nutzt die Gewinnmarge an zwei Stellen:

- **Entladen:** BSFAI hält preisbasiertes Entladen erst ab **Ø Ladepreis + Gewinnmarge** für sinnvoll. Die Prozent
  beziehen sich auf den Ø Ladepreis, **nicht** auf den aktuellen Strompreis: 20 % von 18,9 ct = **3,8 ct** – das ist
  der Betrag am Schieber. Er wandert nicht mit der Preiskurve, sondern ändert sich nur, wenn du den Schieber
  bewegst oder – langsam – wenn sich der Ø Ladepreis durch neue Ladungen verschiebt.
- **Laden aus dem Netz im Tal:** BSFAI lädt nur nach, wenn danach noch eine Preisspitze kommt, die mindestens
  **Preis jetzt + Gewinnmarge** erreicht. Hier beziehen sich die Prozent auf den Preis der Viertelstunde.
- Ladeverluste rechnet BSFAI an dieser Stelle nicht gesondert ein. Wer sie über die Gewinnmarge mit abdecken möchte,
  braucht mindestens **1 ÷ Wirkungsgrad − 1**, bei 78 % also rund **28 %**.
- Die Gewinnmarge geht zu 30 % in die Entladeschwelle ein, die übrigen 70 % kommen vom Markt (82 % der
  Peak-Schwelle). Bei günstig geladenem Akku verschiebt der Regler die Entladeschwelle deshalb nur wenig; wichtig
  wird er an Tagen, an denen die Strompreise nah an den Akku-Kosten liegen.

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
