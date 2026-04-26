/*!
 * Venetian Blinds Card
 * Tilt-focused custom card for Home Assistant
 * https://github.com/Thoky81/ha-venetian-blinds-card
 * License: MIT
 */

const VERSION = "0.1.4";

const LIT_HOST_TAGS = ["ha-panel-lovelace", "hui-view", "home-assistant-main"];
function findLitElement() {
  for (const tag of LIT_HOST_TAGS) {
    const el = customElements.get(tag);
    if (el) return Object.getPrototypeOf(el);
  }
  throw new Error(
    "venetian-blinds-card: could not locate LitElement base from Home Assistant"
  );
}
const LitElement = findLitElement();
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

const DEFAULT_PRESETS = [
  { name: "Up", tilt: 0 },
  { name: "Open", tilt: 50 },
  { name: "¼ Dn", tilt: 75 },
  { name: "Down", tilt: 100 },
];

const MAX_PRESETS = 6;


const TILT_TOLERANCE = 5;

function clampTilt(t) {
  const n = Number(t);
  if (Number.isNaN(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

class VenetianBlindsCard extends LitElement {
  static get properties() {
    return { hass: {}, _config: {} };
  }

  static getConfigElement() {
    return document.createElement("venetian-blinds-card-editor");
  }

  static getStubConfig(hass, entities) {
    const covers = (entities || []).filter((e) => e.startsWith("cover."));
    return {
      type: "custom:venetian-blinds-card",
      title: "Blinds",
      layout: "cards",
      blinds: covers.slice(0, 3).map((entity) => ({ entity })),
      presets: DEFAULT_PRESETS,
    };
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    if (!Array.isArray(config.blinds) || config.blinds.length === 0) {
      throw new Error("You must define at least one blind in 'blinds'");
    }
    for (const b of config.blinds) {
      if (!b || typeof b.entity !== "string" || !b.entity.startsWith("cover.")) {
        throw new Error("Each blind must have an 'entity' starting with 'cover.'");
      }
    }
    const validLayouts = ["cards", "list", "segmented"];
    const layout = validLayouts.includes(config.layout) ? config.layout : "cards";
    const presets =
      Array.isArray(config.presets) && config.presets.length > 0
        ? config.presets
            .slice(0, MAX_PRESETS)
            .map((p) => ({
              name: String(p.name ?? ""),
              tilt: clampTilt(p.tilt),
            }))
        : DEFAULT_PRESETS;
    const bp = Number(config.responsive_breakpoint);
    const responsive_breakpoint = Number.isFinite(bp) && bp >= 0 ? bp : 320;
    this._config = {
      title: typeof config.title === "string" ? config.title : "",
      layout,
      blinds: config.blinds.map((b) => ({
        entity: b.entity,
        name: typeof b.name === "string" ? b.name : "",
      })),
      presets,
      responsive_breakpoint,
    };
  }

  getCardSize() {
    const n = this._config?.blinds?.length || 0;
    if (this._config?.layout === "list") return Math.max(1, Math.ceil(n / 2));
    return 1 + n;
  }

  getLayoutOptions() {
    const n = this._config?.blinds?.length || 1;
    if (this._config?.layout === "list") {
      return { grid_columns: 4, grid_rows: Math.max(2, Math.ceil(n / 2) + 1) };
    }
    return { grid_columns: 4, grid_rows: 1 + n * 2 };
  }

  _setTilt(entity, tilt) {
    if (!this.hass) return;
    this.hass.callService("cover", "set_cover_tilt_position", {
      entity_id: entity,
      tilt_position: tilt,
    });
  }

  _activePresetIndex(currentTilt) {
    if (currentTilt == null) return -1;
    let bestIdx = -1;
    let bestDist = TILT_TOLERANCE + 1;
    this._config.presets.forEach((p, i) => {
      const d = Math.abs(p.tilt - currentTilt);
      if (d <= TILT_TOLERANCE && d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    });
    return bestIdx;
  }

  _statusText(state, tilt) {
    if (!state) return "Unknown";
    if (state.state === "unavailable") return "Unavailable";
    if (tilt == null) return state.state;
    const idx = this._activePresetIndex(tilt);
    if (idx >= 0) return `${this._config.presets[idx].name} · ${tilt}%`;
    return `Tilt ${tilt}%`;
  }

  _tiltIcon(tilt) {
    const o = ((clampTilt(tilt) - 50) / 50) * 3;
    const y = (base) => ({ l: (base - o).toFixed(2), r: (base + o).toFixed(2) });
    const a = y(8), b = y(13), c = y(18);
    return html`
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
        <path d="M4 ${a.l} L20 ${a.r}"></path>
        <path d="M4 ${b.l} L20 ${b.r}"></path>
        <path d="M4 ${c.l} L20 ${c.r}"></path>
      </svg>
    `;
  }

  _renderListRow(blind) {
    const state = this.hass.states[blind.entity];
    const tilt = state?.attributes?.current_tilt_position;
    const name = blind.name || state?.attributes?.friendly_name || blind.entity;
    const activeIdx = this._activePresetIndex(tilt);
    const status = this._statusText(state, tilt);
    const disabled = !state || state.state === "unavailable";

    return html`
      <div class="row ${disabled ? "disabled" : ""}">
        <div class="row-label">
          <div class="row-name">${name}</div>
          <div class="row-state">${status}</div>
        </div>
        <div class="chips">
          ${this._config.presets.map(
            (p, i) => html`
              <button
                class="chip ${i === activeIdx ? "active" : ""}"
                title="${p.name} (${p.tilt}%)"
                ?disabled=${disabled}
                @click=${() => this._setTilt(blind.entity, p.tilt)}
              >
                ${this._tiltIcon(p.tilt)}
              </button>
            `
          )}
        </div>
      </div>
    `;
  }

  _renderSegmentedRow(blind) {
    const state = this.hass.states[blind.entity];
    const tilt = state?.attributes?.current_tilt_position;
    const name = blind.name || state?.attributes?.friendly_name || blind.entity;
    const activeIdx = this._activePresetIndex(tilt);
    const status = this._statusText(state, tilt);
    const disabled = !state || state.state === "unavailable";

    return html`
      <div class="seg-block ${disabled ? "disabled" : ""}">
        <div class="seg-top">
          <div class="seg-name-area">
            <span class="seg-dot"></span>
            <span class="seg-name">${name}</span>
          </div>
          <span class="seg-pill">${status}</span>
        </div>
        <div class="seg-bar">
          ${this._config.presets.map(
            (p, i) => html`
              <button
                class="seg-btn ${i === activeIdx ? "active" : ""}"
                title="${p.name} (${p.tilt}%)"
                ?disabled=${disabled}
                @click=${() => this._setTilt(blind.entity, p.tilt)}
              >
                ${this._tiltIcon(p.tilt)}
                <span class="seg-label">${p.name}</span>
              </button>
            `
          )}
        </div>
      </div>
    `;
  }

  _renderBlindCard(blind) {
    const state = this.hass.states[blind.entity];
    const tilt = state?.attributes?.current_tilt_position;
    const name = blind.name || state?.attributes?.friendly_name || blind.entity;
    const activeIdx = this._activePresetIndex(tilt);
    const status = this._statusText(state, tilt);
    const disabled = !state || state.state === "unavailable";
    const cols = this._config.presets.length;

    return html`
      <div class="blind-card ${disabled ? "disabled" : ""}">
        <div class="blind-card-top">
          <div class="icon-circle">
            <ha-icon icon="mdi:blinds-horizontal"></ha-icon>
          </div>
          <div class="blind-info">
            <div class="blind-name">${name}</div>
            <div class="blind-status">${status}</div>
          </div>
        </div>
        <div class="preset-grid" style="grid-template-columns: repeat(${cols}, minmax(0, 1fr));">
          ${this._config.presets.map(
            (p, i) => html`
              <button
                class="preset ${i === activeIdx ? "active" : ""}"
                title="${p.name} (${p.tilt}%)"
                ?disabled=${disabled}
                @click=${() => this._setTilt(blind.entity, p.tilt)}
              >
                ${this._tiltIcon(p.tilt)}
                <span class="preset-label">${p.name}</span>
              </button>
            `
          )}
        </div>
      </div>
    `;
  }

  _responsiveStyleText() {
    const bp = this._config.responsive_breakpoint;
    if (!bp || bp <= 0) return "";
    return `
      @container vbcard (max-width: ${bp}px) {
        .content { padding-left: 12px; padding-right: 12px; }

        .list .row {
          flex-direction: column;
          align-items: stretch;
          gap: 8px;
        }
        .list .chips {
          justify-content: flex-start;
          flex-wrap: wrap;
        }

        .cards .preset-label { display: none; }
        .cards .preset {
          padding: 10px 2px;
          gap: 0;
        }

        .segmented .seg-label { display: none; }
        .segmented .seg-btn {
          padding: 8px 0;
          gap: 0;
        }
      }
      @container vbcard (max-width: ${Math.round(bp * 0.65)}px) {
        .segmented .seg-top {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
        }
      }
    `;
  }

  render() {
    if (!this._config || !this.hass) return html``;
    const layout = this._config.layout;
    const renderers = {
      list: (b) => this._renderListRow(b),
      segmented: (b) => this._renderSegmentedRow(b),
      cards: (b) => this._renderBlindCard(b),
    };
    const renderer = renderers[layout] || renderers.cards;
    return html`
      <ha-card>
        <style>${this._responsiveStyleText()}</style>
        ${this._config.title
          ? html`<div class="card-header">${this._config.title}</div>`
          : ""}
        <div class="content ${layout}">
          ${this._config.blinds.map(renderer)}
        </div>
      </ha-card>
    `;
  }

  static get styles() {
    return css`
      :host { display: block; }
      ha-card {
        overflow: hidden;
        container-type: inline-size;
        container-name: vbcard;
      }

      .card-header {
        font-family: var(--ha-card-header-font-family, inherit);
        font-size: var(--ha-card-header-font-size, 18px);
        font-weight: 500;
        color: var(--ha-card-header-color, var(--primary-text-color));
        padding: 16px 16px 4px;
      }
      .content { padding: 8px 16px 16px; }

      svg { width: 22px; height: 22px; flex-shrink: 0; }

      /* ===== LIST LAYOUT ===== */
      .list .row {
        display: flex;
        align-items: center;
        padding: 12px 0;
        border-bottom: 1px solid var(--divider-color);
        gap: 12px;
      }
      .list .row:last-child { border-bottom: none; }
      .list .row.disabled { opacity: .5; }
      .list .row-label { flex: 1; min-width: 0; }
      .list .row-name {
        font-size: 15px;
        font-weight: 500;
        color: var(--primary-text-color);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .list .row-state {
        font-size: 12px;
        color: var(--secondary-text-color);
        margin-top: 2px;
      }
      .list .chips {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .list .chip {
        width: 36px; height: 36px;
        border-radius: 50%;
        border: 1px solid var(--divider-color);
        background: var(--card-background-color);
        color: var(--primary-text-color);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        transition: background-color .15s, border-color .15s, color .15s;
      }
      .list .chip:hover:not(:disabled) {
        border-color: var(--primary-color);
      }
      .list .chip.active {
        background: var(--primary-color);
        border-color: var(--primary-color);
        color: var(--text-primary-color, white);
      }
      .list .chip:disabled { cursor: not-allowed; }

      /* ===== CARDS LAYOUT ===== */
      .cards .blind-card {
        background: var(--ha-card-background, var(--card-background-color));
        border: 1px solid var(--divider-color);
        border-radius: 12px;
        padding: 12px;
        margin-bottom: 12px;
      }
      .cards .blind-card:last-child { margin-bottom: 0; }
      .cards .blind-card.disabled { opacity: .5; }
      .cards .blind-card-top {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .cards .icon-circle {
        width: 36px; height: 36px;
        border-radius: 50%;
        background: var(--secondary-background-color);
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--primary-color);
        flex-shrink: 0;
      }
      .cards .icon-circle ha-icon { --mdc-icon-size: 22px; }
      .cards .blind-info { flex: 1; min-width: 0; }
      .cards .blind-name {
        font-size: 14px;
        font-weight: 600;
        color: var(--primary-text-color);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .cards .blind-status {
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      .cards .preset-grid {
        display: grid;
        gap: 6px;
      }
      .cards .preset {
        background: var(--secondary-background-color);
        border: none;
        padding: 10px 4px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        font-size: 11px;
        color: var(--secondary-text-color);
        transition: background-color .15s, color .15s;
        min-width: 0;
      }
      .cards .preset:hover:not(:disabled) {
        background: var(--divider-color);
      }
      .cards .preset.active {
        background: var(--primary-color);
        color: var(--text-primary-color, white);
      }
      .cards .preset:disabled { cursor: not-allowed; }
      .cards .preset-label {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      /* ===== SEGMENTED LAYOUT (Design 4) ===== */
      .segmented .seg-block {
        padding: 14px 0;
        border-bottom: 1px solid var(--divider-color);
      }
      .segmented .seg-block:first-child { padding-top: 4px; }
      .segmented .seg-block:last-child {
        border-bottom: none;
        padding-bottom: 4px;
      }
      .segmented .seg-block.disabled { opacity: .5; }
      .segmented .seg-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        gap: 8px;
      }
      .segmented .seg-name-area {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
      }
      .segmented .seg-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: var(--primary-color);
        flex-shrink: 0;
      }
      .segmented .seg-name {
        font-weight: 500;
        font-size: 15px;
        color: var(--primary-text-color);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .segmented .seg-pill {
        font-size: 12px;
        color: var(--primary-color);
        font-weight: 600;
        white-space: nowrap;
        flex-shrink: 0;
      }
      .segmented .seg-bar {
        display: flex;
        gap: 4px;
        background: var(--secondary-background-color);
        padding: 4px;
        border-radius: 10px;
      }
      .segmented .seg-btn {
        flex: 1 1 0;
        min-width: 0;
        padding: 8px 4px;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        font-size: 11px;
        color: var(--secondary-text-color);
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 2px;
        transition: background-color .15s, color .15s, box-shadow .15s;
      }
      .segmented .seg-btn:disabled { cursor: not-allowed; }
      .segmented .seg-btn:hover:not(:disabled):not(.active) {
        color: var(--primary-text-color);
      }
      .segmented .seg-btn.active {
        background: var(--card-background-color);
        color: var(--primary-color);
        font-weight: 600;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
      }
      .segmented .seg-label {
        max-width: 100%;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `;
  }
}

/* ============================================================
 * Editor
 * ============================================================ */

class VenetianBlindsCardEditor extends LitElement {
  static get properties() {
    return { hass: {}, _config: {} };
  }

  setConfig(config) {
    this._config = config || {};
  }

  connectedCallback() {
    super.connectedCallback?.();
    this._ensureHelpers();
  }

  async _ensureHelpers() {
    if (customElements.get("ha-entity-picker")) return;
    if (typeof window.loadCardHelpers !== "function") return;
    try {
      const helpers = await window.loadCardHelpers();
      if (helpers?.createCardElement) {
        const tmp = await helpers.createCardElement({ type: "entities", entities: [] });
        if (tmp?.constructor?.getConfigElement) tmp.constructor.getConfigElement();
      }
    } catch (e) { /* best-effort */ }
    this.requestUpdate();
  }

  _emit(newConfig) {
    this._config = newConfig;
    this.dispatchEvent(
      new CustomEvent("config-changed", {
        detail: { config: newConfig },
        bubbles: true,
        composed: true,
      })
    );
  }

  _onTitle(e) {
    this._emit({ ...this._config, title: e.target.value });
  }

  _onLayout(e) {
    this._emit({ ...this._config, layout: e.target.value });
  }

  _onBreakpoint(e) {
    const v = parseInt(e.target.value, 10);
    this._emit({ ...this._config, responsive_breakpoint: Number.isFinite(v) ? Math.max(0, v) : 320 });
  }

  _onBlindEntity(idx, e) {
    const value = e.detail?.value ?? e.target?.value ?? "";
    const blinds = [...(this._config.blinds || [])];
    blinds[idx] = { ...blinds[idx], entity: value };
    this._emit({ ...this._config, blinds });
  }

  _onBlindName(idx, e) {
    const blinds = [...(this._config.blinds || [])];
    blinds[idx] = { ...blinds[idx], name: e.target.value };
    this._emit({ ...this._config, blinds });
  }

  _addBlind() {
    const blinds = [...(this._config.blinds || []), { entity: "" }];
    this._emit({ ...this._config, blinds });
  }

  _removeBlind(idx) {
    const blinds = [...(this._config.blinds || [])];
    blinds.splice(idx, 1);
    this._emit({ ...this._config, blinds });
  }

  _moveBlind(idx, delta) {
    const blinds = [...(this._config.blinds || [])];
    const j = idx + delta;
    if (j < 0 || j >= blinds.length) return;
    [blinds[idx], blinds[j]] = [blinds[j], blinds[idx]];
    this._emit({ ...this._config, blinds });
  }

  _presetsForEdit() {
    return this._config.presets || DEFAULT_PRESETS;
  }

  _onPresetName(idx, e) {
    const presets = [...this._presetsForEdit()];
    presets[idx] = { ...presets[idx], name: e.target.value };
    this._emit({ ...this._config, presets });
  }

  _onPresetTilt(idx, e) {
    const v = parseInt(e.target.value, 10);
    if (Number.isNaN(v)) return;
    const presets = [...this._presetsForEdit()];
    presets[idx] = { ...presets[idx], tilt: Math.max(0, Math.min(100, v)) };
    this._emit({ ...this._config, presets });
  }

  _addPreset() {
    const current = this._presetsForEdit();
    if (current.length >= MAX_PRESETS) return;
    const presets = [...current, { name: "New", tilt: 50 }];
    this._emit({ ...this._config, presets });
  }

  _removePreset(idx) {
    const presets = [...this._presetsForEdit()];
    presets.splice(idx, 1);
    this._emit({ ...this._config, presets });
  }

  _movePreset(idx, delta) {
    const presets = [...this._presetsForEdit()];
    const j = idx + delta;
    if (j < 0 || j >= presets.length) return;
    [presets[idx], presets[j]] = [presets[j], presets[idx]];
    this._emit({ ...this._config, presets });
  }

  _resetPresets() {
    this._emit({ ...this._config, presets: DEFAULT_PRESETS });
  }

  render() {
    if (!this._config) return html``;
    const blinds = this._config.blinds || [];
    const presets = this._presetsForEdit();
    const validLayouts = ["cards", "list", "segmented"];
    const layout = validLayouts.includes(this._config.layout) ? this._config.layout : "cards";
    const bp = this._config.responsive_breakpoint ?? 320;

    return html`
      <div class="editor">

        <div class="row">
          <ha-textfield
            label="Title (optional)"
            .value=${this._config.title || ""}
            @input=${this._onTitle}
          ></ha-textfield>
        </div>

        <div class="row">
          <div class="field-label">Layout</div>
          <div class="layout-options">
            <label class="radio">
              <input type="radio" name="layout" value="cards"
                     .checked=${layout === "cards"} @change=${this._onLayout}>
              <span>
                <strong>Cards</strong>
                <small>One block per blind with icon + preset buttons. Premium look.</small>
              </span>
            </label>
            <label class="radio">
              <input type="radio" name="layout" value="list"
                     .checked=${layout === "list"} @change=${this._onLayout}>
              <span>
                <strong>List</strong>
                <small>Compact rows with round chip buttons. Best for many blinds.</small>
              </span>
            </label>
            <label class="radio">
              <input type="radio" name="layout" value="segmented"
                     .checked=${layout === "segmented"} @change=${this._onLayout}>
              <span>
                <strong>Segmented</strong>
                <small>iOS-style segmented control bar. Cleanest for 2–4 blinds.</small>
              </span>
            </label>
          </div>
        </div>

        <div class="row">
          <ha-textfield
            label="Responsive breakpoint (px)"
            type="number"
            min="0" max="800"
            helper="Below this card width, labels collapse to icons only. 0 disables. Default 320."
            helperPersistent
            .value=${String(bp)}
            @input=${this._onBreakpoint}
          ></ha-textfield>
        </div>

        <div class="section">
          <div class="section-title">
            <span>Blinds</span>
            <span class="hint">${blinds.length} configured</span>
          </div>
          ${blinds.length === 0
            ? html`<div class="empty">No blinds yet. Add one below.</div>`
            : ""}
          ${blinds.map(
            (b, idx) => html`
              <div class="block">
                <div class="block-head">
                  <span class="block-index">#${idx + 1}</span>
                  <div class="item-actions">
                    <button class="icon-btn" title="Move up"
                            ?disabled=${idx === 0}
                            @click=${() => this._moveBlind(idx, -1)}>▲</button>
                    <button class="icon-btn" title="Move down"
                            ?disabled=${idx === blinds.length - 1}
                            @click=${() => this._moveBlind(idx, 1)}>▼</button>
                    <button class="icon-btn danger" title="Remove"
                            @click=${() => this._removeBlind(idx)}>✕</button>
                  </div>
                </div>
                <ha-entity-picker
                  .hass=${this.hass}
                  .value=${b.entity || ""}
                  .includeDomains=${["cover"]}
                  allow-custom-entity
                  @value-changed=${(e) => this._onBlindEntity(idx, e)}
                ></ha-entity-picker>
                <ha-textfield
                  label="Display name (optional)"
                  .value=${b.name || ""}
                  @input=${(e) => this._onBlindName(idx, e)}
                ></ha-textfield>
              </div>
            `
          )}
          <button class="add-btn" @click=${this._addBlind}>+ Add blind</button>
        </div>

        <div class="section">
          <div class="section-title">
            <span>Presets</span>
            <button class="link-btn" @click=${this._resetPresets} title="Reset to defaults">Reset</button>
          </div>
          <div class="hint" style="margin-bottom: 6px;">
            Each preset is a button on the card. Tilt range: 0% (closed up) → 50% (open) → 100% (closed down).
          </div>
          ${presets.map(
            (p, idx) => html`
              <div class="block">
                <div class="block-head">
                  <span class="block-index">#${idx + 1}</span>
                  <div class="item-actions">
                    <button class="icon-btn" title="Move up"
                            ?disabled=${idx === 0}
                            @click=${() => this._movePreset(idx, -1)}>▲</button>
                    <button class="icon-btn" title="Move down"
                            ?disabled=${idx === presets.length - 1}
                            @click=${() => this._movePreset(idx, 1)}>▼</button>
                    <button class="icon-btn danger" title="Remove"
                            @click=${() => this._removePreset(idx)}>✕</button>
                  </div>
                </div>
                <div class="preset-fields">
                  <ha-textfield
                    label="Name"
                    .value=${p.name || ""}
                    @input=${(e) => this._onPresetName(idx, e)}
                  ></ha-textfield>
                  <ha-textfield
                    label="Tilt %"
                    type="number"
                    min="0" max="100"
                    .value=${String(p.tilt ?? 50)}
                    @input=${(e) => this._onPresetTilt(idx, e)}
                  ></ha-textfield>
                </div>
              </div>
            `
          )}
          ${presets.length >= MAX_PRESETS
            ? html`
                <div class="warn">
                  Maximum of ${MAX_PRESETS} presets reached.
                  Beyond this, buttons get too cramped on narrow cards.
                </div>
              `
            : ""}
          <button class="add-btn"
                  ?disabled=${presets.length >= MAX_PRESETS}
                  @click=${this._addPreset}>+ Add preset</button>
        </div>

      </div>
    `;
  }

  static get styles() {
    return css`
      :host { display: block; container-type: inline-size; container-name: vbeditor; }
      .editor { display: flex; flex-direction: column; gap: 16px; padding: 8px 0; }
      .row { display: flex; flex-direction: column; gap: 8px; }
      ha-textfield { width: 100%; }

      .field-label {
        font-size: 12px;
        color: var(--secondary-text-color);
      }
      .layout-options {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .radio {
        display: flex;
        gap: 10px;
        align-items: flex-start;
        padding: 8px 10px;
        border: 1px solid var(--divider-color);
        border-radius: 8px;
        cursor: pointer;
      }
      .radio input { margin-top: 4px; }
      .radio span { display: flex; flex-direction: column; }
      .radio small {
        color: var(--secondary-text-color);
        font-size: 12px;
        margin-top: 2px;
      }

      .section {
        border-top: 1px solid var(--divider-color);
        padding-top: 12px;
      }
      .section-title {
        font-size: 14px;
        font-weight: 500;
        margin-bottom: 8px;
        color: var(--primary-text-color);
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .hint {
        font-size: 12px;
        color: var(--secondary-text-color);
        font-weight: 400;
      }
      .empty {
        padding: 12px;
        text-align: center;
        color: var(--secondary-text-color);
        font-size: 13px;
        background: var(--secondary-background-color);
        border-radius: 6px;
        margin-bottom: 8px;
      }
      .block {
        background: var(--secondary-background-color);
        border-radius: 8px;
        padding: 10px;
        margin-bottom: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .block-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
      }
      .block-index {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: .5px;
        color: var(--secondary-text-color);
        text-transform: uppercase;
      }
      .preset-fields {
        display: grid;
        grid-template-columns: 1fr 90px;
        gap: 8px;
      }
      .item-actions {
        display: flex;
        gap: 4px;
      }
      .icon-btn {
        width: 28px; height: 28px;
        border-radius: 6px;
        border: 1px solid var(--divider-color);
        background: var(--card-background-color);
        color: var(--primary-text-color);
        cursor: pointer;
        font-size: 12px;
        padding: 0;
      }
      .icon-btn:hover:not(:disabled) {
        background: var(--secondary-background-color);
      }
      .icon-btn:disabled {
        opacity: .4;
        cursor: not-allowed;
      }
      .icon-btn.danger {
        color: var(--error-color, #f44336);
      }
      .add-btn {
        background: var(--secondary-background-color);
        border: 1px dashed var(--divider-color);
        color: var(--primary-color);
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        width: 100%;
        font-size: 13px;
        margin-top: 4px;
      }
      .add-btn:hover:not(:disabled) { background: var(--divider-color); }
      .add-btn:disabled {
        opacity: .5;
        cursor: not-allowed;
        color: var(--secondary-text-color);
      }
      .link-btn {
        background: none;
        border: none;
        color: var(--primary-color);
        font-size: 12px;
        cursor: pointer;
        padding: 0;
      }
      .warn {
        margin: 4px 0 8px;
        padding: 8px 10px;
        font-size: 12px;
        line-height: 1.4;
        color: var(--warning-color, #b26a00);
        background: var(--warning-color-rgb, rgba(255, 152, 0, .1));
        border: 1px solid rgba(255, 152, 0, .35);
        border-radius: 6px;
      }

      @container vbeditor (max-width: 280px) {
        .preset-fields { grid-template-columns: 1fr; }
      }
    `;
  }
}

/* ============================================================
 * Registration
 * ============================================================ */

if (!customElements.get("venetian-blinds-card")) {
  customElements.define("venetian-blinds-card", VenetianBlindsCard);
}
if (!customElements.get("venetian-blinds-card-editor")) {
  customElements.define("venetian-blinds-card-editor", VenetianBlindsCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.find((c) => c.type === "venetian-blinds-card")) {
  window.customCards.push({
    type: "venetian-blinds-card",
    name: "Venetian Blinds Card",
    description:
      "Tilt-focused card for venetian horizontal blinds with configurable preset buttons.",
    preview: true,
  });
}

console.info(
  `%c VENETIAN-BLINDS-CARD %c v${VERSION} `,
  "color: white; background: #03a9f4; font-weight: 700; border-radius: 3px 0 0 3px; padding: 1px 4px;",
  "color: #03a9f4; background: #fff; font-weight: 700; border-radius: 0 3px 3px 0; padding: 1px 4px;"
);
