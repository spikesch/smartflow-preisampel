![SmartFlow Preisampel](https://raw.githubusercontent.com/spikesch/smartflow-preisampel/main/docs/logo/icon-128.png)

# SmartFlow Preisampel (price traffic light)

[Deutsch](README.md) · **English**

> **Unofficial add-on** for [Battery SmartFlow AI](https://github.com/PalmManiac/battery-smartflow-ai).
> It is not made by the developers of Battery SmartFlow AI, and they do not provide support for it.
> Please report bugs and ideas [here](https://github.com/spikesch/smartflow-preisampel/issues), not to Battery SmartFlow AI.

The price traffic light shows as a chart how Battery SmartFlow AI (BSFAI) rates the upcoming electricity
prices – from “very cheap” to “very expensive” – and which thresholds it uses to charge and discharge.
The built-in simulator lets you try BSFAI's price settings without changing how your battery is controlled.

## What it looks like

Two styles, switchable with a toggle in the card editor:

**Standard** – follows your dashboard theme (light or dark)

![Price traffic light, standard style](https://raw.githubusercontent.com/spikesch/smartflow-preisampel/main/docs/preisampel-standard-en.png)

**BSFAI style** – always dark, in the colours of the Battery SmartFlow AI dashboard

![Price traffic light, BSFAI style](https://raw.githubusercontent.com/spikesch/smartflow-preisampel/main/docs/preisampel-bsfai-en.png)

## What it shows

- **Price levels** as coloured areas per 15-minute slot: very cheap · valley · neutral · expensive · peak · very expensive
- **Thresholds** as lines: charge threshold (valley), discharge threshold, peak threshold and the fixed
  very-cheap and very-expensive thresholds
- **History**: a bar below the chart shows what BSFAI actually did (charging · discharging · idle), the tooltip adds the state of charge
- **Simulator** with five sliders: valley discount, peak markup, profit margin, very-cheap and very-expensive threshold.
  The colours follow the sliders instantly while BSFAI keeps running on its real settings.
  Only **“Apply to BSFAI”** writes the changed values – after asking you – to BSFAI's settings.
- **Saving** in the header and the tooltip, the “profit margin” slider also shows its amount in ct (see [What does the saving mean?](#what-does-the-saving-mean))
- **“Price level” sensor** with the current level, e.g. for your own automations
- **Two styles**: standard (follows the HA theme) or BSFAI style (dark, like the Battery SmartFlow AI dashboard)
- **Self-test**: the price traffic light continuously compares its thresholds with BSFAI's live values and
  shows a warning on the card if a BSFAI version calculates differently

The price traffic light only visualises. It makes no decisions of its own and does not predict when BSFAI
will charge: BSFAI considers much more than the price thresholds (PV surplus, state of charge, learned planning …).
A price below the charge threshold therefore does not necessarily mean BSFAI will charge.

## Requirements

- Home Assistant 2024.10 or newer
- [Battery SmartFlow AI](https://github.com/PalmManiac/battery-smartflow-ai), set up and running
  (tested with 5.1.x and 5.2.x, most recently 5.2.6)
- [apexcharts-card](https://github.com/RomRider/apexcharts-card) from HACS – the price traffic light uses the
  chart library that apexcharts-card provides

Prices, currency and settings come from your BSFAI instance. The electricity price provider behind it
(Tibber, Nord Pool, EPEX, aWATTar …) does not matter as long as BSFAI supports it.

## Installation

### Via HACS (custom repository)

1. Open HACS → menu ⋮ → **Custom repositories**
2. Add `https://github.com/spikesch/smartflow-preisampel`, type **Integration**
3. Download **SmartFlow Preisampel** and restart Home Assistant

### Manually

Copy the folder `custom_components/smartflow_preisampel` to `config/custom_components/`
and restart Home Assistant.

## Setup

1. **Settings → Devices & services → Add integration → “SmartFlow Preisampel”**
2. Select the BSFAI instance (preselected if there is only one)
3. Edit a dashboard → **Add card** → **“SmartFlow Preisampel”**

There is no need to add a dashboard resource – the integration loads the card itself.

### Card in YAML

```yaml
type: custom:smartflow-preisampel-card
entity: sensor.preisampel_battery_smartflow_ai_preisstufe
```

| Option | Default | Meaning |
|---|---|---|
| `entity` | – | Price level sensor of the price traffic light (required) |
| `title` | “Price traffic light” | Card title |
| `height` | `420` | Chart height in pixels (250–900) |
| `bsfai_style` | `false` | **BSFAI style**: dark card using the colours of the Battery SmartFlow AI dashboard, independent of the HA theme |
| `show_history` | `true` | Show the history bar (what BSFAI did) |
| `show_simulator` | `true` | Show the simulator |
| `simulation_on` | `true` | Simulator switched on when the card opens |
| `colors` | – | Custom colours as hex values, in the card editor under “Colours” – apply to both styles |

Colour keys: `b` `l` `m` `h` `p` `x` (price levels), `valley` `effective` `peak` `very_cheap` `very_expensive`
(lines), `act_c` `act_d` `act_i` (history: charging, discharging, idle).

The card follows the Home Assistant language (German or English).

## How the thresholds are calculated

The formulas are re-implemented from BSFAI. For every slot the price traffic light uses the prices
**from that slot onwards** – just as BSFAI would have calculated at that moment:

- **Base** = average of all prices from that slot onwards
- **Charge threshold (valley)** = base × (1 − valley discount)
- **Peak threshold** = base + the larger of base × peak markup and 10 % of the price range
- **Discharge threshold** from the peak threshold, the average battery charge price plus profit margin and
  BSFAI's further rules

## What does the saving mean?

The card header and the tooltip show the **saving**, for example “Saving +17.6 ct/kWh”:

> **Saving = grid price − what one kWh from the battery has cost**

A battery for self-consumption does not make a profit – it makes your electricity cheaper. The saving shows how much
cheaper one kWh from the battery is than the same kWh from the grid.

- **Positive** (green): energy from the battery is cheaper than energy from the grid – every kWh saves this amount.
- **Negative** (red): grid energy is currently cheaper than the energy in the battery – discharging would cost more.

A positive saving does not mean BSFAI discharges now: the battery is limited and BSFAI keeps its energy for the most
expensive hours, where it saves the most. It only discharges above the discharge threshold.

**What one kWh from the battery has cost** (“Battery energy costs” in the tooltip):

- It is based on the **average battery charge price** from BSFAI's cost ledger: all grid charging at its price plus
  PV charging at the feed-in tariff you gave up, averaged over every kWh charged since the start.
- **Charging losses come on top.** Less comes out of the battery than went in. The price traffic light therefore
  divides the charge price by the **measured efficiency**: kWh out of the battery ÷ kWh into the battery, also from
  BSFAI's cost ledger. Example: 18.9 ct charge price ÷ 78 % efficiency = **24.2 ct per kWh out of the battery**.
- While BSFAI has charged less than 20 kWh in total, this ratio is too unreliable. The card then calculates without
  losses and says so in the tooltip.

Please note: the saving is an **average view**. The charge price is averaged over the whole runtime, not the price of
the energy currently in the battery. The efficiency is an approximation – energy the battery exports to the grid
instead of the house is not counted as discharge by BSFAI.

### The “profit margin” setting – really a minimum gap

Next to the “profit margin” slider the price traffic light shows the amount in ct as well, following the slider as
you move it (e.g. “20 % · 3.8 ct/kWh”). Despite its name it is not about profit but a **minimum gap**:

- **Discharging:** BSFAI only considers price-based discharging worthwhile from **average charge price + profit
  margin**. The percentage refers to the average charge price, **not** the current electricity price: 20 % of
  18.9 ct = **3.8 ct** – the amount shown at the slider. It does not follow the price curve; it only changes when you
  move the slider or – slowly – when new charging shifts the average charge price.
- **Grid charging at valley prices:** BSFAI only recharges if a later price peak reaches at least **current price +
  profit margin**. Here the percentage refers to the price of that quarter hour.
- BSFAI does this **without** charging losses – the minimum gap is meant to cover them. To reach the real cost you need
  at least **1 ÷ efficiency − 1**, i.e. about **28 %** at 78 % efficiency.
- The minimum gap makes up only 30 % of the discharge threshold, the other 70 % come from the market (82 % of the peak
  threshold). With a cheaply charged battery the setting therefore moves the discharge threshold only a little; it
  matters on days when electricity prices are close to the battery cost.

## Please note

- **Internal interfaces:** the price traffic light reads its values from the running BSFAI instance, partly via
  internal, undocumented functions. A BSFAI update can therefore break it. The card will then show
  “not compatible” or the self-test will warn – please report it [here](https://github.com/spikesch/smartflow-preisampel/issues).
- **“Apply to BSFAI” changes real settings of your battery.** Use at your own risk. Only the sliders you moved
  are written, and only within the limits BSFAI itself defines.
- The price traffic light contains no code from Battery SmartFlow AI; it only calls the installed integration at runtime.

## For developers

`tests/harness/` is a test bench that renders the card in a browser without Home Assistant:

```bash
HA_URL=http://homeassistant.local:8123 HA_TOKEN=<long-lived token> python tests/harness/make_snapshot.py
python -m http.server 8765
```

Then open `http://localhost:8765/tests/harness/index.html` (`?lang=en` for English).
`snapshot.json` contains your real data and is not committed.

## Thanks & licence

Thanks to [PalmManiac](https://github.com/PalmManiac) for Battery SmartFlow AI – without it there would be
nothing to show. Developed with the help of AI (Claude by Anthropic).

Licence: [MIT](LICENSE). Product and company names mentioned belong to their respective owners.
