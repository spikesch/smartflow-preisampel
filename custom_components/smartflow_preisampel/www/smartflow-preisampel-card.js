/*
 * SmartFlow Preisampel - Karte
 *
 * Zeichnet die Preisleiter der Integration smartflow_preisampel mit ApexCharts.
 * Voraussetzung ist apexcharts-card (HACS): die Karte selbst wird nicht benutzt,
 * aber sie bringt die ApexCharts-Bibliothek mit und stellt sie global bereit.
 *
 * Der Rechenkern ladder() entspricht ladder.py der Integration. Er laeuft nur im
 * Simulator; ohne Simulation zeigt die Karte die fertig gerechnete Leiter.
 */

const VERSION = "1.1.1";
const CARD = "smartflow-preisampel-card";
const EDITOR = "smartflow-preisampel-card-editor";

const TEXT = {
  de: {
    title: "Preisampel",
    classes: { b: "sehr billig", l: "Talpreis", m: "neutral", h: "teuer", p: "Peak", x: "sehr teuer" },
    valley: "Ladeschwelle (Tal)",
    effective: "Entladeschwelle",
    peak: "Peak-Schwelle",
    very_cheap: "Sehr-billig-Schwelle",
    very_expensive: "Sehr-teuer-Schwelle",
    act: { c: "lädt", d: "entlädt", i: "bereit" },
    now: "jetzt",
    price: "Preis",
    soc: "Ladestand",
    did: "BSFAI",
    simulation: "Simulation",
    sim_hint: "Die Farben zeigen die Schieberwerte. BSFAI regelt weiter mit den echten Werten, bis du übernimmst.",
    discount: "Talpreis-Abschlag",
    markup: "Peakpreis-Aufschlag",
    margin: "Gewinnmarge",
    reset: "Auf echte Werte",
    apply: "In BSFAI übernehmen",
    apply_confirm: "Diese Werte in Battery SmartFlow AI übernehmen? BSFAI regelt danach damit.",
    applied: "Übernommen.",
    no_apex: "apexcharts-card ist nicht installiert oder noch nicht geladen. Bitte über HACS installieren.",
    no_entity: "Entity nicht gefunden",
    unavailable: "Keine Daten: Battery SmartFlow AI läuft nicht oder ist nicht kompatibel (siehe HA-Protokoll).",
    mismatch: "Achtung: Diese BSFAI-Version rechnet die Schwellen anders als die Ampel. Die Farben können abweichen.",
    no_prices: "BSFAI hat gerade keine Preisvorschau.",
    margin_now: "Ersparnis",
    estimate: (end) => `Bis ${end} über der Entladeschwelle`,
    estimate_sim: "mit den Schieberwerten",
    optimize: "Optimieren",
    optimize_title: "Stellt Peakpreis-Aufschlag und Talpreis-Abschlag so ein, dass die geschätzte Ersparnis bis zum Ende der Preisvorschau am größten ist. Nur in der Simulation – BSFAI ändert sich erst mit „In BSFAI übernehmen“.",
    optimize_result: (end, before, after) => `Optimiert auf die Preise bis ${end}: geschätzte Ersparnis ${before} → ${after}. Wirkt erst nach „In BSFAI übernehmen“.`,
    optimize_same: (end) => `Für die Preise bis ${end} sind die Werte schon optimal.`,
    optimize_missing: "Zum Optimieren fehlen noch Akkudaten von BSFAI (Akkugröße, Ladestand, Grundlast).",
    cost: "Akku-Strom kostet",
    cost_eff: (avg, eff) => `Ø Ladepreis ${avg} ÷ Wirkungsgrad ${eff}`,
    cost_no_eff: (avg) => `Ø Ladepreis ${avg}, ohne Ladeverluste (noch zu wenig Messwerte)`,
    editor: { entity: "Preisampel-Sensor", title: "Titel", height: "Höhe", bsfai_style: "BSFAI-Stil (dunkel wie das Dashboard von Battery SmartFlow AI)", show_history: "Verlauf anzeigen (was BSFAI getan hat)", show_simulator: "Simulator anzeigen", simulation_on: "Simulator beim Öffnen eingeschaltet", colors: "Farben" },
    days: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"],
  },
  en: {
    title: "Price traffic light",
    classes: { b: "very cheap", l: "valley", m: "neutral", h: "expensive", p: "peak", x: "very expensive" },
    valley: "Charge threshold (valley)",
    effective: "Discharge threshold",
    peak: "Peak threshold",
    very_cheap: "Very cheap threshold",
    very_expensive: "Very expensive threshold",
    act: { c: "charging", d: "discharging", i: "idle" },
    now: "now",
    price: "Price",
    soc: "State of charge",
    did: "BSFAI",
    simulation: "Simulation",
    sim_hint: "Colours follow the sliders. BSFAI keeps using its real settings until you apply them.",
    discount: "Valley discount",
    markup: "Peak markup",
    margin: "Profit margin",
    reset: "Back to real values",
    apply: "Apply to BSFAI",
    apply_confirm: "Apply these values to Battery SmartFlow AI? BSFAI will regulate with them.",
    applied: "Applied.",
    no_apex: "apexcharts-card is not installed or not loaded yet. Please install it via HACS.",
    no_entity: "Entity not found",
    unavailable: "No data: Battery SmartFlow AI is not running or not compatible (see the HA log).",
    mismatch: "Warning: this BSFAI version calculates its thresholds differently. Colours may be off.",
    no_prices: "BSFAI has no price forecast right now.",
    margin_now: "Saving",
    estimate: (end) => `Until ${end} above the discharge threshold`,
    estimate_sim: "with the slider values",
    optimize: "Optimise",
    optimize_title: "Sets peak markup and valley discount so that the estimated saving until the end of the price forecast is highest. Simulation only – BSFAI only changes when you press “Apply to BSFAI”.",
    optimize_result: (end, before, after) => `Optimised for the prices until ${end}: estimated saving ${before} → ${after}. Takes effect only after “Apply to BSFAI”.`,
    optimize_same: (end) => `For the prices until ${end} the values are already optimal.`,
    optimize_missing: "Optimising needs battery data from BSFAI (capacity, state of charge, base load).",
    cost: "Battery energy costs",
    cost_eff: (avg, eff) => `avg. charge price ${avg} ÷ efficiency ${eff}`,
    cost_no_eff: (avg) => `avg. charge price ${avg}, without losses (not enough data yet)`,
    editor: { entity: "Price traffic light sensor", title: "Title", height: "Height", bsfai_style: "BSFAI style (dark, like the Battery SmartFlow AI dashboard)", show_history: "Show history (what BSFAI did)", show_simulator: "Show simulator", simulation_on: "Simulator switched on when opened", colors: "Colours" },
    days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
};

const CLASS_ORDER = ["b", "l", "m", "h", "p", "x"];
const LINE_ORDER = ["valley", "effective", "peak", "very_expensive", "very_cheap"];
const ACT_ORDER = ["c", "d", "i"];
// Standardfarben; jede laesst sich in der Kartenkonfiguration unter "colors"
// ueberschreiben (Hex-String oder [r, g, b] aus dem Farbwaehler des Editors).
const DEFAULT_COLORS = {
  b: "#15803d", l: "#22c55e", m: "#eab308", h: "#f97316", p: "#ef4444", x: "#991b1b",
  valley: "#1d4ed8", effective: "#7c3aed", peak: "#334155", very_expensive: "#be123c", very_cheap: "#047857",
  act_c: "#16a34a", act_d: "#ea580c", act_i: "#94a3b8",
};

// BSFAI-Stil: Farben aus dem Dashboard von Battery SmartFlow AI (hems-dashboard.js).
// Ergaenzt ist nur "teuer" (h), damit es zwischen Gelb und Koralle liegt.
const BSFAI_COLORS = {
  b: "#25914d", l: "#56cf83", m: "#f0c34e", h: "#e8964a", p: "#f0765b", x: "#c44830",
  valley: "#16c4df", effective: "#f4d78b", peak: "#b7c4ce", very_expensive: "#f2aaaa", very_cheap: "#a8e5ba",
  act_c: "#1bb7df", act_d: "#f0c34e", act_i: "#59616a",
};
const BSFAI_TEXT = "#e7e9eb";

function palette(bsfai) {
  return bsfai ? BSFAI_COLORS : DEFAULT_COLORS;
}

function toHex(value) {
  if (Array.isArray(value) && value.length === 3) {
    return "#" + value.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
  }
  return typeof value === "string" && value ? value : null;
}

function fromHex(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || "");
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : undefined;
}
const BAND_MAX = 14; // Band hat den Wert 1, nimmt also 1/14 der Hoehe ein
const MARKER_COLOR = "#0f172a";

