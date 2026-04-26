# Venetian Blinds Card

A **tilt-focused** custom card for Home Assistant, designed for venetian (horizontal) blinds. Instead of fiddly sliders, users tap **preset buttons** to snap the slats to common angles.

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://github.com/hacs/integration)

## Features

- **Three layouts** — pick whichever matches your dashboard style
  - **Cards** — one block per blind, icon + row of preset buttons (premium look)
  - **List** — compact rows with round chip buttons (great for many blinds)
  - **Segmented** — iOS-style segmented control bar (cleanest for 2–4 blinds)
- **Multiple blinds per card** — group all the windows of one room together
- **Configurable presets** — name, count (1–6), and tilt % all editable in the GUI
- **Responsive** — uses CSS container queries; labels collapse to icons on narrow cards (sidebar dashboards, mobile)
- **Visual editor** — full GUI configuration, no YAML required
- **Tilt-only** — no slider, no open/close noise; just the angles you actually use

## Preview

Open [`previews.html`](previews.html) in a browser to see the three layouts side by side.

## Installation

### HACS (recommended)

1. In HACS → **Frontend** → ⋯ → **Custom repositories**
2. Add this repository URL, category **Lovelace**
3. Install **Venetian Blinds Card**
4. Refresh your browser

### Manual

1. Download `dist/venetian-blinds-card.js`
2. Place it in `<config>/www/community/venetian-blinds-card/`
3. In **Settings → Dashboards → Resources**, add:
   - URL: `/local/community/venetian-blinds-card/venetian-blinds-card.js`
   - Type: **JavaScript Module**

## Requirements

Each blind entity must be a `cover.*` that supports either:
- **`set_cover_tilt_position`** with `current_tilt_position` attribute (most KNX, Shelly 2.5, Zigbee/Z-Wave Venetian motors), **or**
- **`set_cover_position`** with `current_position` attribute (common for ESPHome, MQTT covers, and some local integrations where slat tilt is the only motion and is mapped onto the position axis)

The card auto-detects which one to use. You can override the choice in the editor (Service mode: Auto / Tilt / Position) if needed.

## Configuration

The card has a full visual editor — no YAML needed. For reference, the YAML schema is:

```yaml
type: custom:venetian-blinds-card
title: Living Room                # optional
layout: cards                     # cards | list | segmented (default: cards)
service: auto                     # auto | tilt | position (default: auto)
responsive_breakpoint: 320        # px width below which labels collapse to icons. 0 disables.
blinds:
  - entity: cover.living_left
    name: Window Left             # optional, falls back to friendly_name
  - entity: cover.living_center
  - entity: cover.living_right
presets:                          # optional, defaults to 4 standard presets. Max 6.
  - name: Up
    tilt: 0
  - name: Open
    tilt: 50
  - name: ¼ Dn
    tilt: 75
  - name: Down
    tilt: 100
```

### Tilt convention

Home Assistant's `tilt_position` is `0–100`. By convention used by this card:

| Tilt | Meaning           |
|-----:|-------------------|
|    0 | Closed up (slats angled up)   |
|   50 | Open (horizontal slats)       |
|  100 | Closed down (slats angled down) |

Some integrations invert this — just set the preset values to whatever matches your hardware.

### Responsive breakpoint

The card uses **container queries**, not viewport media queries — it responds to its own width. This is critical in dashboards with grid columns, sidebars, or section views, where viewport-based responsive design fails. Below the configured threshold:

- **List**: chips wrap below the blind name
- **Cards**: preset labels disappear, leaving icon-only buttons
- **Segmented**: labels disappear; at very narrow widths the name and status pill stack

## License

[MIT](LICENSE)
