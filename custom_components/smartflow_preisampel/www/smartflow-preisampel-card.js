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

const VERSION = "0.1.0";
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
    editor: { entity: "Preisampel-Sensor", title: "Titel", height: "Höhe", show_history: "Verlauf anzeigen (was BSFAI getan hat)", show_simulator: "Simulator anzeigen" },
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
    editor: { entity: "Price traffic light sensor", title: "Title", height: "Height", show_history: "Show history (what BSFAI did)", show_simulator: "Show simulator" },
    days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  },
};

const CLASS_ORDER = ["b", "l", "m", "h", "p", "x"];
const CLASS_COLOR = { b: "#15803d", l: "#22c55e", m: "#eab308", h: "#f97316", p: "#ef4444", x: "#991b1b" };
const LINE_COLOR = { valley: "#1d4ed8", effective: "#7c3aed", peak: "#334155", very_expensive: "#be123c", very_cheap: "#047857" };
const ACT_ORDER = ["c", "d", "i"];
const ACT_COLOR = { c: "#16a34a", d: "#ea580c", i: "#94a3b8" };
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
    this._config = { height: 420, show_history: true, show_simulator: true, ...config };
    this._built = false;
    if (this._hass) this._render();
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

  connectedCallback() {
    if (this._chart && this._resizeTarget) this._observe();
  }

  disconnectedCallback() {
    if (this._ro) { this._ro.disconnect(); this._ro = null; }
    if (this._historyTimer) { clearInterval(this._historyTimer); this._historyTimer = null; }
  }

  async _render() {
    const t = this._t();
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { display: block; padding: 12px 12px 8px; }
        .head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .title { font-size: 1.2em; font-weight: 500; }
        .now { color: var(--secondary-text-color); font-size: .95em; }
        .warn { margin: 8px 0; padding: 8px 10px; border-radius: 8px; background: rgba(234,88,12,.12); color: var(--primary-text-color); border-left: 4px solid #ea580c; }
        .info { margin: 8px 0; padding: 8px 10px; border-radius: 8px; background: rgba(29,78,216,.10); border-left: 4px solid #1d4ed8; }
        .legend { display: flex; flex-wrap: wrap; gap: 4px 12px; margin: 8px 0 2px; font-size: .9em; }
        .legend span { display: inline-flex; align-items: center; gap: 5px; cursor: pointer; user-select: none; }
        .legend span.off { opacity: .35; }
        .legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; }
        .legend i.line { height: 3px; border-radius: 0; }
        #chart { width: 100%; min-height: 50px; }
        .sim { border-top: 1px solid var(--divider-color); margin-top: 6px; padding-top: 8px; }
        .sim-head { display: flex; align-items: center; gap: 10px; font-weight: 500; }
        .sim-hint { color: var(--secondary-text-color); font-size: .9em; margin: 4px 0 6px; }
        .row { display: grid; grid-template-columns: minmax(130px, 1fr) 3fr 90px; gap: 10px; align-items: center; margin: 4px 0; }
        .row input[type=range] { width: 100%; accent-color: var(--primary-color); }
        .row .val { text-align: right; font-variant-numeric: tabular-nums; }
        .buttons { display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px; flex-wrap: wrap; }
        button { font: inherit; padding: 6px 14px; border-radius: 18px; border: 1px solid var(--divider-color); background: var(--card-background-color); color: var(--primary-text-color); cursor: pointer; }
        button.primary { background: var(--primary-color); color: var(--text-primary-color, #fff); border-color: var(--primary-color); }
        button:disabled { opacity: .4; cursor: default; }
        .rows.disabled { opacity: .45; pointer-events: none; }
      </style>
      <ha-card>
        <div class="head"><div class="title"></div><div class="now"></div></div>
        <div class="msg"></div>
        <div class="legend"></div>
        <div id="chart"></div>
        <div class="sim" hidden>
          <div class="sim-head"><ha-switch class="sim-switch"></ha-switch><span>${t.simulation}</span></div>
          <div class="sim-hint">${t.sim_hint}</div>
          <div class="rows disabled"></div>
          <div class="buttons">
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
      this._historyTimer = setInterval(() => this._loadHistory(), 5 * 60 * 1000);
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
      v = { p: L.p, ...ladder(L.p, s), very_cheap: s.very_cheap, very_expensive: s.very_expensive, sim: true };
    }
    const t0 = Date.parse(L.start);
    const step = (L.step_min || 15) * 60000;
    const nowIndex = Math.min(L.n - 1, Math.max(-1, Math.floor((Date.now() - t0) / step)));
    return { ...v, n: L.n, t0, step, unit, nowIndex, currency: L.currency };
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
    const nowText = this.shadowRoot.querySelector(".now");
    nowText.textContent = nowCls
      ? `${t.now}: ${t.classes[nowCls]} · ${this._fmt(V.p[V.nowIndex], V.unit)}${V.sim ? ` · ${t.simulation}` : ""}`
      : "";

    const { series, meta } = this._series(V);
    this._meta = meta;
    this._legend(V, meta);
    if (!this._chart) this._create(series, V);
    else {
      this._chart.updateOptions(this._dynamicOptions(V, meta), false, false, false);
      this._chart.updateSeries(series, false);
    }
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
      meta.push({ kind: "class", key: k, color: CLASS_COLOR[k], label: t.classes[k], count: counts[k] });
    }
    for (const key of ["valley", "effective", "peak"]) {
      series.push({ name: key, type: "line", data: V[key].map((v, i) => [x(i), v * f]) });
      meta.push({ kind: "line", key, color: LINE_COLOR[key], label: t[key], dash: 7 });
    }
    for (const key of ["very_expensive", "very_cheap"]) {
      const val = V[key] > 0 ? V[key] * f : null;
      series.push({ name: key, type: "line", data: V.p.map((_, i) => [x(i), val]) });
      meta.push({ kind: "line", key, color: LINE_COLOR[key], label: t[key], dash: 14, hideIfEmpty: val === null });
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
      meta.push({ kind: "band", key: k, color: ACT_COLOR[k], label: `${t.did}: ${t.act[k]}`, count, hideIfEmpty: !act });
    }
    series.push({
      name: "changes", type: "column",
      data: V.p.map((v, i) => {
        const on = act && i > 0 && i <= V.nowIndex && act.states[i] && act.states[i - 1]
          && act.states[i] !== "-" && act.states[i - 1] !== "-" && act.states[i] !== act.states[i - 1];
        return [x(i), on ? v * f : null];
      }),
    });
    meta.push({ kind: "marker", key: "changes", color: MARKER_COLOR, label: "", hideIfEmpty: true });
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
      theme: { mode: this._hass.themes?.darkMode ? "dark" : "light" },
      series,
      colors: meta.map((m) => m.color),
      stroke: {
        width: meta.map((m) => (m.kind === "class" ? 3 : m.kind === "line" ? (m.dash === 14 ? 2 : 3) : 0)),
        dashArray: meta.map((m) => (m.kind === "line" ? m.dash : 0)),
        curve: meta.map((m) => (m.kind === "marker" ? "straight" : "stepline")),
      },
      fill: {
        type: meta.map((m) => (m.kind === "class" ? "gradient" : "solid")),
        opacity: meta.map((m) => (m.kind === "band" ? 0.85 : isArea(m) ? 1 : 1)),
        gradient: { shade: "light", type: "vertical", shadeIntensity: 0.15, opacityFrom: 0.55, opacityTo: 0.05, stops: [0, 100] },
      },
      plotOptions: { bar: { columnWidth: "6%" } },
      dataLabels: { enabled: false },
      markers: { size: 0, hover: { size: 3 }, showNullDataPoints: false },
      legend: { show: false },
      grid: { borderColor: "rgba(144,164,174,.35)", xaxis: { lines: { show: false } }, yaxis: { lines: { show: true } } },
      xaxis: { type: "datetime", labels: { datetimeUTC: false }, tooltip: { enabled: false } },
      tooltip: { shared: true, intersect: false, custom: ({ dataPointIndex }) => this._tooltip(dataPointIndex) },
      ...this._dynamicOptions(V, meta),
    };
    this._chart = new globalThis.ApexCharts(el, options);
    this._chart.render();
    this._resizeTarget = el;
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
      `<div style="display:flex;gap:12px;justify-content:space-between;${extra || ""}${color ? `color:${color};font-weight:600;` : "opacity:.75;"}"><span>${label}</span><span style="font-variant-numeric:tabular-nums;">${value}</span></div>`;
    let html = `<div style="padding:8px 11px;line-height:1.6;min-width:210px;max-width:320px;white-space:normal;color:var(--primary-text-color);background:var(--card-background-color);">`
      + `<div style="opacity:.65;font-size:.9em;">${t.days[d.getDay()]} ${z(d.getDate())}.${z(d.getMonth() + 1)}. ${z(d.getHours())}:${z(d.getMinutes())}${V.sim ? ` · ${t.simulation}` : ""}</div>`
      + `<div style="display:flex;gap:12px;justify-content:space-between;font-weight:600;"><span>${t.price} <span style="color:${CLASS_COLOR[k]};">${t.classes[k]}</span></span><span style="font-variant-numeric:tabular-nums;">${this._fmt(V.p[i], V.unit)}</span></div>`
      + row(t.valley, this._fmt(V.valley[i], V.unit), charge ? ACT_COLOR.c : null)
      + row(t.effective, this._fmt(V.effective[i], V.unit), discharge ? ACT_COLOR.d : null);
    const act = this._config.show_history ? this._act : null;
    if (act && i <= V.nowIndex) {
      const a = act.states[i];
      const sep = "border-top:1px solid rgba(127,127,127,.3);margin-top:5px;padding-top:5px;";
      if (act.soc[i] !== null && act.soc[i] !== undefined) html += row(t.soc, `${Math.round(act.soc[i])} %`, null, sep);
      if (a && a !== "-") html += row(t.did, t.act[a], ACT_COLOR[a], act.soc[i] == null ? sep : "");
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
      this._syncSimulatorFromReal(true);
      this._markDirty();
      this._update();
    });
    box.querySelector(".apply").addEventListener("click", () => this._apply());
    this._syncSimulatorFromReal(true);
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
    input.parentElement.querySelector(".val").textContent = `${Number(v).toFixed(digits)} ${unit}`;
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
    const t = TEXT[lang(this._hass)].editor;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (schema) => t[schema.name] || schema.name;
      this._form.addEventListener("value-changed", (ev) => {
        this._config = ev.detail.value;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = { height: 420, show_history: true, show_simulator: true, ...this._config };
    this._form.schema = [
      { name: "entity", required: true, selector: { entity: { filter: { integration: "smartflow_preisampel", domain: "sensor" } } } },
      { name: "title", selector: { text: {} } },
      { name: "height", selector: { number: { min: 250, max: 900, step: 10, mode: "box", unit_of_measurement: "px" } } },
      { name: "show_history", selector: { boolean: {} } },
      { name: "show_simulator", selector: { boolean: {} } },
    ];
  }
}

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