// Anzeige in Untereinheiten, wo das ueblich ist.
const MINOR_UNIT = { EUR: "ct", CHF: "Rp.", GBP: "p", USD: "¢" };

// BSFAI-KI-Status -> Balkenzeichen
const AI_STATUS_ACT = {
  charge_surplus: "c", price_charge: "c", emergency_charge: "c",
  cover_deficit: "d", expensive_discharge: "d", very_expensive_force: "d",
  standby: "i", manual: "i",
};

function lang(hass) {
  const code = ((hass && (hass.locale?.language || hass.language)) || "en").slice(0, 2);
  return TEXT[code] ? code : "en";
}

/* Rechenkern - Gegenstueck zu ladder.py */
function ladder(p, s) {
  const n = p.length;
  const total = new Array(n), low = new Array(n), high = new Array(n);
  for (let i = n - 1; i >= 0; i--) {
    const nxt = i + 1 < n;
    total[i] = p[i] + (nxt ? total[i + 1] : 0);
    low[i] = nxt ? Math.min(p[i], low[i + 1]) : p[i];
    high[i] = nxt ? Math.max(p[i], high[i + 1]) : p[i];
  }
  const margin = 1 + s.margin_pct / 100;
  const avg = s.avg_charge_price;
  const economic = avg !== null && avg !== undefined && avg >= 0 ? avg * margin : null;
  const avgMissing = avg === null || avg === undefined || avg <= 0.0001;
  const valley = [], peak = [], effective = [];
  let cls = "";
  for (let i = 0; i < n; i++) {
    const base = total[i] / (n - i);
    const v = base * s.valley_factor;
    const pk = base + Math.max(Math.abs(base) * Math.max(0, s.peak_factor - 1), Math.max(0, high[i] - low[i]) * 0.1);
    let e;
    {
      const anchor = Math.max(v, pk * 0.82);
      let floor = Math.max(0, v);
      if (s.feed_in !== null && s.feed_in !== undefined) floor = Math.max(floor, Math.max(0, s.feed_in) * margin);
      const cfg = Math.max(0, s.expensive_threshold || 0);
      const mid = v + Math.max(0, anchor - v) * 0.55;
      const dyn = cfg > 0 ? Math.max(mid, cfg * 0.65 + anchor * 0.35) : mid;
      e = Math.min(Math.max(floor, dyn), pk * 0.9);
    }
    if (economic !== null && !avgMissing) {
      const anchor = pk * 0.82;
      const vfloor = v + Math.max(0, anchor - v) * 0.35;
      let x = Math.max(anchor * 0.7 + economic * 0.3, economic);
      x = Math.max(x, vfloor);
      e = Math.max(vfloor, Math.min(x, pk * 0.9));
    }
    valley.push(v); peak.push(pk); effective.push(e);
    const pr = p[i];
    cls += s.very_cheap > 0 && pr <= s.very_cheap ? "b"
      : pr <= v ? "l"
      : s.very_expensive > 0 && pr >= s.very_expensive ? "x"
      : pr >= pk ? "p"
      : pr >= e ? "h" : "m";
  }
  return { valley, peak, effective, cls };
}

function waitForApex(timeoutMs) {
  if (globalThis.ApexCharts) return Promise.resolve(true);
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(!!globalThis.ApexCharts), timeoutMs);
    customElements.whenDefined("apexcharts-card").then(() => {
      clearTimeout(timer);
      resolve(!!globalThis.ApexCharts);
    });
  });
}

class SmartflowPreisampelCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement(EDITOR);
  }

  static getStubConfig(hass) {
    const found = Object.keys(hass.states).find(
      (id) => id.startsWith("sensor.") && hass.states[id].attributes && "ladder" in hass.states[id].attributes);
    return { entity: found || "", show_history: true, show_simulator: true };
  }

  setConfig(config) {
    if (!config || !config.entity) throw new Error("entity required");
    this._config = { height: 420, show_history: true, show_simulator: true, simulation_on: true, ...config };
    this._built = false;
    if (this._hass) this._render();
  }

  _c(key) {
    return toHex((this._config.colors || {})[key]) || palette(this._config.bsfai_style)[key];
  }

  getCardSize() {
    return Math.ceil((this._config?.height || 420) / 50) + (this._config?.show_simulator ? 4 : 1);
  }

  getGridOptions() {
    return { columns: "full", min_columns: 6, rows: "auto" };
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (!this._config) return;
    if (first || !this._built) { this._render(); return; }
    // hass kommt bei JEDER Zustandsaenderung im Haus - nur reagieren, wenn
    // unsere Entity oder einer der BSFAI-Regler sich geaendert hat.
    const watched = this._watched();
    const changed = watched.some((id) => hass.states[id] !== this._seen[id]);
    if (changed) this._update();
  }

  _watched() {
    const ids = [this._config.entity];
    const ents = this._hass.states[this._config.entity]?.attributes?.entities || {};
    for (const key of ["valley_factor", "peak_factor", "profit_margin_pct", "very_cheap_price", "very_expensive_threshold"]) {
      if (ents[key]) ids.push(ents[key]);
    }
    return ids;
  }

  _t() {
    return TEXT[lang(this._hass)];
  }

  /* HA uebergibt Konfiguration und hass, BEVOR die Karte im Dokument haengt.
   * Das Diagramm wird deshalb erst hier angelegt bzw. nachgeholt - ApexCharts
   * bricht mit "Element not found" ab, wenn sein Container nicht verbunden ist. */
  connectedCallback() {
    if (!this._built) return;
    if (this._chart && this._resizeTarget) this._observe();
    else this._update();
    this._startHistoryTimer();
  }

  disconnectedCallback() {
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    if (this._historyTimer) { clearInterval(this._historyTimer); this._historyTimer = null; }
  }

  _startHistoryTimer() {
    if (!this._config.show_history || this._historyTimer) return;
    this._historyTimer = setInterval(() => this._loadHistory(), 5 * 60 * 1000);
  }

  async _render() {
    const t = this._t();
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { display: block; padding: 12px 12px 8px; }
        /* BSFAI-Stil: immer dunkel, Werte aus dem Dashboard von Battery SmartFlow AI */
        ha-card.bsfai {
          --primary-text-color: #e7e9eb; --secondary-text-color: #a4a9af; --divider-color: #34383d;
          --primary-color: #16c4df; --card-background-color: #1b1e21; --ha-card-background: #1b1e21;
          --text-primary-color: #dff8ff; --switch-checked-color: #16c4df; --switch-checked-button-color: #16c4df;
          --switch-checked-track-color: #16c4df;
          background: #1b1e21; color: #e7e9eb; border: 1px solid #34383d; border-radius: 14px;
          font-family: Inter, "Segoe UI", sans-serif; padding: 16px 16px 12px;
        }
        ha-card.bsfai .title { font-weight: 650; letter-spacing: -.01em; }
        ha-card.bsfai button { border-radius: 7px; background: #25292d; border-color: #41464b; color: #c4c8cc; }
        ha-card.bsfai button.primary { background: #153746; border-color: #247b9b; color: #dff8ff; }
        .head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .title { font-size: 1.2em; font-weight: 500; }
        .now { color: var(--secondary-text-color); font-size: .95em; }
        .now .level { font-weight: 600; white-space: nowrap; }
        .now .keep { white-space: nowrap; }
        .warn { margin: 8px 0; padding: 8px 10px; border-radius: 8px; background: rgba(234,88,12,.12); color: var(--primary-text-color); border-left: 4px solid #ea580c; }
        .info { margin: 8px 0; padding: 8px 10px; border-radius: 8px; background: rgba(29,78,216,.10); border-left: 4px solid #1d4ed8; }
        .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 8px 0 2px; font-size: .9em; }
        .legend span { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; user-select: none; }
        .legend span.off { opacity: .35; }
        .legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; }
        .legend i.line { height: 3px; border-radius: 0; }
        #chart { width: 100%; min-height: 50px; }
        .sim { border-top: 1px solid var(--divider-color); margin-top: 6px; padding-top: 8px; max-width: 640px; }
        .sim-head { display: flex; align-items: center; gap: 10px; font-weight: 500; }
        .sim-hint { color: var(--secondary-text-color); font-size: .9em; margin: 4px 0 6px; }
        .sim { container-type: inline-size; }
        .row { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(0, 3fr) auto; gap: 4px 10px; align-items: center; margin: 4px 0; }
        .row input[type=range] { width: 100%; min-width: 0; margin: 0; accent-color: var(--primary-color); }
        .row .val { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        /* Schmal (Handy): Beschriftung und Wert oben, Schieber darunter in voller Breite */
        @container (max-width: 480px) {
          .row { grid-template-columns: 1fr auto; margin: 8px 0; }
          .row input[type=range] { grid-column: 1 / -1; grid-row: 2; }
        }
        .buttons { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; flex-wrap: wrap; }
        button { font: inherit; padding: 6px 14px; border-radius: 18px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); cursor: pointer; }
        button.primary { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: var(--primary-color); }
        button:disabled { opacity: .4; cursor: default; }
        .rows.disabled { opacity: .45; pointer-events: none; }
        .estimate { margin: 4px 0 8px; }
        .estimate .big { font-weight: 600; font-variant-numeric: tabular-nums; }
        .estimate .note { color: var(--secondary-text-color); font-size: .9em; margin-top: 2px; }

      </style>
      <ha-card class="${this._config.bsfai_style ? "bsfai" : ""}">
        <div class="head"><div class="title"></div><div class="now"></div></div>
        <div class="msg"></div>
        <div class="legend"></div>
        <div id="chart"></div>
        <div class="sim" hidden>
          <div class="sim-head"><ha-switch class="sim-switch"></ha-switch><span>${t.simulation}</span></div>
          <div class="sim-hint">${t.sim_hint}</div>
          <div class="estimate"></div>
          <div class="rows disabled"></div>
          <div class="buttons">
            <button class="optimize" title="${t.optimize_title}">${t.optimize}</button>
            <button class="reset" disabled>${t.reset}</button>
            <button class="apply primary" disabled>${t.apply}</button>
          </div>
        </div>
      </ha-card>`;
    this._built = true;
    this._chart = null;
    this._seen = {};
    this._hidden = new Set();
    this._sim = null;
    this._act = null;
    this.shadowRoot.querySelector(".title").textContent = this._config.title ?? t.title;

    const ok = await waitForApex(10000);
    if (!ok) { this._message(t.no_apex, "warn"); return; }
    this._setupSimulator();
    this._update();
    if (this._config.show_history) {
      this._loadHistory();
      if (this.isConnected) this._startHistoryTimer();
    }
  }

  _message(text, kind) {
    const box = this.shadowRoot.querySelector(".msg");
    box.innerHTML = text ? `<div class="${kind}"></div>` : "";
    if (text) box.firstChild.textContent = text;
  }

  _state() {
    return this._hass.states[this._config.entity];
  }

  _unit(currency) {
    const minor = MINOR_UNIT[currency];
    return minor ? { label: `${minor}/kWh`, factor: 100, digits: 1 } : { label: `${currency}/kWh`, factor: 1, digits: 3 };
  }

  /* Die sichtbare Leiter: echt oder simuliert */
  _view() {
    const st = this._state();
    const L = st?.attributes?.ladder;
    if (!L || !L.n) return null;
    const unit = this._unit(L.currency);
    let v = { p: L.p, valley: L.valley, peak: L.peak, effective: L.effective, cls: L.cls,
      very_cheap: L.very_cheap, very_expensive: L.very_expensive, sim: false };
    if (this._sim && this._sim.on) {
      const s = {
        valley_factor: 1 - this._sim.discount / 100,
        peak_factor: 1 + this._sim.markup / 100,
        margin_pct: this._sim.margin,
        very_cheap: this._sim.very_cheap,
        very_expensive: this._sim.very_expensive,
        expensive_threshold: L.expensive_threshold,
        avg_charge_price: L.avg_charge_price,
        feed_in: L.feed_in,
      };
      v = { p: L.p, ...ladder(L.p, s), very_cheap: s.very_cheap, very_expensive: s.very_expensive,
        sim: !!this._sim.touched };
    }
    const t0 = Date.parse(L.start);
    const step = (L.step_min || 15) * 60000;
    const nowIndex = Math.min(L.n - 1, Math.max(-1, Math.floor((Date.now() - t0) / step)));
    // Was eine kWh AUS dem Akku gekostet hat: Ladepreis geteilt durch den
    // gemessenen Wirkungsgrad. Ohne Wirkungsgrad bleibt es beim Ladepreis.
    const avg = typeof L.avg_charge_price === "number" ? L.avg_charge_price : null;
    const eff = typeof L.efficiency === "number" && L.efficiency > 0 ? L.efficiency : null;
    const costOut = avg === null ? null : avg / (eff || 1);
    return { ...v, n: L.n, t0, step, unit, nowIndex, currency: L.currency, avg, eff, costOut };
  }

  _update() {
    if (!this._built || !globalThis.ApexCharts) return;
    const t = this._t();
    const st = this._state();
    for (const id of this._watched()) this._seen[id] = this._hass.states[id];
    if (!st) { this._message(`${t.no_entity}: ${this._config.entity}`, "warn"); return; }
    if (st.state === "unavailable" || !st.attributes?.ladder) { this._message(t.unavailable, "warn"); return; }
    const V = this._view();
    if (!V) { this._message(t.no_prices, "info"); return; }
    const selftest = st.attributes.selftest || {};
    this._message(selftest.status === "mismatch" ? t.mismatch : "", "warn");
    this._syncSimulatorFromReal(false);
    // Nach "Uebernehmen" meldet HA die neuen Reglerwerte etwas spaeter - erst
    // dann sind Schieber und echte Werte gleich und die Knoepfe gehen aus.
    if (this._sim) this._markDirty();
    this._V = V;

    const nowCls = V.nowIndex >= 0 ? V.cls[V.nowIndex] : null;
    // "jetzt:" bleibt gedeckt, Stufe und Preis tragen die Farbe der Stufe
    // (dieselbe wie im Diagramm, eigene Farben eingeschlossen).
    const nowText = this.shadowRoot.querySelector(".now");
    nowText.textContent = "";
    if (nowCls) {
      const level = document.createElement("span");
      level.className = "level";
      level.style.color = this._c(nowCls);
      level.textContent = `${t.classes[nowCls]} · ${this._fmt(V.p[V.nowIndex], V.unit)}`;
      const parts = [`${t.now}: `, level];
      if (V.costOut !== null) {
        const m = V.p[V.nowIndex] - V.costOut;
        const value = document.createElement("span");
        value.className = "level";
        value.style.color = this._marginColor(m);
        value.textContent = this._fmtSigned(m, V.unit);
        const margin = document.createElement("span");
        margin.className = "keep";
        margin.append(`${t.margin_now} `, value);
        parts.push(" · ", margin);
      }
      if (V.sim) parts.push(` · ${t.simulation}`);
      nowText.append(...parts);
    }

    this._renderEstimate(V);

    const { series, meta } = this._series(V);
    this._meta = meta;
    this._legend(V, meta);
    if (!this.isConnected) return; // Diagramm kommt in connectedCallback
    if (!this._chart) this._create(series, V);
    else {
      this._chart.updateOptions(this._dynamicOptions(V, meta), false, false, false);
      this._chart.updateSeries(series, false);
    }
  }

  _fmtSigned(value, unit) {
    const text = this._fmt(Math.abs(value), unit);
    return value >= 0 ? `+${text}` : `−${text}`;
  }

  /* Ersparnis je kWh ueber der Entladeschwelle: Mittel von Preis - Kosten der
   * kWh aus dem Akku ueber alle kommenden Viertelstunden, in denen der Preis
   * die Entladeschwelle erreicht - dazu, wie viele Stunden das sind. Hoehere
   * Schwelle = mehr je kWh, aber in weniger Stunden. */
  _perKwh(p, effective, V) {
    let sum = 0, n = 0;
    for (let j = Math.max(0, V.nowIndex); j < p.length; j++) {
      if (p[j] >= effective[j]) { sum += p[j] - V.costOut; n += 1; }
    }
    return { avg: n ? sum / n : null, hours: n * V.step / 3600000 };
  }

  _renderEstimate(V) {
    const box = this.shadowRoot.querySelector(".estimate");
    if (!box) return;
    const L = this._state()?.attributes?.ladder;
    if (!L || V.costOut === null || V.nowIndex < 0) { box.innerHTML = ""; return; }
    const t = this._t();
    const endLabel = this._endLabel(V);
    const h = (x) => `${x.toFixed(1).replace(".", lang(this._hass) === "de" ? "," : ".")} h`;
    // Geschaetzte Ersparnis insgesamt (dieselbe Rechnung wie beim Optimieren) -
    // nur, wenn BSFAI die Akkudaten liefert
    const B = this._battery();
    const laterMax = B ? this._laterMax(L.p) : null;
    const part = (r, total) => {
      let out = r.avg === null ? `— (0 h)` : `Ø <span class="big">${this._fmt(r.avg, V.unit)}</span> (${h(r.hours)})`;
      if (total !== null) out += ` · ≈ <span class="big">${this._money(total, L.currency)}</span>`;
      return out;
    };
    const total = (p, valley, effective, margin) => (B ? this._estimate(p, valley, effective, margin, V, B, laterMax) : null);
    const real = this._perKwh(L.p, L.effective, V);
    let html = `${t.estimate(endLabel)}: ${part(real, total(L.p, L.valley, L.effective, L.margin_pct))}`;
    if (V.sim) {
      const sim = this._perKwh(V.p, V.effective, V);
      html += ` → ${t.estimate_sim}: ${part(sim, total(V.p, V.valley, V.effective, this._sim.margin))}`;
    }
    if (this._optNote) html += `<div class="note">${this._optNote}</div>`;
    box.innerHTML = html;
  }

  /* Ende der Preisvorschau, 00:00 als 24:00 des Vortags */
  _endLabel(V) {
    const t = this._t();
    const z = (n) => String(n).padStart(2, "0");
    const d = new Date(V.t0 + V.n * V.step);
    if (d.getHours() === 0 && d.getMinutes() === 0) return `${t.days[new Date(d.getTime() - 1).getDay()]} 24:00`;
    return `${t.days[d.getDay()]} ${z(d.getHours())}:${z(d.getMinutes())}`;
  }

  _money(value, currency) {
    const de = lang(this._hass) === "de";
    const sign = value < 0 ? "−" : "";
    const num = Math.abs(value).toFixed(2).replace(".", de ? "," : ".");
    return currency === "EUR" ? `${sign}${num} €` : `${sign}${num} ${currency}`;
  }

  /* Grobe Ersparnis in Geld bis zum Ende der Preisvorschau - nur fuer den
   * Optimieren-Knopf. Ab jetzt der Reihe nach entladen, solange der Preis
   * ueber der Entladeschwelle liegt (Verbrauch = BSFAI-Grundlast, begrenzt durch
   * die Entladeleistung); im Tal nachladen, wenn eine spaetere Spitze den Preis
   * um die Gewinnmarge uebersteigt (wie BSFAIs Talpreis-Nachladen). Ersparnis
   * je kWh = Preis - Kosten der kWh aus dem Akku (Ladeverluste eingerechnet).
   * Energie, die am Ende noch im Akku ist, zaehlt weder als Gewinn noch Verlust. */
  _estimate(p, valley, effective, marginPct, V, B, laterMax) {
    const eff = V.eff || 1;
    const usable = (B.soc_max - B.soc_min) / 100 * B.capacity_kwh;
    let energy = Math.max(0, Math.min(usable, (B.soc - B.soc_min) / 100 * B.capacity_kwh));
    let cost = V.costOut;
    const outKwh = Math.min(B.base_load_w, B.max_discharge_w) / 1000 * 0.25;
    const inKwh = B.max_charge_w / 1000 * 0.25;
    let save = 0;
    for (let j = Math.max(0, V.nowIndex); j < p.length; j++) {
      if (p[j] >= effective[j] && energy > 1e-9) {
        const d = Math.min(energy, outKwh);
        energy -= d; save += d * (p[j] - cost);
      } else if (p[j] <= valley[j] && energy < usable - 1e-9 && laterMax[j] >= p[j] * (1 + marginPct / 100)) {
        const grid = Math.min((usable - energy) / eff, inKwh);
        const stored = grid * eff;
        cost = (cost * energy + p[j] * grid) / (energy + stored);
        energy += stored;
      }
    }
    return save;
  }

  /* hoechster Preis nach jedem Slot - fuer die Nachlade-Regel */
  _laterMax(p) {
    const out = new Array(p.length).fill(-Infinity);
    for (let j = p.length - 2; j >= 0; j--) out[j] = Math.max(p[j + 1], out[j + 1]);
    return out;
  }

  _battery() {
    const B = this._state()?.attributes?.ladder?.battery;
    const keys = ["capacity_kwh", "soc", "soc_min", "soc_max", "max_charge_w", "max_discharge_w", "base_load_w"];
    return B && keys.every((k) => typeof B[k] === "number") ? B : null;
  }

  /* Probiert alle Kombinationen aus Peakpreis-Aufschlag und Talpreis-Abschlag
   * (Schieberbereiche von BSFAI) und nimmt die mit der groessten geschaetzten
   * Ersparnis; bei Gleichstand die, die am naechsten an den jetzigen Werten liegt.
   * Gewinnmarge und die festen Schwellen bleiben, wie sie sind. */
  _optimize() {
    const t = this._t();
    const L = this._state()?.attributes?.ladder;
    const V = this._view();
    const B = this._battery();
    if (!L || !V || !B || V.costOut === null || V.nowIndex < 0) {
      this._optNote = t.optimize_missing;
      this._update();
      return;
    }
    const laterMax = this._laterMax(L.p);
    const range = (key) => {
      const el = this.shadowRoot.querySelector(`input[data-key="${key}"]`);
      const min = parseFloat(el.min), max = parseFloat(el.max);
      let step = parseFloat(el.step) || 1;
      while ((max - min) / step > 200) step *= 2;
      const out = [];
      for (let x = min; x <= max + 1e-9; x += step) out.push(Math.round(x * 1000) / 1000);
      return out;
    };
    const base = {
      margin_pct: this._sim.margin, very_cheap: this._sim.very_cheap, very_expensive: this._sim.very_expensive,
      expensive_threshold: L.expensive_threshold, avg_charge_price: L.avg_charge_price, feed_in: L.feed_in,
    };
    const score = (discount, markup) => {
      const r = ladder(L.p, { ...base, valley_factor: 1 - discount / 100, peak_factor: 1 + markup / 100 });
      return this._estimate(L.p, r.valley, r.effective, this._sim.margin, V, B, laterMax);
    };
    const cur = { discount: this._sim.discount, markup: this._sim.markup };
    const before = score(cur.discount, cur.markup);
    let best = { ...cur, save: before, dist: 0 };
    for (const discount of range("discount")) {
      for (const markup of range("markup")) {
        const save = score(discount, markup);
        const dist = Math.abs(discount - cur.discount) + Math.abs(markup - cur.markup);
        if (save > best.save + 0.005 || (Math.abs(save - best.save) <= 0.005 && dist < best.dist)) {
          best = { discount, markup, save, dist };
        }
      }
    }
    const end = this._endLabel(V);
    if (best.discount === cur.discount && best.markup === cur.markup) {
      this._optNote = t.optimize_same(end);
    } else {
      this._optNote = t.optimize_result(end, this._money(before, L.currency), this._money(best.save, L.currency));
      for (const key of ["discount", "markup"]) {
        this._sim[key] = best[key];
        const el = this.shadowRoot.querySelector(`input[data-key="${key}"]`);
        if (el) el.value = best[key];
        this._showValue(key);
      }
    }
    // Simulation einschalten, damit das Ergebnis sichtbar ist
    this._sim.on = true;
    const sw = this.shadowRoot.querySelector(".sim-switch");
    if (sw) sw.checked = true;
    this.shadowRoot.querySelector(".rows").classList.remove("disabled");
    this._markDirty();
    this._update();
  }

  _marginColor(value) {
    return value >= 0 ? this._c("l") : this._c("p");
  }

  _fmt(value, unit) {
    if (value === null || value === undefined || isNaN(value)) return "—";
    return `${(value * unit.factor).toFixed(unit.digits).replace(".", lang(this._hass) === "de" ? "," : ".")} ${unit.label}`;
  }

  _series(V) {
    const t = this._t();
    const x = (i) => V.t0 + i * V.step;
    const f = V.unit.factor;
    const series = [], meta = [];
    const counts = {};
    for (const k of CLASS_ORDER) {
      counts[k] = 0;
      const data = V.p.map((v, i) => {
        if (V.cls[i] === k) counts[k] += 1;
        const on = V.cls[i] === k || V.cls[i - 1] === k || V.cls[i + 1] === k;
        return [x(i), on ? v * f : null];
      });
      series.push({ name: `cls_${k}`, type: "area", data });
      meta.push({ kind: "class", key: k, color: this._c(k), label: t.classes[k], count: counts[k] });
    }
    for (const key of ["valley", "effective", "peak"]) {
      series.push({ name: key, type: "line", data: V[key].map((v, i) => [x(i), v * f]) });
      meta.push({ kind: "line", key, color: this._c(key), label: t[key], dash: 7 });
    }
    for (const key of ["very_expensive", "very_cheap"]) {
      const val = V[key] > 0 ? V[key] * f : null;
      series.push({ name: key, type: "line", data: V.p.map((_, i) => [x(i), val]) });
      meta.push({ kind: "line", key, color: this._c(key), label: t[key], dash: 14, hideIfEmpty: val === null });
    }
    const act = this._config.show_history ? this._act : null;
    for (const k of ACT_ORDER) {
      let count = 0;
      const data = V.p.map((_, i) => {
        const on = act && i <= V.nowIndex && act.states[i] === k;
        if (on) count += 1;
        return [x(i), on ? 1 : null];
      });
      series.push({ name: `act_${k}`, type: "area", data });
      meta.push({ kind: "band", key: k, color: this._c(`act_${k}`), label: `${t.did}: ${t.act[k]}`, count, hideIfEmpty: !act });
    }
    series.push({
      name: "changes", type: "column",
      data: V.p.map((v, i) => {
        const on = act && i > 0 && i <= V.nowIndex && act.states[i] && act.states[i - 1]
          && act.states[i] !== "-" && act.states[i - 1] !== "-" && act.states[i] !== act.states[i - 1];
        return [x(i), on ? v * f : null];
      }),
    });
    meta.push({ kind: "marker", key: "changes", color: this._config.bsfai_style ? BSFAI_TEXT : MARKER_COLOR, label: "", hideIfEmpty: true });
    return { series, meta };
  }

  _legend(V, meta) {
    const box = this.shadowRoot.querySelector(".legend");
    box.innerHTML = "";
    meta.forEach((m, index) => {
      if (m.hideIfEmpty || m.kind === "marker") return;
      if ((m.kind === "class" || m.kind === "band") && !m.count) return;
      const item = document.createElement("span");
      const name = `series_${index}`;
      if (this._hidden.has(name)) item.classList.add("off");
      const swatch = document.createElement("i");
      if (m.kind === "line") swatch.className = "line";
      swatch.style.background = m.color;
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(m.count !== undefined ? `${m.label} · ${m.count}` : m.label));
      item.addEventListener("click", () => {
        const seriesName = this._chart.w.globals.seriesNames[index];
        this._chart.toggleSeries(seriesName);
        if (this._hidden.has(name)) this._hidden.delete(name); else this._hidden.add(name);
        item.classList.toggle("off");
      });
      box.appendChild(item);
    });
  }

  _dynamicOptions(V, meta) {
    const t = this._t();
    const priceMaster = "cls_b";
    const bandMaster = "act_c";
    const prices = V.p.map((v) => v * V.unit.factor);
    const lo = Math.min(0, ...prices);
    const yaxis = meta.map((m, i) => {
      if (m.kind === "band") {
        return { seriesName: bandMaster, show: false, min: 0, max: BAND_MAX, opposite: true };
      }
      return {
        seriesName: priceMaster,
        show: i === 0,
        min: lo < 0 ? Math.floor(lo) : 0,
        forceNiceScale: true,
        decimalsInFloat: V.unit.factor === 100 ? 0 : 2,
        title: { text: V.unit.label },
        labels: { formatter: (v) => (v === null || v === undefined ? "" : v.toFixed(V.unit.factor === 100 ? 0 : 2)) },
      };
    });
    const now = Date.now();
    return {
      yaxis,
      annotations: {
        xaxis: [{
          x: now, borderColor: "var(--primary-text-color)", strokeDashArray: 0,
          label: { text: t.now, orientation: "horizontal", borderWidth: 0,
            style: { background: "transparent", color: this._fg(), fontSize: "11px" } },
        }],
      },
    };
  }

  _fg() {
    if (this._config.bsfai_style) return BSFAI_TEXT;
    return getComputedStyle(this).getPropertyValue("--primary-text-color").trim() || "#333";
  }

  _create(series, V) {
    const meta = this._meta;
    const el = this.shadowRoot.querySelector("#chart");
    const isArea = (m) => m.kind === "class" || m.kind === "band";
    const options = {
      chart: {
        type: "line", height: this._config.height, width: "100%",
        foreColor: this._fg(), background: "transparent",
        animations: { enabled: false },
        zoom: { enabled: true, type: "x" },
        toolbar: { show: true, autoSelected: "pan",
          tools: { zoom: true, pan: true, reset: true, zoomin: false, zoomout: false, download: false, selection: false } },
        redrawOnParentResize: true, redrawOnWindowResize: true,
      },
      theme: { mode: this._config.bsfai_style || this._hass.themes?.darkMode ? "dark" : "light" },
      series,
      colors: meta.map((m) => m.color),
      stroke: {
        width: meta.map((m) => (m.kind === "class" ? 3 : m.kind === "line" ? (m.dash === 14 ? 2 : 3) : 0)),
        dashArray: meta.map((m) => (m.kind === "line" ? m.dash : 0)),
        curve: meta.map((m) => (m.kind === "marker" ? "straight" : "stepline")),
      },
      // BSFAI-Stil: flache, halbtransparente Flaechen wie im BSFAI-Dashboard - ein
      // Verlauf wirkt auf dem dunklen Grund trueb.
      fill: this._config.bsfai_style
        ? {
          type: "solid",
          opacity: meta.map((m) => (m.kind === "band" ? 0.85 : m.kind === "class" ? 0.36 : 1)),
        }
        : {
          type: meta.map((m) => (m.kind === "class" ? "gradient" : "solid")),
          opacity: meta.map((m) => (m.kind === "band" ? 0.85 : isArea(m) ? 1 : 1)),
          gradient: { shade: "light", type: "vertical", shadeIntensity: 0.15, opacityFrom: 0.55, opacityTo: 0.05, stops: [0, 100] },
        },
      plotOptions: { bar: { columnWidth: "6%" } },
      dataLabels: { enabled: false },
      markers: { size: 0, hover: { size: 3 }, showNullDataPoints: false },
      legend: { show: false },
      grid: { borderColor: this._config.bsfai_style ? "#34383d" : "rgba(144,164,174,.35)", xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
      xaxis: { type: "datetime", labels: { datetimeUTC: false }, tooltip: { enabled: false } },
      tooltip: { shared: true, intersect: false, custom: ({ dataPointIndex }) => this._tooltip(dataPointIndex) },
      ...this._dynamicOptions(V, meta),
    };
    const chart = new globalThis.ApexCharts(el, options);
    this._chart = chart;
    this._resizeTarget = el;
    // Scheitert der Aufbau, das halbe Objekt verwerfen - sonst wirft jede
    // spaetere Aktualisierung (forceYAxisUpdate) und das Diagramm kommt nie.
    chart.render().catch((err) => {
      if (this._chart === chart) this._chart = null;
      console.warn("smartflow-preisampel: Diagramm-Aufbau fehlgeschlagen, neuer Versuch folgt", err);
    });
    this._observe();
  }

  /* ApexCharts misst seine Breite nur beim Aufbau. Sitzt die Karte da noch
   * nicht fertig im Layout, bleibt das Diagramm zu schmal. Deshalb bei jeder
   * Groessenaenderung nachziehen - das haelt es auch beim Fensterziehen mit. */
  _observe() {
    if (this._ro) this._ro.disconnect();
    let last = 0;
    this._ro = new ResizeObserver((entries) => {
      const width = Math.floor(entries[0].contentRect.width);
      if (!this._chart || !width || Math.abs(width - last) < 2) return;
      last = width;
      this._chart.updateOptions({ chart: { width } }, false, false, false);
    });
    this._ro.observe(this._resizeTarget);
  }

  _tooltip(i) {
    const V = this._V;
    const t = this._t();
    if (!V || i === null || i === undefined || i < 0 || i >= V.n) return "";
    const d = new Date(V.t0 + i * V.step);
    const z = (n) => String(n).padStart(2, "0");
    const k = V.cls[i];
    const charge = k === "b" || k === "l";
    const discharge = k === "h" || k === "p" || k === "x";
    const row = (label, value, color, extra) =>
      `<div style="display:flex;gap:12px;justify-content:space-between;${extra || ""}${color ? `color:${color};font-weight:600;` : "opacity:.75;"}"><span>${label}</span><span style="font-variant-numeric:tabular-nums;white-space:nowrap;">${value}</span></div>`;
    let html = `<div style="padding:8px 11px;line-height:1.6;min-width:210px;max-width:320px;white-space:normal;color:var(--primary-text-color);background:var(--card-background-color);">`
      + `<div style="opacity:.65;font-size:.9em;">${t.days[d.getDay()]} ${z(d.getDate())}.${z(d.getMonth() + 1)}. ${z(d.getHours())}:${z(d.getMinutes())}${V.sim ? ` · ${t.simulation}` : ""}</div>`
      + `<div style="display:flex;gap:12px;justify-content:space-between;font-weight:600;"><span>${t.price} <span style="color:${this._c(k)};">${t.classes[k]}</span></span><span style="font-variant-numeric:tabular-nums;">${this._fmt(V.p[i], V.unit)}</span></div>`
      + row(t.valley, this._fmt(V.valley[i], V.unit), charge ? this._c("act_c") : null)
      + row(t.effective, this._fmt(V.effective[i], V.unit), discharge ? this._c("act_d") : null);
    if (V.costOut !== null) {
      const sep = "border-top:1px solid rgba(127,127,127,.3);margin-top:5px;padding-top:5px;";
      const m = V.p[i] - V.costOut;
      const pct = (x) => `${Math.round(x * 100)} %`;
      html += row(t.cost, this._fmt(V.costOut, V.unit), null, sep)
        + `<div style="opacity:.65;font-size:.85em;">${V.eff ? t.cost_eff(this._fmt(V.avg, V.unit), pct(V.eff)) : t.cost_no_eff(this._fmt(V.avg, V.unit))}</div>`
        + `<div style="display:flex;gap:12px;justify-content:space-between;font-weight:600;"><span>${t.margin_now}</span><span style="font-variant-numeric:tabular-nums;color:${this._marginColor(m)};">${this._fmtSigned(m, V.unit)}</span></div>`;
    }
    const act = this._config.show_history ? this._act : null;
    if (act && i <= V.nowIndex) {
      const a = act.states[i];
      const sep = "border-top:1px solid rgba(127,127,127,.3);margin-top:5px;padding-top:5px;";
      if (act.soc[i] !== null && act.soc[i] !== undefined) html += row(t.soc, `${Math.round(act.soc[i])} %`, null, sep);
      if (a && a !== "-") html += row(t.did, t.act[a], this._c(`act_${a}`), act.soc[i] == null ? sep : "");
      if (act.reasons[i]) html += `<div style="opacity:.75;font-size:.9em;">${act.reasons[i]}</div>`;
    }
    return `${html}</div>`;
  }

  /* Verlauf: was BSFAI getan hat, aus der normalen HA-Historie */
  async _loadHistory() {
    const st = this._state();
    const L = st?.attributes?.ladder;
    const ents = st?.attributes?.entities || {};
    if (!L || !L.n || !ents.ai_status) return;
    const ids = [ents.ai_status, ents.decision_reason, ents.soc].filter(Boolean);
    const t0 = Date.parse(L.start);
    const step = (L.step_min || 15) * 60000;
    let result;
    try {
      result = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: new Date(t0 - 6 * 3600 * 1000).toISOString(),
        end_time: new Date().toISOString(),
        entity_ids: ids,
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
    } catch (err) {
      return;
    }
    const points = (id) => (result[id] || []).map((e) => ({ t: (e.lc ?? e.lu) * 1000, s: e.s }));
    const status = points(ents.ai_status);
    const reason = ents.decision_reason ? points(ents.decision_reason) : [];
    const soc = ents.soc ? points(ents.soc) : [];
    const reasonState = ents.decision_reason && this._hass.states[ents.decision_reason];
    const label = (raw) => {
      if (!raw || raw === "unknown" || raw === "unavailable") return "";
      try { return reasonState && this._hass.formatEntityState ? this._hass.formatEntityState(reasonState, raw) : raw; }
      catch (e) { return raw; }
    };
    const at = (list, when) => {
      let found = null;
      for (const p of list) { if (p.t <= when) found = p; else break; }
      return found;
    };
    const states = [], reasons = [], socs = [];
    for (let i = 0; i < L.n; i++) {
      const mid = t0 + i * step + step / 2;
      if (mid > Date.now()) { states.push(null); reasons.push(""); socs.push(null); continue; }
      const s = at(status, mid);
      states.push(s ? (AI_STATUS_ACT[s.s] || "-") : "-");
      const r = at(reason, mid);
      reasons.push(r ? label(r.s) : "");
      const c = at(soc, mid);
      const v = c ? parseFloat(c.s) : NaN;
      socs.push(isNaN(v) ? null : v);
    }
    this._act = { states, reasons, soc: socs };
    this._update();
  }

  /* Simulator */
  _regulators() {
    const ents = this._state()?.attributes?.entities || {};
    return [
      { key: "discount", entity: ents.valley_factor, label: this._t().discount },
      { key: "markup", entity: ents.peak_factor, label: this._t().markup },
      { key: "margin", entity: ents.profit_margin_pct, label: this._t().margin },
      { key: "very_cheap", entity: ents.very_cheap_price, label: this._t().very_cheap },
      { key: "very_expensive", entity: ents.very_expensive_threshold, label: this._t().very_expensive },
    ];
  }

  _setupSimulator() {
    const box = this.shadowRoot.querySelector(".sim");
    if (!this._config.show_simulator) return;
    const regs = this._regulators();
    if (regs.some((r) => !r.entity || !this._hass.states[r.entity])) return;
    box.hidden = false;
    this._sim = { on: false };
    const rows = box.querySelector(".rows");
    rows.innerHTML = "";
    for (const r of regs) {
      const st = this._hass.states[r.entity];
      const a = st.attributes;
      const row = document.createElement("div");
      row.className = "row";
      row.innerHTML = `<span></span><input type="range"><span class="val"></span>`;
      row.firstChild.textContent = r.label;
      const input = row.querySelector("input");
      input.min = a.min; input.step = a.step || 1;
      // Sehr weite Bereiche (Marge bis 1000 %) waeren am Schieber unbedienbar.
      input.max = r.key === "margin" ? Math.min(a.max, 200) : a.max;
      input.dataset.key = r.key;
      input.addEventListener("input", () => {
        this._optNote = null;
        this._sim[r.key] = parseFloat(input.value);
        this._showValue(r.key);
        this._markDirty();
        this._update();
      });
      rows.appendChild(row);
    }
    const sw = box.querySelector(".sim-switch");
    sw.addEventListener("change", () => {
      this._sim.on = sw.checked;
      rows.classList.toggle("disabled", !this._sim.on);
      if (this._sim.on) this._syncSimulatorFromReal(true);
      this._markDirty();
      this._update();
    });
    box.querySelector(".reset").addEventListener("click", () => {
      this._optNote = null;
      this._syncSimulatorFromReal(true);
      this._markDirty();
      this._update();
    });
    box.querySelector(".apply").addEventListener("click", () => this._apply());
    box.querySelector(".optimize").addEventListener("click", () => this._optimize());
    this._syncSimulatorFromReal(true);
    // Standard: Simulator an. Solange niemand schiebt, stehen die Schieber auf
    // den echten Werten - das Bild ist dann identisch mit dem echten.
    this._sim.on = this._config.simulation_on !== false;
    sw.checked = this._sim.on;
    rows.classList.toggle("disabled", !this._sim.on);
  }

  _real(key) {
    const r = this._regulators().find((x) => x.key === key);
    const v = r && this._hass.states[r.entity] ? parseFloat(this._hass.states[r.entity].state) : NaN;
    return isNaN(v) ? null : v;
  }

  /* Solange der Nutzer nicht schiebt, folgen die Schieber den echten Werten. */
  _syncSimulatorFromReal(force) {
    if (!this._sim) return;
    if (!force && this._sim.on && this._sim.touched) return;
    for (const r of this._regulators()) {
      const v = this._real(r.key);
      if (v === null) continue;
      this._sim[r.key] = v;
      const input = this.shadowRoot.querySelector(`input[data-key="${r.key}"]`);
      if (input) input.value = v;
      this._showValue(r.key);
    }
    if (force) this._sim.touched = false;
  }

  _showValue(key) {
    const input = this.shadowRoot.querySelector(`input[data-key="${key}"]`);
    if (!input) return;
    const r = this._regulators().find((x) => x.key === key);
    const unit = this._hass.states[r.entity]?.attributes?.unit_of_measurement || "";
    const v = this._sim[key];
    const digits = (String(input.step).split(".")[1] || "").length;
    let text = `${Number(v).toFixed(digits)} ${unit}`;
    if (key === "margin") {
      // Einstellhilfe: was die Prozente in Geld bedeuten. BSFAI schlaegt die
      // Gewinnmarge beim Entladen auf den Ø Ladepreis auf, nicht auf den
      // aktuellen Strompreis (decision_engine._compute_economic_discharge_threshold).
      const L = this._state()?.attributes?.ladder;
      if (L && typeof L.avg_charge_price === "number") {
        text += ` · ${this._fmt(L.avg_charge_price * v / 100, this._unit(L.currency))}`;
      }
    }
    input.parentElement.querySelector(".val").textContent = text;
  }

  _markDirty() {
    const dirty = this._sim.on && this._regulators().some((r) => this._real(r.key) !== this._sim[r.key]);
    this._sim.touched = dirty;
    this.shadowRoot.querySelector(".apply").disabled = !dirty;
    this.shadowRoot.querySelector(".reset").disabled = !dirty;
  }

  async _apply() {
    const t = this._t();
    if (!confirm(t.apply_confirm)) return;
    for (const r of this._regulators()) {
      if (this._real(r.key) === this._sim[r.key]) continue;
      await this._hass.callService("number", "set_value", { entity_id: r.entity, value: this._sim[r.key] });
    }
    this._sim.touched = false;
    this._markDirty();
    this._message(t.applied, "info");
    setTimeout(() => this._message("", "info"), 4000);
  }
}

class SmartflowPreisampelCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._draw();
  }

  set hass(hass) {
    this._hass = hass;
    this._draw();
  }

  _draw() {
    if (!this._hass || !this._config) return;
    const T = TEXT[lang(this._hass)];
    const t = T.editor;
    const labels = { ...t, ...T.classes };
    for (const key of LINE_ORDER) labels[key] = T[key];
    for (const k of ACT_ORDER) labels[`act_${k}`] = `${T.did}: ${T.act[k]}`;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (schema) => labels[schema.name] || schema.name;
      this._form.addEventListener("value-changed", (ev) => {
        this._config = this._clean(ev.detail.value, this._config);
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    // Der Farbwaehler zeigt immer die wirksame Farbe, also Standard (des
    // gewaehlten Stils) oder eigene.
    const base = palette(this._config.bsfai_style);
    const colors = {};
    for (const key of Object.keys(DEFAULT_COLORS)) {
      const own = (this._config.colors || {})[key];
      colors[key] = Array.isArray(own) ? own : fromHex(toHex(own) || base[key]);
    }
    const color = (name) => ({ name, selector: { color_rgb: {} } });
    this._form.hass = this._hass;
    this._form.data = { height: 420, show_history: true, show_simulator: true, simulation_on: true, ...this._config, colors };
    this._form.schema = [
      { name: "entity", required: true, selector: { entity: { filter: { integration: "smartflow_preisampel", domain: "sensor" } } } },
      { name: "title", selector: { text: {} } },
      { name: "height", selector: { number: { min: 250, max: 900, step: 10, mode: "box", unit_of_measurement: "px" } } },
      { name: "bsfai_style", selector: { boolean: {} } },
      { name: "show_history", selector: { boolean: {} } },
      { name: "show_simulator", selector: { boolean: {} } },
      { name: "simulation_on", selector: { boolean: {} } },
      {
        type: "expandable", name: "colors", title: t.colors, icon: "mdi:palette",
        schema: [...CLASS_ORDER, ...LINE_ORDER, ...ACT_ORDER.map((k) => `act_${k}`)].map(color),
      },
    ];
  }

  /* Nur Farben speichern, die vom Standard abweichen - sonst stuende nach jeder
   * Aenderung die komplette Farbtabelle in der Kartenkonfiguration.
   * Beim Umschalten des Stils liefert das Formular noch die Standardfarben des
   * ALTEN Stils mit; die sind keine eigenen Farben und fallen ebenfalls weg. */
  _clean(config, previous) {
    const out = { ...config };
    const own = {};
    const now = palette(config.bsfai_style);
    const before = palette(previous?.bsfai_style);
    for (const [key, value] of Object.entries(config.colors || {})) {
      const hex = toHex(value);
      if (hex && hex.toLowerCase() !== now[key] && hex.toLowerCase() !== before[key]) own[key] = hex;
    }
    if (Object.keys(own).length) out.colors = own; else delete out.colors;
    return out;
  }
}

/*
 * Registrierung erst, wenn das HA-Frontend steht.
 *
 * Die Integration laedt diese Datei als extra_module_url - sie kommt damit oft
 * VOR dem HA-Kern an. Der Kern installiert beim Start einen Polyfill fuer
 * "scoped custom element registries", der window.customElements durch eine
 * eigene Registry ersetzt. Was vorher definiert wurde, kennt deren get() nicht:
 * HA meldet dann "Custom element doesn't exist", obwohl die Klasse nativ
 * registriert ist - je nach Ladereihenfolge bei jedem 2. bis 4. Laden.
 * Sobald "home-assistant" in der (dann gueltigen) Registry steht, ist der
 * Polyfill sicher aktiv. Nach 15 s wird trotzdem registriert, damit die Karte
 * auch ausserhalb der normalen HA-Oberflaeche funktioniert.
 */
function register() {
  if (!customElements.get(CARD)) customElements.define(CARD, SmartflowPreisampelCard);
  if (!customElements.get(EDITOR)) customElements.define(EDITOR, SmartflowPreisampelCardEditor);
  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === CARD)) {
    window.customCards.push({
      type: CARD,
      name: "SmartFlow Preisampel",
      description: "Price levels, thresholds and decisions of Battery SmartFlow AI, with simulator.",
      preview: false,
    });
  }
  console.info(`%c SMARTFLOW-PREISAMPEL %c v${VERSION} `, "background:#16a34a;color:#fff;border-radius:3px 0 0 3px", "background:#334155;color:#fff;border-radius:0 3px 3px 0");
}

(function waitForFrontend(started) {
  if (window.customElements.get("home-assistant") || Date.now() - started > 15000) {
    register();
    return;
  }
  setTimeout(() => waitForFrontend(started), 25);
})(Date.now());
