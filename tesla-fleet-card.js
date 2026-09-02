/* Tesla Fleet Card
   A Tesla-app-style, multi-car Lovelace card for Home Assistant.
   Works with both the tesla_custom (HACS) and official tesla_fleet
   integrations - auto-detected per car.
   Install guide, all options, and the image-pack spec live in the README:
   https://github.com/MrNickIE/tesla-fleet-homeassistant
   Built by Claude in conversation with MrNickIE - MIT licence, share freely. */
(function () {
  "use strict";

  const CARD_VERSION = "1.1.3";

  const PATTERNS = {
    battery: "sensor.{p}battery",
    range: "sensor.{p}range",
    charging: "binary_sensor.{p}charging",
    charger: "binary_sensor.{p}charger",
    charger_power: "sensor.{p}charger_power",
    charging_rate: "sensor.{p}charging_rate",
    energy_added: "sensor.{p}energy_added",
    charge_complete: "sensor.{p}time_charge_complete",
    charge_limit: "number.{p}charge_limit",
    charging_amps: "number.{p}charging_amps",
    charger_switch: "switch.{p}charger",
    /* tesla_custom exposes no charger-voltage entity at all, so this pattern
       never matched for any user. tesla_fleet does have one, so the key stays
       in both maps and only this side is blank. */
    charger_voltage: "",
    seat_fl: "select.{p}heated_seat_left",
    seat_fr: "select.{p}heated_seat_right",
    seat_rl: "select.{p}heated_seat_rear_left",
    seat_rc: "select.{p}heated_seat_rear_center",
    seat_rr: "select.{p}heated_seat_rear_right",
    steering_heat: "switch.{p}heated_steering",
    /* cars with a multi-level wheel expose BOTH a switch and a select. Prefer
       the select so Low and High are distinguishable; Patsy has only the
       switch, so the fallback matters. */
    steering_heat_sel: "select.{p}heated_steering_wheel",
    lock: "lock.{p}doors",
    doors: "binary_sensor.{p}doors",
    windows_cover: "cover.{p}windows",
    frunk: "cover.{p}frunk",
    trunk: "cover.{p}trunk",
    charge_port: "cover.{p}charger_door",
    climate: "climate.{p}hvac_climate_system",
    inside_temp: "sensor.{p}temperature_inside",
    outside_temp: "sensor.{p}temperature_outside",
    online: "binary_sensor.{p}online",
    asleep: "binary_sensor.{p}asleep",
    shift: "sensor.{p}shift_state",
    location: "device_tracker.{p}location_tracker",
    sentry: "switch.{p}sentry_mode",
    software: "update.{p}software_update",
    last_update: "sensor.{p}data_last_update_time",
    refresh: "button.{p}force_data_update",
    flash: "button.{p}flash_lights",
    horn: "button.{p}horn",
    remote_start: "button.{p}remote_start",
    odometer: "sensor.{p}odometer",
    tpms_fl: "sensor.{p}tpms_front_left",
    tpms_fr: "sensor.{p}tpms_front_right",
    tpms_rl: "sensor.{p}tpms_rear_left",
    tpms_rr: "sensor.{p}tpms_rear_right",
    defrost_switch: "",
    cop: "select.{p}cabin_overheat_protection",
  };

  /* Official tesla_fleet integration - same keys, its own entity naming.
     Empty string = the integration has no such entity (the card hides that feature). */
  const PATTERNS_FLEET = {
    battery: "sensor.{p}battery_level",
    range: "sensor.{p}battery_range",
    charging: "sensor.{p}charging",             // a sensor here, not a binary_sensor
    charger: "binary_sensor.{p}charge_cable",
    charger_power: "sensor.{p}charger_power",
    charging_rate: "sensor.{p}charge_rate",
    energy_added: "sensor.{p}charge_energy_added",
    charge_complete: "sensor.{p}time_to_full_charge",
    charge_limit: "number.{p}charge_limit",
    charging_amps: "number.{p}charge_current",
    charger_switch: "switch.{p}charge",
    charger_voltage: "sensor.{p}charger_voltage",
    seat_fl: "select.{p}seat_heater_front_left",
    seat_fr: "select.{p}seat_heater_front_right",
    seat_rl: "select.{p}seat_heater_rear_left",
    seat_rc: "select.{p}seat_heater_rear_center",
    seat_rr: "select.{p}seat_heater_rear_right",
    steering_heat: "select.{p}steering_wheel_heater",  // a select here, not a switch
    steering_heat_sel: "",
    lock: "lock.{p}lock",
    doors: "",
    windows_cover: "cover.{p}windows",
    frunk: "cover.{p}frunk",
    trunk: "cover.{p}trunk",
    charge_port: "cover.{p}charge_port_door",
    climate: "climate.{p}climate",
    inside_temp: "sensor.{p}inside_temperature",
    outside_temp: "sensor.{p}outside_temperature",
    online: "binary_sensor.{p}status",
    asleep: "",
    shift: "sensor.{p}shift_state",
    location: "device_tracker.{p}location",
    sentry: "switch.{p}sentry_mode",
    software: "update.{p}update",
    last_update: "",
    refresh: "button.{p}wake",
    flash: "button.{p}flash_lights",
    horn: "button.{p}honk_horn",
    remote_start: "button.{p}keyless_driving",
    odometer: "sensor.{p}odometer",
    tpms_fl: "sensor.{p}tire_pressure_front_left",
    tpms_fr: "sensor.{p}tire_pressure_front_right",
    tpms_rl: "sensor.{p}tire_pressure_rear_left",
    tpms_rr: "sensor.{p}tire_pressure_rear_right",
    defrost_switch: "switch.{p}defrost",
    cop: "climate.{p}cabin_overheat_protection",
  };

  const CARD_DEFAULTS = { accent: "#e82127", tpms_min: 38, default_car: 0, show_tpms: true };
  const CAR_DEFAULTS = { name: "Tesla", model: "", integration: "auto", image: "", image_side: "", image_charging: "", image_side_plugged: "", image_top_plugged: "", image_top_charging: "", cable: "overlay", cable_path: "", image_climate: "", images: "", port_xy: "159,47", port_top_xy: "40,692", climate_anchors: {}, top_anchors: {}, defrost_glass: {}, calibrate: false, hide_seats: [], hide_climate: [], paint: "", prefix: "", entities: {} };

  /* how long an assumed state is trusted before the real one wins back */
  const PEND_MS = 25000;

  const PAINT_COLORS = { red: "#a4232e", grey: "#5c5e62", gray: "#5c5e62", white: "#f2f3f5",
    black: "#171a20", blue: "#1f3a93", silver: "#c8c9cb" };

  /* Packs that ship with the repo. Keep in step with images/models/. The card
     lists these when a car has no pack of its own, so nobody is left guessing
     what exists - and so an unsupported combination is a nudge to build one
     rather than a dead end. */
  const PACKS_SHIPPED = [
    { model: "Model Y", paint: "red", dir: "models/y/red/app" },
    { model: "Model Y", paint: "white", dir: "models/y/white/app" },
    { model: "Model 3", paint: "grey", dir: "models/3/grey/app" }
  ];
  const PACK_DEFAULT = PACKS_SHIPPED[0];        // red Model Y

  /* Stable, key-order-independent serialisation. Used only to tell whether a
     config we have been handed differs from the one we already hold: Home
     Assistant may echo the same config back with its keys reordered, so a
     plain JSON.stringify comparison is not reliable. */
  function stableStr(v) {
    if (Array.isArray(v)) return "[" + v.map(stableStr).join(",") + "]";
    if (v && typeof v === "object") {
      return "{" + Object.keys(v).sort().map((k) =>
        JSON.stringify(k) + ":" + stableStr(v[k])).join(",") + "}";
    }
    return JSON.stringify(v === undefined ? null : v);
  }

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"]/g, (m) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  }

  function normIntegration(v) {
    const s = String(v || "").toLowerCase().replace(/[^a-z]/g, "");
    if (s === "teslafleet" || s === "fleet") return "tesla_fleet";
    if (s === "teslacustom" || s === "custom") return "tesla_custom";
    return "";
  }

  function resolveEntities(car, integration) {
    const p = car.prefix || "";
    const PAT = integration === "tesla_fleet" ? PATTERNS_FLEET : PATTERNS;
    const out = {};
    Object.keys(PAT).forEach((k) => {
      out[k] = (car.entities && car.entities[k]) || (PAT[k] ? PAT[k].replace("{p}", p) : "");
    });
    return out;
  }

  const ICONS = {
    lock: "M12 17a2 2 0 0 0 2-2 2 2 0 0 0-2-2 2 2 0 0 0-2 2 2 2 0 0 0 2 2m6-9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h1V6a5 5 0 0 1 5-5 5 5 0 0 1 5 5v2h1m-6-5a3 3 0 0 0-3 3v2h6V6a3 3 0 0 0-3-3z",
    unlock: "M12 17a2 2 0 0 0 2-2 2 2 0 0 0-2-2 2 2 0 0 0-2 2 2 2 0 0 0 2 2m6-9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h9V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3H7a5 5 0 0 1 5-5 5 5 0 0 1 5 5v2h1z",
    fan: "M12 11a1 1 0 0 1 1 1 1 1 0 0 1-1 1 1 1 0 0 1-1-1 1 1 0 0 1 1-1m.5-9c4.5 0 4.61 3.57 2.25 4.75-.99.49-1.43 1.54-1.62 2.47.48.2.9.51 1.22.91 5.66-3 9.65.63 9.65 3.37 0 4.5-3.57 4.6-4.75 2.25-.5-1-1.56-1.44-2.49-1.62-.21.48-.52.89-.92 1.21 3.03 5.66-.61 9.66-3.34 9.66-4.5 0-4.61-3.58-2.25-4.76.98-.49 1.42-1.53 1.62-2.45-.49-.2-.92-.52-1.24-.92-5.66 3.02-9.63-.64-9.63-3.37 0-4.5 3.57-4.6 4.75-2.25.49.99 1.53 1.43 2.45 1.62.2-.48.52-.9.92-1.22-3.01-5.65.63-9.65 3.38-9.65z",
    bolt: "M11 15H6l7-14v8h5l-7 14v-8z",
    vent: "M3 5h18v2H3V5m0 4h18v2H3V9m0 4h18v2H3v-2m0 4h18v2H3v-2z",
    refresh: "M17.65 6.35A8 8 0 0 0 12 4a8 8 0 0 0-8 8 8 8 0 0 0 8 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0 1 12 18a6 6 0 0 1-6-6 6 6 0 0 1 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z",
    shield: "M12 1 3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z",
    update: "M13 20h-2V8l-5.5 5.5-1.42-1.42L12 4.16l7.92 7.92-1.42 1.42L13 8v12z",
    chev: "M7.41 8.58 12 13.17l4.59-4.59L18 10l-6 6-6-6 1.41-1.42z",
    chevR: "M8.59 16.58 13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.42z",
    power: "M16.56 5.44l-1.45 1.45A5.97 5.97 0 0 1 18 12a6 6 0 0 1-6 6 6 6 0 0 1-6-6c0-2.17 1.16-4.06 2.88-5.12L7.44 5.44A7.96 7.96 0 0 0 4 12a8 8 0 0 0 8 8 8 8 0 0 0 8-8c0-2.72-1.36-5.12-3.44-6.56M13 3h-2v10h2V3z",
    horn: "M12 8H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h1v4a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-4h3l5 4V4l-5 4m9.5 4c0 1.71-.96 3.26-2.5 4V8c1.53.75 2.5 2.3 2.5 4z",
    flash: "M9 7c2.8 0 5 2.2 5 5s-2.2 5-5 5c-1.7 0-3-2.2-3-5s1.3-5 3-5m0-2C6 5 4 8.1 4 12s2 7 5 7c3.9 0 7-3.1 7-7s-3.1-7-7-7m8 2h5v2h-5V7m0 4h5v2h-5v-2m0 4h5v2h-5v-2z",
    pin: "M12 11.5A2.5 2.5 0 0 1 9.5 9 2.5 2.5 0 0 1 12 6.5 2.5 2.5 0 0 1 14.5 9a2.5 2.5 0 0 1-2.5 2.5M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7z",
  };

  /* Mode-button glyphs. Composed from circles, rects and short curves on a
     24x24 grid rather than copied path data, so there is nothing to
     mis-remember. The wrapper sets fill:currentColor; stroked parts override
     it themselves. */
  const CLIM_GLYPH = {
    paw: '<circle cx="6.5" cy="9.6" r="2.1"/><circle cx="10.4" cy="6.6" r="2.1"/>' +
         '<circle cx="14.9" cy="7.1" r="2.1"/><circle cx="18.6" cy="10.9" r="2.1"/>' +
         '<ellipse cx="12.4" cy="16.6" rx="5.3" ry="4.3"/>',
    tent: '<path d="M12 3.2 L2.6 20.4 H9.7 L12 15.2 L14.3 20.4 H21.4 Z"/>',
    defrost: '<rect x="3.5" y="17.2" width="17" height="2.1" rx="1.05"/>' +
             [7, 12, 17].map((x) =>
               `<path d="M ${x} 14.6 q 2.6 -2 0 -4 q -2.6 -2 0 -4" fill="none"` +
               ' stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>').join(""),
  };
  function climIcon(glyph) {
    return `<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor"` +
           ` style="vertical-align:-3.5px;margin-right:9px;flex:none">${glyph}</svg>`;
  }

  const CLIM_ANCHOR_DEFAULTS = { fl: [121, 164], fr: [233, 164], rl: [123, 289], rc: [176, 289], rr: [229, 289], wheel: [234, 97] };
  function anchor(map, key, def) {
    const v = map && map[key];
    if (!v) return def;
    const p = String(v).split(",").map(Number);
    return p.length === 2 && p.every((n) => !isNaN(n)) ? p : def;
  }

  function svgIcon(path, cls) {
    return '<svg class="' + (cls || "") + '" viewBox="0 0 24 24"><path d="' + path + '"/></svg>';
  }

  function heatWaves(id, x, y) {
    const wave = (off, i) =>
      `<path id="${id}_w${i}" d="M ${x + off} ${y + 13} q 4 -3.3 0 -6.5 q -4 -3.3 0 -6.5 q 4 -3.3 0 -6.5 q -4 -3.3 0 -6.5" stroke="#a9adb2" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    return `<g id="${id}" class="tapa" style="cursor:pointer">
      <circle cx="${x}" cy="${y}" r="26" fill="#000" opacity="0"/>
      ${wave(-9, 0)}${wave(0, 1)}${wave(9, 2)}
      <text id="${id}_auto" x="${x}" y="${y + 25}" text-anchor="middle" font-size="10.5"
            font-weight="700" fill="${IDLE_COL}" style="display:none">Auto</text>
    </g>`;
  }

  /* Tesla stores a MODE and a LEVEL, not a single number. The app shows this
     as Auto, or Heat / Cool at a level, and setting a level by hand moves the
     car out of Auto into Heat (confirmed against the app on a real car,
     2026-09-02). The old code did `.replace(/^(heat|cool) /, "")` and looked
     the remainder up in a table with `auto: 3`, which threw the mode away.
     That is why a seat on Auto rendered as maximum heat and a COOLED seat
     rendered as a hot one, in red, on cars with ventilated seats. */
  function parseHeat(state) {
    const v = String(state == null ? "" : state).trim().toLowerCase();
    if (!v || v === "off" || v === "unavailable" || v === "unknown")
      return { mode: "off", level: 0 };
    if (v === "auto") return { mode: "auto", level: 0 };
    const mode = v.indexOf("cool") === 0 ? "cool" : "heat";
    const lvl = { low: 1, medium: 2, med: 2, high: 3, on: 3 }[v.replace(/^(heat|cool)\s*/, "")];
    /* a plain switch reports "on" with no level, so treat it as full */
    return { mode, level: lvl === undefined ? 1 : lvl };
  }

  const HEAT_COL = "#e64545", COOL_COL = "#4aa3ff", IDLE_COL = "#a9adb2";

  /* -- Defrost glow ----------------------------------------------------------
     Measured off Nick's own app screen recording (ffmpeg, 15fps sampling of a
     4s window), rather than guessed:
       * the REAR screen is a flat vertical gradient - deep at the roofline,
         brightest at the outer edge (redness ramps ~4.4x top to bottom) - and
         is COMPLETELY STATIC: 0.06 variation over 7 seconds.
       * the WINDSCREEN band breathes on a 4.0s cycle at about +/-12%. Only
         that band moves; a control patch of cabin measured 0.09 over the same
         window, so it is the glow, not the view shifting.
       * the vent mist cones are NOT drawn while defrost runs.
       * climate off means defrost off - the app drops both together.
     The climate-view geometry is NOT hand-traced. The recording contains the
     same view with defrost on and off, and the car render is identical between
     them (body patches differ by ~1/255), so differencing the two frames yields
     the glow itself. Connected components separate the two glows (69k and 74k
     px) from the UI text that also changed (~250px each, rejected). That mask
     was warped into pack-image space by matching car bounding boxes, giving the
     outlines and per-row alpha below. Two things it settled: the glows are
     broad soft washes over each END OF THE CABIN, not tight glass polygons, and
     the wing mirrors do NOT tint. Colours are NOT from the recording - that
     phone had a warm colour filter on (its Control Centre is orange too). */
  const DF_ANIM = '<animate attributeName="opacity" dur="4s" repeatCount="indefinite" ' +
    'keyTimes="0;0.155;0.43;0.58;0.72;0.885;1" values=".95;.79;1;.84;.91;.82;.95" ' +
    'calcMode="spline" keySplines=".4 0 .6 1;.4 0 .6 1;.4 0 .6 1;.4 0 .6 1;.4 0 .6 1;.4 0 .6 1"/>';

  /* Relative alpha measured down each band of the climate view. Both reach zero
     at the inner edge, which is why the app never shows a boundary. */
  const DF_STOPS = {
    ws: [[0, .14], [.08, .98], [.16, .99], [.24, .85], [.32, .75], [.40, .65], [.48, .54],
         [.56, .40], [.64, .35], [.72, .30], [.80, .25], [.88, .17], [.96, .10], [1, 0]],
    rear: [[0, .04], [.09, .10], [.18, .18], [.26, .24], [.34, .35], [.42, .42], [.50, .51],
           [.59, .59], [.67, .68], [.75, .78], [.83, .88], [.91, .97], [1, 1]],
  };
  /* The same two profiles serve every view. A symmetric "fills the pane" curve
     was tried on the top-down and 3/4 renders and was wrong: side by side with
     Nick's screenshot the app's rear-screen tint sits LOW in the pane, hugging
     the shut line and fading upward - exactly the measured rear profile. */

  /* Peaks and colour. clim_* are the video-measured view and are left alone.
     The pane_* set is used on the views with no reference; its colour is more
     saturated because a composite match against the reference screenshot showed
     the old one going muddy: brightest pixels measured RGB 155/67/52 against the
     app's 108/39/31 - brighter in red but far greyer, which reads as dark. */
  /* Radial falloff for the 3/4 rear renders. Reaching zero at the shape's edge
     means the tint physically cannot appear outside its outline. */
  const DF_BLOB = [[0, 1], [.45, .97], [.62, .90], [.75, .72], [.86, .47], [.94, .22], [1, 0]];
  const DF_PEAK = { ws: 0.36, rear: 0.66, pane_ws: 0.42, pane_rear: 0.78, blob: 0.68 };
  const DF_COLOR = { ws: "#c0341f", rear: "#cb3a22", pane: "#c33019" };

  function dfScale(stops, peak, lo, hi) {
    return stops.map((st) => [lo + st[0] * (hi - lo), st[1] * peak]);
  }
  function dfGradStops(r) {
    const W = DF_STOPS.ws, R = DF_STOPS.rear, P = DF_PEAK;
    if (r.g === "blob") return { radial: 1, stops: dfScale(DF_BLOB, P.blob, 0, 1), colour: DF_COLOR.pane };
    if (r.g === "ws" || r.g === "rear") {
      const base = r.g === "ws" ? W : R;
      const peak = r.pane ? P["pane_" + r.g] : P[r.g];
      return { stops: dfScale(base, peak, 0, 1), colour: r.pane ? DF_COLOR.pane : DF_COLOR[r.g] };
    }
    /* only reached if a caller invents a recipe name; the drawn-art one went
       when the drawn art did */
    return { stops: dfScale(R, P.rear, 0, 1), colour: DF_COLOR.rear };
  }

  /* Outlines. clim_* came out of the video by differencing a defrost-on frame
     against a defrost-off one. top_* were measured off the pack photo: per-row
     glass-edge detection on the left flank, median-smoothed and mirrored about
     the car centreline (the right flank is shadowed and defeats the detector),
     inset 2 units. pane_* were traced and checked by drawing them back over the
     photos. All of them are verifiable by re-rendering, not by taste. */
  const DF_PATHS = {
    clim_ws: "M 133.5 12.5 L 104 20.5 L 90 28.5 L 88.5 36.5 L 88.5 44.5 L 89 52.5 L 89.5 60.5 L 90.5 68.5 L 91 76.5 L 92 84.5 L 92.5 92.5 L 94 100.5 L 100.5 108.5 L 103 110.5 L 267 110.5 L 274.5 108.5 L 276.5 100.5 L 277.5 92.5 L 278 84.5 L 279 76.5 L 280 68.5 L 280 60.5 L 281 52.5 L 281.5 44.5 L 281.5 36.5 L 280 28.5 L 266 20.5 L 236 12.5 Z",
    clim_rear: "M 110.5 323.5 L 107.5 331.5 L 107.5 339.5 L 108 347.5 L 108.5 355.5 L 109.5 363.5 L 110 371.5 L 111 379.5 L 112 387.5 L 112.5 395.5 L 113.5 403.5 L 114.5 411.5 L 115.5 419.5 L 117 427.5 L 119.5 435.5 L 125 443.5 L 141.5 451.5 L 172.5 456 L 198 456 L 228.5 451.5 L 245.5 443.5 L 250.5 435.5 L 253 427.5 L 254.5 419.5 L 255.5 411.5 L 256.5 403.5 L 257.5 395.5 L 258 387.5 L 259 379.5 L 260 371.5 L 260.5 363.5 L 261.5 355.5 L 262.5 347.5 L 262.5 339.5 L 263 331.5 L 255.5 323.5 Z",
    /* the top-down has three glass panels; shut lines measured at vb 183, 332 and 603,
       so the windscreen ends at 331 and the rear screen does not start until 604 */
    top_ws: "M 99 176 L 88 240 L 91 305 L 93 330 L 267 330 L 269 305 L 272 240 L 261 176 Z",
    top_rear: "M 108 606 L 110 642 L 123 706 L 146 728 L 214 728 L 237 706 L 250 642 L 252 606 Z",
    /* bottom edge follows the decklid shut line, which rises toward the tail;
       alpha peaks there, so an overhang onto bodywork shows immediately */
    /* NOT a pane outline: this is the app's own glow region, segmented out of
       Nick's Model 3 screenshot and mapped here by matching car bounding boxes.
       The app keeps clear margin inside the rear window on every side, so the
       tint never touches the roofline, C-pillar or decklid. */
    pane_plugged: "M 159.6 22.6 L 157.8 23.6 L 149.7 24.5 L 144.4 25.5 L 141.9 26.5 L 138.7 27.5 L 138.7 28.5 L 139.8 29.5 L 140.9 30.4 L 141.9 31.4 L 142.6 32.4 L 144.4 33.4 L 145.4 34.4 L 148.3 35.3 L 150.7 36.3 L 151.8 37.3 L 161.7 37.3 L 165.2 36.3 L 174 35.3 L 179 34.4 L 181.1 33.4 L 182.9 32.4 L 183.6 31.4 L 183.6 30.4 L 182.9 29.5 L 180.4 28.5 L 179 27.5 L 179 26.5 L 178.6 25.5 L 175.8 24.5 L 173.3 23.6 L 171.9 22.6 Z",
    pane_charging: "M 159.6 23.6 L 158.2 24.5 L 149.7 25.3 L 144 26.2 L 141.9 27.1 L 138.7 27.9 L 138.7 28.8 L 140.2 29.7 L 140.9 30.5 L 141.9 31.4 L 143 32.3 L 144.7 33.1 L 146.5 34 L 148.6 34.8 L 151.1 35.7 L 152.9 36.6 L 155.3 36.6 L 165.2 35.7 L 174 34.8 L 176.9 34 L 181.1 33.1 L 182.9 32.3 L 183.9 31.4 L 183.9 30.5 L 183.2 29.7 L 180.8 28.8 L 179.3 27.9 L 179.3 27.1 L 179.3 26.2 L 176.2 25.3 L 173.7 24.5 L 172.3 23.6 Z"
  };

  /* anim marks the piece that breathes: only the climate view's front wash,
     the one region the recording showed moving (its top, middle and lower
     thirds all varied ~22-24%, i.e. the group as a whole). fade adds the
     horizontal mask that stops a shape's sides from showing. */
  const DF_REGIONS = {
    Clim: [{ k: "ws", g: "ws", d: "clim_ws", anim: 1 }, { k: "re", g: "rear", d: "clim_rear" }],
    Top: [{ k: "ws", g: "ws", pane: 1, d: "top_ws", fade: 1 },
          { k: "re", g: "rear", pane: 1, d: "top_rear", fade: 1 }],
    /* side.jpg is shot from the front: no rear screen in frame, and the app
       showed no tint on the home view at all (it measured flat). So: none. */
    Rest: [],
    RestPlugged: [{ k: "re", g: "blob", d: "pane_plugged" }],
    RestCharging: [{ k: "re", g: "blob", d: "pane_charging" }],
    Art: []
  };

  /* --- Fitting the outlines to whatever pack is actually on screen ---------
     Every outline below was traced against the bundled pack's photos. A
     different pack frames the car differently - Patsy's Model Y climate render
     is 14% wider and 11% taller than the bundled Model 3 one and sits shifted -
     so the same coordinates land small and high on it, which is exactly how
     this was found. DF_CALIB records the car's bounding box in the image each
     view was traced against; at render time the card measures the car box in
     the image actually being shown and maps the outline across. Detection is a
     one-off canvas read per image URL, cached, and falls back to these numbers
     if it can't run (tainted canvas, load failure). */
  /* each view's overlay viewBox, needed to express a measured box in view units */
  const DF_VB = { Clim: [360, 600], Top: [360, 773], Rest: [233, 108],
                  RestPlugged: [233, 108], RestCharging: [233, 108] };
  const DF_CALIB = {
    Clim: [26.5, 10.5, 334, 514],          // images/models/3/grey/app/climate.jpg
    Top: [24, 14.5, 336, 754],             // …/topdown.jpg
    Rest: [33.9, 7.5, 205.5, 105.1],       // …/side.jpg
    RestPlugged: [33.9, 7.5, 205.5, 105.1],
    RestCharging: [33.9, 10.7, 205.8, 96.2]
  };
  /* remap every coordinate pair in an "M x y L x y … Z" path from the box it
     was traced in to the box measured on screen */
  function dfFit(d, from, to) {
    if (!from || !to) return d;
    const sx = (to[2] - to[0]) / (from[2] - from[0]);
    const sy = (to[3] - to[1]) / (from[3] - from[1]);
    if (!isFinite(sx) || !isFinite(sy) || sx <= 0 || sy <= 0) return d;
    let n = 0;
    return d.replace(/-?\d*\.?\d+/g, (v) => {
      const f = parseFloat(v);
      const out = (n++ % 2 === 0) ? to[0] + (f - from[0]) * sx
                                  : to[1] + (f - from[1]) * sy;
      return String(Math.round(out * 10) / 10);
    });
  }

  function dfStopTags(stops, colour) {
    return stops.map((st) => `<stop offset="${+st[0].toFixed(3)}" stop-color="${colour}" ` +
      `stop-opacity="${+st[1].toFixed(3)}"/>`).join("");
  }
  function dfDefs(sfx, car, override) {
    return dfRegions(sfx, car, override).map((r) => {
      const G = dfGradStops(r);
      let out = G.radial
        ? `<radialGradient id="dfG_${r.k}${sfx}" cx=".5" cy=".5" r=".5">` +
          `${dfStopTags(G.stops, G.colour)}</radialGradient>`
        : `<linearGradient id="dfG_${r.k}${sfx}" x1="0" y1="0" x2="0" y2="1">` +
          `${dfStopTags(G.stops, G.colour)}</linearGradient>`;
      if (r.fade) out +=
        `<linearGradient id="dfF_${r.k}${sfx}" x1="0" y1="0" x2="1" y2="0">` +
        `<stop offset="0" stop-color="#000"/><stop offset=".22" stop-color="#fff"/>` +
        `<stop offset=".78" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>` +
        `<mask id="dfM_${r.k}${sfx}" maskContentUnits="objectBoundingBox">` +
        `<rect x="0" y="0" width="1" height="1" fill="url(#dfF_${r.k}${sfx})"/></mask>`;
      return out;
    }).join("");
  }
  function dfRegions(sfx, car, override) {
    if (override) return override;
    const base = DF_REGIONS[sfx] || [];
    const o = (car && car.defrost_glass) || {};
    const own = o[sfx.toLowerCase()];
    if (!own) return base;
    /* per-car override: swaps the outlines for this view, keeping the recipes */
    return String(own).split("|").map((d) => d.trim()).filter(Boolean).map((d, i) => {
      const b = base[i] || base[0] || { k: "re", g: "rear", pane: 1, fade: 1 };
      return { k: b.k || ("o" + i), g: b.g, pane: b.pane, anim: b.anim, fade: b.fade, raw: d };
    });
  }
  function dfGlow(sfx, car, override, box) {
    const regions = dfRegions(sfx, car, override);
    if (!regions.length) return "";
    const body = regions.map((r) => {
      let d = r.raw || DF_PATHS[r.d];
      if (!d) return "";
      d = dfFit(d, DF_CALIB[sfx], box);
      const shape = `<path d="${d}" fill="url(#dfG_${r.k}${sfx})"/>`;
      const mask = r.fade ? ` mask="url(#dfM_${r.k}${sfx})"` : "";
      return `<g${mask}>${shape}${r.anim ? DF_ANIM : ""}</g>`;
    }).join("");
    return `<g id="df${sfx}" style="display:none" pointer-events="none">${body}</g>`;
  }

  function relDur(iso) {
    if (!iso) return "";
    const t = new Date(iso).getTime();
    if (isNaN(t)) return "";
    const m = Math.floor(Math.max(0, Date.now() - t) / 60000);
    if (m < 1) return "just now";
    if (m < 60) return m + (m === 1 ? " minute" : " minutes");
    const h = Math.floor(m / 60);
    if (h < 48) return h + (h === 1 ? " hour" : " hours");
    return Math.floor(h / 24) + " days";
  }

  ICONS.plug = "M16 7V3h-2v4h-4V3H8v4c-1.1 0-2 .9-2 2v5.5L9.5 18v3h5v-3l3.5-3.5V9c0-1.1-.9-2-2-2z";

  class TeslaFleetCard extends HTMLElement {
    static getConfigElement() {
      return document.createElement("tesla-fleet-card-editor");
    }
    static getStubConfig() {
      return { cars: [{ name: "My Tesla", model: PACK_DEFAULT.model,
                        paint: PACK_DEFAULT.paint, prefix: "" }] };
    }

    setConfig(config) {
      if (!config || !Array.isArray(config.cars) || !config.cars.length) {
        if (config && (config.prefix !== undefined || config.entities || config.name)) {
          config = { cars: [config] };
        } else {
          throw new Error("tesla-fleet-card: define at least one car under 'cars:'");
        }
      }
      this._config = Object.assign({}, CARD_DEFAULTS, config);
      this._cars = this._config.cars.map((c) => {
        const car = Object.assign({}, CAR_DEFAULTS, c);
        /* `color` was removed as a config option: it only ever tinted the drawn
           fallback art, which `paint` already does. Drop any left over from an
           older config so no dead key survives on the car object. */
        delete car.color;
        car._cableSet = c.cable !== undefined;
        const forced = normIntegration(car.integration);
        car._integration = forced || "";           // "" = auto-detect at first hass
        car._entities = resolveEntities(car, forced || "tesla_custom");
        car._detected = !!forced;
        return car;
      });
      /* Keep the chosen car across setConfig. The editor emits config-changed on
         every keystroke, so HA re-ran setConfig and the preview snapped back to
         the first car each time (issue #1). */
      const keep = typeof this._sel === "number" && this._sel < this._cars.length;
      this._sel = keep ? this._sel : Math.min(this._config.default_car || 0, this._cars.length - 1);
      this._built = false;
      this._arm = {};
      this._armT = {};
      this._openRows = {};
      this._view = this._view || "";
    }

    getCardSize() { return 10; }

    connectedCallback() {
      this._timer = setInterval(() => { if (this._hass) this._update(); }, 30000);
    }
    disconnectedCallback() {
      clearInterval(this._timer);
      clearTimeout(this._refT1);
      clearTimeout(this._refT2);
    }

    get _car() { return this._cars[this._sel]; }

    set hass(hass) {
      this._hass = hass;
      if (!this._config) return;
      this._cars.forEach((car) => {
        if (car._detected) return;
        const raw = car.prefix || "";
        /* Leaving the trailing underscore off the prefix is the most common
           setup mistake there is (issue #1: "grande_bianco" for entities named
           grande_bianco_*). The README says to include it and the on-card
           diagnostic says so too, and people still trip over it, so try the
           corrected form as well and adopt it silently if that is what
           matches. Only the in-memory car is touched, never the saved config. */
        const tries = raw && !/_$/.test(raw) ? [raw, raw + "_"] : [raw];
        for (let t = 0; t < tries.length; t++) {
          const p = tries[t];
          let integ = "";
          if (hass.states["sensor." + p + "battery"]) integ = "tesla_custom";
          else if (hass.states["sensor." + p + "battery_level"]) integ = "tesla_fleet";
          if (integ) {
            car.prefix = p;
            car._integration = integ;
            car._entities = resolveEntities(car, integ);
            car._detected = true;
            if (car === this._car) this._built = false;   // rebuild with the right entities
            break;
          }
        }
      });
      this._cars.forEach((car) => this._probeImages(car));
      if (!this._built) this._build();
      this._update();
    }

    _selectCar(i) {
      if (i === this._sel) return;
      this._sel = i;
      this._view = "";
      this._built = false;
      this._arm = {};
      this._build();
      this._update();
    }

    _st(key) {
      const id = this._car._entities[key];
      return (id && this._hass && this._hass.states[id]) || null;
    }
    _num(key) {
      const s = this._st(key);
      const v = s ? parseFloat(s.state) : NaN;
      return isNaN(v) ? null : v;
    }
    _is(key, val) {
      const s = this._st(key);
      return !!s && s.state === val;
    }
    /* integration-agnostic helpers */
    _charging() {
      const s = this._st("charging");
      if (!s) return false;
      if (s.entity_id.startsWith("binary_sensor.")) return s.state === "on";
      return String(s.state).toLowerCase() === "charging";   // tesla_fleet sensor
    }
    _plugged() { return this._is("charger", "on"); }
    /* Defrost is a real switch on tesla_fleet; on tesla_custom it is a climate
       preset. Single source of truth for the button, the glass glow and the
       header badge. */
    /* --- Optimistic state -------------------------------------------------
       Tesla polls, so a command can take a minute to show up in HA. Without
       this the card looks broken: you press Defrost, the car starts heating,
       and nothing on screen moves. So: assume the command worked, show that
       immediately, and let the real state take over the moment it agrees (or
       time out and fall back to the truth if it never does). */
    _setPend(key, val) {
      this._pend = this._pend || {};
      this._pend[key] = { val: val, ts: Date.now() };
      this._nudgeRefresh();
      if (this._hass) this._update();
    }
    _pendVal(key) {
      const p = this._pend && this._pend[key];
      if (!p) return undefined;
      if (Date.now() - p.ts > PEND_MS) { delete this._pend[key]; return undefined; }
      return p.val;
    }
    /* Ask the car for fresh data shortly after a command instead of waiting for
       the next poll. Only ever after a command - never on a timer, because this
       wakes the car and spends API calls. */
    _nudgeRefresh() {
      const id = this._car && this._car._entities && this._car._entities.refresh;
      if (!id || !this._hass) return;
      clearTimeout(this._refT1); clearTimeout(this._refT2);
      this._refT1 = setTimeout(() => this._call("button", "press", { entity_id: id }), 4000);
      this._refT2 = setTimeout(() => this._call("button", "press", { entity_id: id }), 11000);
    }

    /* Measure the car's bounding box in an image, once per URL. Same-origin
       (/local/, /hacsfiles/) reads fine; raw.githubusercontent.com sends
       access-control-allow-origin:*, so crossOrigin="anonymous" works there
       too. Anything else falls back to the traced calibration. */
    _carBox(url, sfx) {
      if (!url) return DF_CALIB[sfx];
      this._boxes = this._boxes || {};
      if (this._boxes[url]) return this._boxes[url];
      this._measureBox(url, sfx);
      return DF_CALIB[sfx];
    }
    _measureBox(url, sfx) {
      this._boxTried = this._boxTried || {};
      if (this._boxTried[url]) return;
      this._boxTried[url] = true;
      const vb = DF_VB[sfx] || [360, 600];
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const cv = document.createElement("canvas");
          const W = cv.width = img.naturalWidth, H = cv.height = img.naturalHeight;
          if (!W || !H) throw new Error("no size");
          const ctx = cv.getContext("2d", { willReadFrequently: true });
          ctx.drawImage(img, 0, 0);
          const px = ctx.getImageData(0, 0, W, H).data;
          let x0 = W, y0 = H, x1 = -1, y1 = -1;
          for (let y = 0; y < H; y++) {
            const row = y * W * 4;
            for (let x = 0; x < W; x++) {
              const i = row + x * 4;
              /* rec.601 luma; the renders sit on a near-black ground */
              if (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2] > 45) {
                if (x < x0) x0 = x;
                if (x > x1) x1 = x;
                if (y < y0) y0 = y;
                if (y > y1) y1 = y;
              }
            }
          }
          if (x1 <= x0 || y1 <= y0) throw new Error("nothing found");
          this._boxes[url] = [x0 * vb[0] / W, y0 * vb[1] / H, x1 * vb[0] / W, y1 * vb[1] / H];
          this._built = false;
          if (this._hass) { this._build(); this._update(); }
        } catch (e) {
          this._boxes[url] = DF_CALIB[sfx];      // tainted canvas or odd image
        }
      };
      img.onerror = () => { this._boxes[url] = DF_CALIB[sfx]; };
      img.src = url;
    }

    _defrostOn() {
      const want = this._pendVal("defrost");
      const real = this._defrostReal();
      if (want === undefined) return real;
      if (real === want) { delete this._pend.defrost; return real; }   // confirmed
      return want;                                                     // still in flight
    }
    _defrostReal() {
      const ds = this._st("defrost_switch");
      if (ds) return ds.state === "on";
      const cs = this._st("climate");
      /* tesla_custom leaves preset_mode on "defrost" after the HVAC is switched
         off, which left the glass lit with the climate off. The app drops both
         together, so treat an off/unknown climate as defrost off. Note this is
         only correct at steady state: for the first poll cycle after you press
         Defrost the climate still reads "off" while preset is already
         "defrost", which is exactly what _pendVal covers. */
      if (!cs || cs.state === "off" || cs.state === "unavailable" || cs.state === "unknown") return false;
      return cs.attributes.preset_mode === "defrost";
    }

    /* prefer the level select, fall back to the plain switch */
    _steerEnt() { return this._st("steering_heat_sel") || this._st("steering_heat"); }
    _steeringOn() {
      const s = this._steerEnt();
      if (!s) return false;
      return parseHeat(s.state).mode !== "off";
    }
    _minsToFull() {
      const s = this._st("charge_complete");
      if (!s) return NaN;
      const attrMin = s.attributes ? parseFloat(s.attributes.minutes_to_full_charge) : NaN;
      if (!isNaN(attrMin)) return attrMin;                    // tesla_custom
      const v = parseFloat(s.state);
      if (isNaN(v)) return NaN;
      const u = (s.attributes.unit_of_measurement || "").toLowerCase();
      if (u.indexOf("min") === 0) return v;
      return v * 60;                                          // tesla_fleet reports hours
    }
    /* Image resolution: explicit per-car image_* options win; otherwise an
       `images:` base folder (or the auto-detected HACS images folder) supplies
       the standard filenames; otherwise "" and the built-in artwork draws. */
    _imgBase() {
      const car = this._car;
      return car.images || car._autoBase || "";
    }
    _img(kind) {
      const car = this._car;
      if (car[kind]) return car[kind];
      const base = this._imgBase();
      if (!base) return "";
      const FILES = {
        image: "topdown.jpg", image_top_plugged: "topdown-plugged.jpg",
        image_top_charging: "topdown-charging.jpg", image_side: "side.jpg",
        image_side_plugged: "side-plugged.jpg", image_charging: "side-charging.jpg",
        image_climate: "climate.jpg",
      };
      const f = FILES[kind];
      // Auto-detected packs may be partial: only offer files that actually exist,
      // so missing slots fall back to the drawn artwork instead of a broken img.
      if (!car.images && car._packFiles && !car._packFiles[f]) return "";
      return base.replace(/\/$/, "") + "/" + f;
    }
    _cableBaked() {
      const car = this._car;
      if (car._cableSet) return car.cable === "baked";
      return !!this._imgBase() || car.cable === "baked";  // pack images ship baked cables
    }
    _probeImages(car) {
      if (car._probed) return;
      car._probed = true;
      if (car.images || car.image || car.image_side) return;   // explicit config wins
      const dir = /3/.test(String(car.model || "")) ? "3" : "y";
      const paint = String(car.paint || "").toLowerCase().replace(/[^a-z]/g, "");
      // /local first: a pack in /config/www/tesla-fleet-card/ always wins.
      // Then the repo itself over GitHub raw - always current, updates on a
      // plain push. hacsfiles LAST: HACS only manages the JS file for
      // dashboard plugins and never updates or removes an images tree it once
      // laid down, so anything found there is likely stale.
      const roots = ["/local/tesla-fleet-card/images/",
                     "https://raw.githubusercontent.com/MrNickIE/tesla-fleet-homeassistant/main/images/",
                     "/hacsfiles/tesla-fleet-homeassistant/images/"];
      const candidates = [];
      roots.forEach((root) => {
        if (paint) candidates.push(root + "models/" + dir + "/" + paint + "/app", root + dir + "/" + paint);
        candidates.push(root + dir, root + "models/" + dir + "/app");
      });
      const FILES7 = ["topdown.jpg", "topdown-plugged.jpg", "topdown-charging.jpg",
                      "side.jpg", "side-plugged.jpg", "side-charging.jpg", "climate.jpg"];
      const adopt = (base) => {           // record which of the 7 slots exist, then rebuild once
        car._autoBase = base;
        car._packFiles = {};
        let pending = FILES7.length;
        const done = () => {
          if (--pending === 0 && car === this._car) {
            this._built = false;
            if (this._hass) { this._build(); this._update(); }
          }
        };
        FILES7.forEach((f) => {
          fetch(base + "/" + f, { method: "HEAD" })
            .then((r) => { if (r.ok) car._packFiles[f] = 1; })
            .catch(() => {})
            .then(done, done);
        });
      };
      const tryNext = (i) => {            // a folder counts as a pack if ANY standard file exists
        if (i >= candidates.length) return;
        const PROBE = ["topdown.jpg", "side.jpg", "climate.jpg"];
        const tryFile = (j) => {
          if (j >= PROBE.length) return tryNext(i + 1);
          fetch(candidates[i] + "/" + PROBE[j], { method: "HEAD" }).then((r) => {
            if (!r.ok) return tryFile(j + 1);
            adopt(candidates[i]);
          }).catch(() => tryFile(j + 1));
        };
        tryFile(0);
      };
      tryNext(0);
    }
    _etaText() {
      const s = this._st("charge_complete");
      if (!s || s.state === "unknown" || s.state === "unavailable") return null;
      const t = new Date(s.state).getTime();
      if (!isNaN(t) && t > Date.now())                        // tesla_custom: ISO timestamp
        return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const mins = this._minsToFull();
      if (isNaN(mins) || mins <= 0) return null;
      return new Date(Date.now() + mins * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    _unit(key, fallback) {
      const s = this._st(key);
      return (s && s.attributes.unit_of_measurement) || fallback || "";
    }
    _call(domain, service, data) {
      const p = this._hass.callService(domain, service, data);
      /* callService returns a promise and the card used to drop it. Combined
         with the optimistic pends below that meant a REJECTED command left the
         card confidently showing the wrong state for the full 25s window and
         then snapping back with no explanation. Tesla rejects commands for
         real reasons: Pet Mode blocks Max Defrost, the car is asleep, you are
         rate limited. An honest blip beats a confident lie. */
      if (p && typeof p.catch === "function") p.catch(() => this._cmdFailed());
    }
    _cmdFailed() {
      this._pend = {};
      this._pendSeat = null; this._pendPreset = null; this._pendFan = null; this._pendCop = null;
      this._toast("Command failed");
      this._update();
    }
    /* centred version of the seat toast, for messages not tied to one seat */
    _toast(label) {
      const g = this.shadowRoot && this.shadowRoot.getElementById("heatToast");
      if (!g) return;
      const txt = this.shadowRoot.getElementById("heatToastTxt");
      const bg = this.shadowRoot.getElementById("heatToastBg");
      if (!txt || !bg) return;
      txt.textContent = label;
      const w = label.length * 7.6 + 18;
      const tx = Math.max(4, 180 - w / 2), ty = 560;
      bg.setAttribute("x", tx); bg.setAttribute("y", ty); bg.setAttribute("width", w);
      txt.setAttribute("x", tx + 9); txt.setAttribute("y", ty + 17);
      g.style.display = "";
      clearTimeout(this._toastT);
      this._toastT = setTimeout(() => { g.style.display = "none"; }, 2200);
    }
    _moreInfo(key) {
      const id = this._car._entities[key];
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: id }, bubbles: true, composed: true }));
    }

    /* two-tap confirm: returns true when the action should run */
    _confirm(key, el, restoreText) {
      if (!this._arm[key]) {
        this._arm[key] = true;
        el.classList.add("armed");
        const lb = el.querySelector(".lb") || el;
        const orig = restoreText !== undefined ? restoreText : lb.textContent;
        lb.textContent = "Tap again";
        clearTimeout(this._armT[key]);
        this._armT[key] = setTimeout(() => {
          this._arm[key] = false;
          el.classList.remove("armed");
          lb.textContent = orig;
        }, 3000);
        return false;
      }
      this._arm[key] = false;
      el.classList.remove("armed");
      clearTimeout(this._armT[key]);
      return true;
    }

    _build() {
      this._built = true;
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      const car = this._car;
      const multi = this._cars.length > 1;
      this.shadowRoot.innerHTML = `
<style>
  :host { display:block; }
  * { box-sizing:border-box; }
  ha-card {
    background:#141414; color:#ececec; border-radius:16px; overflow:hidden;
    font-family:-apple-system,'Segoe UI',Roboto,sans-serif; padding:16px 16px 10px;
  }
  .hdr { display:flex; align-items:flex-start; justify-content:space-between; }
  .nmBtn { background:none; border:none; padding:0; color:inherit; font:inherit;
    display:flex; align-items:center; gap:3px; cursor:${multi ? "pointer" : "default"}; }
  .nm { font-size:24px; font-weight:600; letter-spacing:.2px; }
  .nmBtn svg { width:19px; height:19px; fill:#8a8a8a; margin-top:3px; ${multi ? "" : "display:none;"} }
  .battLine { display:flex; align-items:center; gap:7px; margin-top:5px; color:#9b9b9b; font-size:13px; }
  .battLine #battBolt { display:flex; }
  .battLine #battBolt svg { width:13px; height:13px; fill:#4fd07a; }
  .battLine #battDefrost { display:flex; }
  .battLine #battDefrost svg { width:12px; height:13px; }
  .chgBtns { display:none; grid-template-columns:1fr 1fr; gap:8px; margin-top:12px; }
  .chgBtns.show { display:grid; }
  .chgBtns button { background:#1f1f1f; border:none; color:#dcdcdc; font-family:inherit;
    font-size:12.5px; padding:9px 0; border-radius:10px; cursor:pointer; }
  .chgBtns button:active { background:#2c2c2c; }
  .climWrap { margin-bottom:8px; }
  .climImg { max-height:360px; }
  .defrostBtn { display:block; width:100%; background:#1f1f1f; border:none; color:#dcdcdc;
    font-family:inherit; font-size:12.5px; padding:10px 0; border-radius:10px; cursor:pointer; margin-top:12px; }
  .defrostBtn.on { color:#4fa3ff; }
  /* honest "sent, waiting for the car" state rather than a silent lie */
  .defrostBtn.pending, .pwr.pending { animation:dfPulse 1.5s ease-in-out infinite; }
  @keyframes dfPulse { 0%,100% { opacity:1 } 50% { opacity:.55 } }
  @media (prefers-reduced-motion:reduce) {
    .defrostBtn.pending, .pwr.pending { animation:none; opacity:.75 } }
  .defrostBtn:active { background:#2c2c2c; }
  .battGlyph { width:24px; height:11px; border:1.5px solid #6f6f6f; border-radius:3px; position:relative; }
  .battGlyph:after { content:""; position:absolute; right:-4px; top:2.5px; width:2.5px; height:4px;
    background:#6f6f6f; border-radius:0 1px 1px 0; }
  .battFill { position:absolute; left:1px; top:1px; bottom:1px; background:#8f9296; border-radius:1px; }
  .battFill.chg { background:#4fd07a; } .battFill.low { background:#e0a63c; } .battFill.crit { background:#d53a3a; }
  .noPack { padding:26px 20px 22px; text-align:center; color:#c9ccd1; }
  .noPackCar { width:74px; height:30px; color:#5b6068; display:block; margin:0 auto 12px; }
  .noPackTitle { font-size:15px; font-weight:600; color:#e9eaec; margin-bottom:7px; }
  .noPackBody { font-size:12.8px; line-height:1.5; max-width:330px; margin:0 auto 12px; }
  .noPackBody b { color:#e9eaec; }
  .noPackHave { font-size:12.8px; line-height:1.5; max-width:330px; margin:0 auto 12px;
                background:#1b1d21; border:1px solid #2b2e33; border-radius:8px; padding:9px 12px; }
  .noPackHave ul { margin:6px 0; padding:0; list-style:none; }
  .noPackHave li { padding:2px 0; color:#e9eaec; }
  .noPackPath { font-family:ui-monospace,Menlo,monospace; font-size:11.5px; color:#8d9298;
                background:#141619; border:1px solid #26282c; border-radius:6px;
                padding:6px 9px; display:inline-block; margin-bottom:12px; }
  .noPack a { color:#5ea0ff; }
  .diag { margin-top:7px; padding:8px 10px; border-radius:7px; font-size:12.5px; line-height:1.45;
          background:#3a2411; border:1px solid #6b4318; color:#f0c99a; max-width:520px; }
  .diag code { background:#00000055; padding:1px 4px; border-radius:3px; font-size:12px; }
  .diag b { color:#fff; }
  .sub { font-size:13px; color:#9b9b9b; margin-top:3px; }
  .hdr-r { display:flex; align-items:center; gap:8px; }
  .icobtn { background:none; border:none; width:32px; height:32px; border-radius:50%;
    display:flex; align-items:center; justify-content:center; cursor:pointer; }
  .icobtn svg { width:18px; height:18px; fill:#b8b8b8; }
  .icobtn:active { background:#242424; }
  .spin svg { animation: rot 1s linear infinite; }
  @keyframes rot { to { transform:rotate(360deg);} }

  .carMenu { position:absolute; z-index:5; margin-top:4px; background:#242424; border-radius:12px;
    box-shadow:0 8px 24px #000a; overflow:hidden; }
  .carMenu[hidden] { display:none; }
  .carMenu button { display:flex; align-items:center; gap:8px; width:100%; text-align:left;
    background:none; border:none; color:#ececec; font:inherit; font-size:14px;
    padding:10px 16px; cursor:pointer; }
  .carMenu button:hover { background:#2e2e2e; }
  .dot { width:10px; height:10px; border-radius:50%; display:inline-block; border:1px solid #555; }

  .carBox { margin:4px auto 0; max-width:330px; position:relative; }
  svg.car { width:100%; height:auto; display:block; }
  .imgWrap { position:relative; width:fit-content; margin:0 auto; }
  .imgWrap:not(.rest) .carImg { width:auto; max-width:100%; max-height:420px; }
  .imgWrap.rest { cursor:pointer; }
  .ctlBtn { position:absolute; left:50%; transform:translateX(-50%); bottom:6px;
    background:#2b2b2bd9; border:none; color:#e6e6e6; font-family:inherit; font-size:12.5px;
    padding:6px 18px; border-radius:15px; cursor:pointer; }
  .ctlBtn:active { background:#3a3a3a; }
  .backBtn { position:absolute; left:0; top:0; z-index:2; background:#2b2b2bd9; border:none;
    color:#e6e6e6; font-size:18px; line-height:1; padding:5px 12px 7px; border-radius:15px; cursor:pointer; }
  .backBtn:active { background:#3a3a3a; }
  .carImg { width:100%; display:block; }
  svg.ovl { position:absolute; left:0; top:0; width:100%; height:100%; }
  svg.car text { font-family:-apple-system,'Segoe UI',Roboto,sans-serif; }
  .tapa { cursor:pointer; }
  /* mist animation is SMIL (in the SVG markup) - CSS transforms on filtered
     SVG elements don't animate on iOS WebKit (HA companion app) */
  .climX { margin-top:8px; text-align:left; padding-left:14px; }
  .climX.on { color:#4fa3ff; }
  .copWrap { margin-top:14px; }
  .copLbl { font-size:12.5px; color:#9b9b9b; margin-bottom:7px; }
  .copSeg { display:flex; background:#1f1f1f; border-radius:10px; padding:3px; gap:3px; }
  .copSeg button { flex:1; background:none; border:none; color:#9b9b9b; font-family:inherit;
    font-size:12.5px; padding:7px 0; border-radius:8px; cursor:pointer; }
  .copSeg button.on { background:#3a3a3a; color:#fff; }
  .calib { position:absolute; top:4px; right:4px; z-index:3; pointer-events:none;
    background:#000000cc; color:#ffd47f; font-size:11px; padding:3px 9px; border-radius:8px; }
  .tapa.armed text.olbl { fill:#e0a63c !important; }

  .acts { display:flex; justify-content:space-around; margin:2px 8px 4px; }
  .abtn { display:flex; flex-direction:column; align-items:center; gap:5px;
    background:none; border:none; cursor:pointer; color:#a8a8a8; font-size:11px;
    font-family:inherit; padding:6px 10px; border-radius:10px; }
  .abtn svg { width:22px; height:22px; fill:#d9d9d9; }
  .abtn:active { background:#242424; }
  .abtn.armed { color:#e0a63c; } .abtn.armed svg { fill:#e0a63c; }
  .abtn.on svg { fill:#4fa3ff; } .abtn.on { color:#4fa3ff; }

  .rows { margin-top:6px; border-top:1px solid #262626; }
  .row { border-bottom:1px solid #262626; }
  .rowHead { display:flex; align-items:center; gap:12px; width:100%; background:none; border:none;
    color:#ececec; font:inherit; text-align:left; padding:13px 4px; cursor:pointer; }
  .rowHead > svg.ric { width:20px; height:20px; fill:#c9c9c9; flex:none; }
  .rTitle { font-size:15px; font-weight:500; }
  .rSub { font-size:12px; color:#8f8f8f; margin-top:1px; }
  .rowHead .chev { margin-left:auto; width:18px; height:18px; fill:#6f6f6f; flex:none; transition:transform .2s; }
  .row.open .chev { transform:rotate(90deg); }
  .rowBody { display:none; padding:2px 4px 14px 36px; }
  .row.open .rowBody { display:block; }

  .climCtl { display:flex; align-items:center; justify-content:center; gap:14px; }
  .climCtl .big { font-size:34px; font-weight:300; min-width:96px; text-align:center; }
  .arrow { background:none; border:none; color:#8f8f8f; font-size:26px; cursor:pointer; padding:4px 10px; }
  .arrow:active { color:#fff; }
  .pwr { display:flex; flex-direction:column; align-items:center; gap:3px; background:none; border:none;
    color:#a8a8a8; font-size:10.5px; font-family:inherit; cursor:pointer; }
  .pwr svg { width:20px; height:20px; fill:#d9d9d9; }
  .pwr.on svg { fill:#4fa3ff; } .pwr.on { color:#4fa3ff; }

  .chgLine1 { font-size:13.5px; color:#ececec; }
  .chgLine1 b { font-weight:700; }
  .chgLine1 span { color:#8f8f8f; }
  .chgLine2 { font-size:12.5px; color:#8f8f8f; margin-top:4px; }
  .sliderWrap { position:relative; margin:14px 0 6px; }
  .limTick { position:absolute; left:80%; top:50%; transform:translate(-50%,-50%);
    width:2.5px; height:15px; background:#6f6f6f; border-radius:1.5px; pointer-events:none; }
  .chgSlider { width:100%; margin:0; display:block; accent-color:#4fd07a;
    position:relative; z-index:1; background:transparent; }
  .ampRow { display:flex; align-items:center; justify-content:center; gap:6px;
    background:#1f1f1f; border-radius:10px; padding:4px 6px; margin-top:8px; }
  .ampRow span { font-size:14px; font-weight:600; min-width:52px; text-align:center; }
  .ampRow button { background:none; border:none; color:#8f8f8f; font-size:20px;
    cursor:pointer; padding:2px 22px; }
  .ampRow button:active { color:#fff; }

  .ftr { display:flex; justify-content:space-between; margin-top:10px; font-size:11px; color:#6f6f6f; }
  .climMode .acts, .climMode .rows, .climMode .ftr { display:none; }
  .climPage { max-width:330px; margin:0 auto; }
  .climTemps { text-align:center; color:#9b9b9b; font-size:13px; margin:10px 0 6px; }
</style>
<ha-card class="${this._view === "clim" ? "climMode" : ""}">
  <div class="hdr">
    <div style="position:relative">
      <button class="nmBtn" id="nmBtn"><span class="nm">${car.name}</span>${svgIcon(ICONS.chev)}</button>
      <div class="battLine"><span class="battGlyph"><span class="battFill" id="battFill"></span></span>
        <span id="battTxt">-</span><span id="battBolt" style="display:none">${svgIcon(ICONS.bolt)}</span><span id="battDefrost" style="display:none" title="Defrost on"><svg viewBox="0 0 24 24"><path d="M6 21 q4 -4.5 0 -9 q-4 -4.5 0 -9 M12 21 q4 -4.5 0 -9 q-4 -4.5 0 -9 M18 21 q4 -4.5 0 -9 q-4 -4.5 0 -9" fill="none" stroke="#ff8c42" stroke-width="2.4" stroke-linecap="round"/></svg></span></div>
      <div class="sub" id="sub">-</div>
      <div class="diag" id="diag" hidden></div>
      <div class="carMenu" id="carMenu" hidden></div>
    </div>
    <div class="hdr-r">
      <button class="icobtn" id="btnRefresh" title="Force data update">${svgIcon(ICONS.refresh)}</button>
    </div>
  </div>

  <div class="carBox" id="carBox"></div>

  <div class="acts">
    <button class="abtn" id="aFlash">${svgIcon(ICONS.flash)}<span class="lb">Flash</span></button>
    <button class="abtn" id="aHonk">${svgIcon(ICONS.horn)}<span class="lb">Honk</span></button>
    <button class="abtn" id="aPort">${svgIcon(ICONS.plug)}<span class="lb">Port</span></button>
    <button class="abtn" id="aStart">${svgIcon(ICONS.power)}<span class="lb">Start</span></button>
    <button class="abtn" id="aVent">${svgIcon(ICONS.vent)}<span class="lb">Vent</span></button>
  </div>

  <div class="rows">
    <div class="row" id="rowClim">
      <button class="rowHead" id="headClim">${svgIcon(ICONS.fan, "ric")}
        <span><span class="rTitle">Climate</span><div class="rSub" id="climSub">-</div></span>
        ${svgIcon(ICONS.chevR, "chev")}</button>

    </div>
    <div class="row" id="rowChg">
      <button class="rowHead" id="headChg">${svgIcon(ICONS.bolt, "ric")}
        <span><span class="rTitle">Charging</span><div class="rSub" id="chgSub">-</div></span>
        ${svgIcon(ICONS.chevR, "chev")}</button>
      <div class="rowBody">
        <div class="chgLine1">Charge limit: <b id="cLimVal">-</b><span id="chgState"></span></div>
        <div class="chgLine2" id="chgLine2"></div>
        <div class="sliderWrap"><div class="limTick"></div>
          <input type="range" min="0" max="100" step="1" id="cLim" class="chgSlider"></div>
        <div class="ampRow"><button id="ampDn">‹</button><span id="cAmp">-</span><button id="ampUp">›</button></div>
        <div class="chgBtns" id="chgBtns">
          <button id="btnStopChg">Stop Charging</button>
          <button id="btnUnlockPort">Unlock Charge Port</button>
        </div>
      </div>
    </div>
    <div class="row" id="rowLoc">
      <button class="rowHead" id="headLoc">${svgIcon(ICONS.pin, "ric")}
        <span><span class="rTitle">Location</span><div class="rSub" id="locSub">-</div></span>
        ${svgIcon(ICONS.chevR, "chev")}</button>
    </div>
  </div>

  <div class="ftr">
    <span id="odo">-</span>
    <span id="upd">-</span>
  </div>
</ha-card>`;

      let carHtml = this._carSvg();
      if ((this._view === "ctl" && this._img("image_side")) || this._view === "clim")
        carHtml += '<button class="backBtn" id="ctlBack" title="Back">\u2039</button>';
      this.shadowRoot.getElementById("carBox").innerHTML = carHtml;
      this._buildCarMenu();
      this._wire();
    }

    _wire() {
      const q = (id) => this.shadowRoot.getElementById(id);
      q("btnRefresh").addEventListener("click", () => {
        this._call("button", "press", { entity_id: this._car._entities.refresh });
        q("btnRefresh").classList.add("spin");
        setTimeout(() => { const b = q("btnRefresh"); if (b) b.classList.remove("spin"); }, 4000);
      });

      // action row
      q("aFlash").addEventListener("click", () =>
        this._call("button", "press", { entity_id: this._car._entities.flash }));
      q("aHonk").addEventListener("click", () => {
        if (this._confirm("honk", q("aHonk"), "Honk"))
          this._call("button", "press", { entity_id: this._car._entities.horn });
      });
      q("aStart").addEventListener("click", () => {
        if (this._confirm("start", q("aStart"), "Start"))
          this._call("button", "press", { entity_id: this._car._entities.remote_start });
      });
      q("aVent").addEventListener("click", () => {
        if (this._confirm("vent", q("aVent"), "Vent")) this._toggleCover("windows_cover");
      });
      q("aPort").addEventListener("click", () => this._toggleCover("charge_port"));

      // resting <-> controls view
      const restW = q("restWrap");
      if (restW) restW.addEventListener("click", () => this._setView("ctl"));
      const backB = q("ctlBack");
      if (backB) backB.addEventListener("click", () => this._setView(""));

      // on-car taps
      const frunkG = this.shadowRoot.getElementById("frunkTap");
      const trunkG = this.shadowRoot.getElementById("trunkTap");
      const lockG = this.shadowRoot.getElementById("lockTap");
      if (frunkG) frunkG.addEventListener("click", () => {
        const lbl = this.shadowRoot.getElementById("frunkLbl");
        if (!this._arm.frunk) {
          this._arm.frunk = true; frunkG.classList.add("armed");
          lbl.textContent = "Tap again";
          clearTimeout(this._armT.frunk);
          this._armT.frunk = setTimeout(() => { this._arm.frunk = false; frunkG.classList.remove("armed"); this._update(); }, 3000);
          return;
        }
        this._arm.frunk = false; frunkG.classList.remove("armed"); clearTimeout(this._armT.frunk);
        this._toggleCover("frunk");
      });
      if (trunkG) trunkG.addEventListener("click", () => {
        const lbl = this.shadowRoot.getElementById("trunkLbl");
        if (!this._arm.trunk) {
          this._arm.trunk = true; trunkG.classList.add("armed");
          lbl.textContent = "Tap again";
          clearTimeout(this._armT.trunk);
          this._armT.trunk = setTimeout(() => { this._arm.trunk = false; trunkG.classList.remove("armed"); this._update(); }, 3000);
          return;
        }
        this._arm.trunk = false; trunkG.classList.remove("armed"); clearTimeout(this._armT.trunk);
        this._toggleCover("trunk");
      });
      if (lockG) lockG.addEventListener("click", () => this._toggleLock());

      // rows
      const toggleRow = (rowId) => {
        const row = this.shadowRoot.getElementById(rowId);
        row.classList.toggle("open");
        this._openRows[rowId] = row.classList.contains("open");
      };
      q("headClim").addEventListener("click", () => this._setView("clim"));
      q("headChg").addEventListener("click", () => toggleRow("rowChg"));
      q("headLoc").addEventListener("click", () => this._moreInfo("location"));

      // climate controls
      const cpwr = q("climPwr");
      if (cpwr) cpwr.addEventListener("click", (e) => { e.stopPropagation(); this._toggleClimate(); });
      const cvent = q("climVent");
      if (cvent) cvent.addEventListener("click", () => this._toggleCover("windows_cover"));
      // no rear-centre seat heater in any Tesla - seatRC removed globally (Nick, 2026-08-31)
      const SEATS = [["seatFL","seat_fl"],["seatFR","seat_fr"],["seatRL","seat_rl"],["seatRR","seat_rr"]];
      const AP = this._climAnchors();
      const SEAT_POS = { seatFL: AP.fl, seatFR: AP.fr, seatRL: AP.rl, seatRC: AP.rc, seatRR: AP.rr, wheelHeat: AP.wheel };
      const showToast = (id, label) => {
        const g = q("heatToast");
        if (!g) return;
        const [sx, sy] = SEAT_POS[id];
        const txt = q("heatToastTxt"), bg = q("heatToastBg");
        txt.textContent = label;
        const w = label.length * 7.6 + 18;
        const tx = Math.min(360 - w - 4, Math.max(4, sx - w / 2));
        const ty = Math.min(600 - 30, sy + 24);
        bg.setAttribute("x", tx); bg.setAttribute("y", ty); bg.setAttribute("width", w);
        txt.setAttribute("x", tx + 9); txt.setAttribute("y", ty + 17);
        g.style.display = "";
        clearTimeout(this._toastT);
        this._toastT = setTimeout(() => { const gg = q("heatToast"); if (gg) gg.style.display = "none"; }, 1600);
      };
      const cycleSeat = (id, key) => {
        if ((this._car.hide_seats || []).includes(id.slice(4).toLowerCase())) return;
        const s = this._st(key);
        if (!s) return;
        // Build the tap cycle from the options the integration actually offers,
        // preserving each option's exact spelling for the service call.
        // tesla_custom: Off/Auto/High/Medium/Low - tesla_fleet: off/low/medium/high
        // - ventilated-seat cars: Off/Heat Low/Heat Medium/Heat High/Auto/Cool….
        const avail = Array.isArray(s.attributes.options) && s.attributes.options.length
          ? s.attributes.options : ["Off", "Auto", "High", "Medium", "Low"];
        const find = (name) => avail.find((o) => {
          const l = o.toLowerCase();
          return l === name || l === "heat " + name;
        }) || null;
        const order = ["off", "auto", "high", "medium", "low"].map(find).filter(Boolean);
        if (!order.length) return;
        const pend = this._pendSeat && this._pendSeat.key === key && Date.now() - this._pendSeat.ts < 12000
          ? this._pendSeat.val : null;
        const base = (pend || s.state || "").toLowerCase();
        let i = order.findIndex((o) => o.toLowerCase() === base);
        const next = order[(i + 1) % order.length];
        this._pendSeat = { key, val: next, ts: Date.now() };
        const lbl = next.toLowerCase().replace(/^heat /, "");
        showToast(id, "Heat " + lbl.charAt(0).toUpperCase() + lbl.slice(1));
        this._call("select", "select_option", { entity_id: s.entity_id, option: next });
        this._update();
      };
      SEATS.forEach(([id, key]) => {
        const g = q(id);
        if (g) g.addEventListener("click", () => cycleSeat(id, key));
      });
      const whG = q("wheelHeat");
      if (whG) whG.addEventListener("click", () => {
        const s = this._steerEnt();
        if (!s) return;
        if (s.entity_id.startsWith("select.")) {
          /* step Off -> Low -> High -> Off using the car's own option order.
             Auto is skipped in the cycle: tapping out of Auto goes to the
             first real level, which is what the app does when you set a level
             by hand. Two heat steps on a real car, so the cycle is short. */
          const avail = (s.attributes.options || []).filter((o) => String(o).toLowerCase() !== "auto");
          if (!avail.length) return;
          const cur = String(s.state).toLowerCase();
          const i = avail.findIndex((o) => String(o).toLowerCase() === cur);
          const next = i < 0
            ? (avail.find((o) => String(o).toLowerCase() !== "off") || avail[0])
            : avail[(i + 1) % avail.length];
          this._call("select", "select_option", { entity_id: s.entity_id, option: next });
        } else {                                          // switch-only cars, eg the Model Y
          this._call("switch", s.state === "on" ? "turn_off" : "turn_on", { entity_id: s.entity_id });
        }
      });
      const dfBtn = q("btnDefrost");
      if (dfBtn) dfBtn.addEventListener("click", () => {
        /* decide from the same source that lights the button, so a stale
           preset_mode can't make the first press send the opposite command */
        const want = !this._defrostOn();
        const ds = this._st("defrost_switch");
        if (ds) {                                         // tesla_fleet: a real defrost switch
          this._call("switch", want ? "turn_on" : "turn_off", { entity_id: ds.entity_id });
          this._setPend("defrost", want);
          return;
        }
        const cs = this._st("climate");                   // tesla_custom: climate preset
        if (!cs) return;
        /* the app switches the climate on when you start defrosting; without
           this the HVAC can sit "off" and the card cannot tell a real defrost
           from a stale preset once the optimistic window closes */
        if (want && cs.state === "off")
          this._call("climate", "set_hvac_mode", { entity_id: cs.entity_id, hvac_mode: "heat_cool" });
        this._call("climate", "set_preset_mode", { entity_id: cs.entity_id, preset_mode: want ? "defrost" : "normal" });
        this._setPend("defrost", want);
      });
      const tU = q("tUp"), tD = q("tDn");
      if (tU) tU.addEventListener("click", () => this._bumpTemp(0.5));
      if (tD) tD.addEventListener("click", () => this._bumpTemp(-0.5));

      // extra climate controls (present only in the clim view, per capability)
      const setPreset = (mode) => {
        const cs2 = this._st("climate");
        if (!cs2) return;
        const presets = cs2.attributes.preset_modes || [];
        const back = presets.find((p) => String(p).toLowerCase() === "normal") ||
                     presets.find((p) => String(p).toLowerCase() === "off") || presets[0];
        const cur = (this._pendPreset && Date.now() - this._pendPreset.ts < 20000)
          ? this._pendPreset.val : cs2.attributes.preset_mode;
        const target = String(cur).toLowerCase() === mode
          ? back : presets.find((p) => String(p).toLowerCase() === mode);
        if (!target) return;
        this._pendPreset = { val: target, ts: Date.now() };
        this._call("climate", "set_preset_mode", { entity_id: cs2.entity_id, preset_mode: target });
        this._update();
      };
      const bioB = q("btnBio");
      if (bioB) bioB.addEventListener("click", () => {
        const cs2 = this._st("climate");
        if (!cs2) return;
        const fans = cs2.attributes.fan_modes || [];
        const bio = fans.find((f) => String(f).toLowerCase() === "bioweapon");
        const off = fans.find((f) => String(f).toLowerCase() === "off") || fans[0];
        const cur = (this._pendFan && Date.now() - this._pendFan.ts < 20000)
          ? this._pendFan.val : cs2.attributes.fan_mode;
        const target = String(cur).toLowerCase() === "bioweapon" ? off : bio;
        if (!target) return;
        this._pendFan = { val: target, ts: Date.now() };
        this._call("climate", "set_fan_mode", { entity_id: cs2.entity_id, fan_mode: target });
        this._update();
      });
      const campB = q("btnCamp");
      if (campB) campB.addEventListener("click", () => setPreset("camp"));
      const petB = q("btnPet");
      if (petB) petB.addEventListener("click", () => setPreset("dog"));
      const copSeg = q("copSeg");
      if (copSeg) copSeg.querySelectorAll("button").forEach((b) =>
        b.addEventListener("click", () => {
          const cop = this._st("cop");
          if (!cop) return;
          this._pendCop = { val: b.dataset.cop, ts: Date.now() };
          if (cop.entity_id.startsWith("select."))
            this._call("select", "select_option", { entity_id: cop.entity_id, option: b.dataset.cop });
          else
            this._call("climate", "set_hvac_mode", { entity_id: cop.entity_id, hvac_mode: b.dataset.cop });
          this._update();
        }));

      // charging controls
      const snapLim = (v) => {
        v = Math.max(50, Math.round(v));      // Tesla's floor is 50%
        if (v >= 76 && v <= 84) v = 80;       // click-stop at the recommended daily limit
        return v;
      };
      q("cLim").addEventListener("pointerdown", () => { this._limDrag = true; });
      q("cLim").addEventListener("change", (e) => {
        this._limDrag = false;
        const v = snapLim(+e.target.value);
        e.target.value = v;
        q("cLimVal").textContent = v + "%";
        this._call("number", "set_value", { entity_id: this._car._entities.charge_limit, value: v });
      });
      q("cLim").addEventListener("input", (e) => {
        this._limDrag = true;
        q("cLimVal").textContent = snapLim(+e.target.value) + "%";
      });
      q("ampUp").addEventListener("click", () => this._bumpAmps(1));
      const stopB = q("btnStopChg");
      if (stopB) stopB.addEventListener("click", () =>
        this._call("switch", "turn_off", { entity_id: this._car._entities.charger_switch }));
      const unlockB = q("btnUnlockPort");
      if (unlockB) unlockB.addEventListener("click", () => {
        const s = this._st("charge_port");
        if (!s) return;
        this._call("cover", unlockB.dataset.mode === "close" ? "close_cover" : "open_cover",
          { entity_id: s.entity_id });
      });
      q("ampDn").addEventListener("click", () => this._bumpAmps(-1));

      // calibration mode: tap any overlay to read overlay-space coordinates
      if (this._car.calibrate) {
        this.shadowRoot.querySelectorAll("svg.ovl").forEach((svg) => {
          svg.addEventListener("click", (e) => {
            const vb = (svg.getAttribute("viewBox") || "0 0 360 600").split(/\s+/).map(Number);
            const r = svg.getBoundingClientRect();
            const x = Math.round(vb[0] + ((e.clientX - r.left) / r.width) * vb[2]);
            const y = Math.round(vb[1] + ((e.clientY - r.top) / r.height) * vb[3]);
            const out = this.shadowRoot.getElementById("calibOut");
            if (out) out.textContent = x + "," + y;
            console.info("tesla-fleet-card calibrate:", x + "," + y);
          }, true);
        });
      }

      // restore open rows across rebuilds
      Object.keys(this._openRows).forEach((rid) => {
        if (this._openRows[rid]) {
          const row = this.shadowRoot.getElementById(rid);
          if (row) row.classList.add("open");
        }
      });
    }

    _buildCarMenu() {
      const q = (id) => this.shadowRoot.getElementById(id);
      const menu = q("carMenu");
      const btn = q("nmBtn");
      if (this._cars.length < 2) return;
      menu.innerHTML = this._cars
        .map((c, i) =>
          '<button data-i="' + i + '"><span class="dot" style="background:' +
            (PAINT_COLORS[String(c.paint || "").toLowerCase()] || "#f2f3f5") + '"></span>' +
          c.name + (c.model ? ' <span style="color:#8f8f8f;font-size:12px">' + c.model + "</span>" : "") +
          (i === this._sel ? " ✓" : "") + "</button>")
        .join("");
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
      });
      menu.querySelectorAll("button").forEach((b) => {
        b.addEventListener("click", (e) => {
          e.stopPropagation();
          this._selectCar(parseInt(b.dataset.i, 10));
        });
      });
      document.addEventListener("click", () => { if (menu && !menu.hidden) menu.hidden = true; });
    }

    _bumpAmps(d) {
      const s = this._st("charging_amps");
      if (!s) return;
      const min = s.attributes.min || 5, max = s.attributes.max || 32;
      const v = Math.min(max, Math.max(min, (parseFloat(s.state) || 16) + d));
      this._call("number", "set_value", { entity_id: s.entity_id, value: v });
    }
    _bumpTemp(d) {
      const s = this._st("climate");
      if (!s) return;
      const cur = s.attributes.temperature || 20;
      this._call("climate", "set_temperature", { entity_id: s.entity_id, temperature: Math.round((cur + d) * 2) / 2 });
    }
    _toggleLock() {
      const s = this._st("lock");
      if (!s) return;
      this._call("lock", s.state === "locked" ? "unlock" : "lock", { entity_id: s.entity_id });
    }
    /* Switching the climate off ends defrost in the app. Dropping our
       assumption isn't enough: the real preset_mode still reads "defrost" for a
       poll cycle, so the glass would stay lit. Assert defrost-off instead, the
       same way the Defrost button asserts defrost-on. */
    _toggleClimate() {
      const s = this._st("climate");
      if (!s) return;
      // tesla_custom's climate entity doesn't support climate.turn_on/turn_off -
      // set_hvac_mode works everywhere.
      const modes = s.attributes.hvac_modes || [];
      const turningOn = this._climOn() === false;
      if (turningOn) {
        const on = modes.find((m) => m === "heat_cool") || modes.find((m) => m && m !== "off") || "heat_cool";
        this._call("climate", "set_hvac_mode", { entity_id: s.entity_id, hvac_mode: on });
      } else {
        this._call("climate", "set_hvac_mode", { entity_id: s.entity_id, hvac_mode: "off" });
      }
      // optimistic: Tesla's state echo is slow - show the intent immediately
      if (turningOn) { if (this._pend) delete this._pend.defrost; }
      else this._setPend("defrost", false);
      this._setPend("clim", turningOn);
    }
    _climOn() {
      const want = this._pendVal("clim");
      const real = this._climReal();
      if (want === undefined) return real;
      if (real === want) { delete this._pend.clim; return real; }
      return want;
    }
    _climReal() {
      const s = this._st("climate");
      return !!s && s.state !== "off" && s.state !== "unavailable";
    }
    _toggleCover(key) {
      const s = this._st(key);
      if (!s) return;
      this._call("cover", s.state === "open" ? "close_cover" : "open_cover", { entity_id: s.entity_id });
    }

    _resting() {
      if (this._view === "ctl" || this._view === "clim") return false;
      // resting view only with a real photo - imageless cars open on the
      // top-down (drawn ¾ resting art removed for good, 2026-08-31)
      return !!this._img("image_side");
    }

    _carRest() {
      const chg = this._hass ? this._charging() : false;
      const plg = this._hass ? this._plugged() : false;
      const src = (chg && this._img("image_charging")) ||
                  (plg && (this._img("image_side_plugged") || this._img("image_charging"))) ||
                  this._img("image_side");
      /* the three pack variants are different camera angles, so the glass trace
         has to follow whichever photo we just chose */
      const rSfx = (chg && this._img("image_charging")) ? "RestCharging"
                 : (plg && this._img("image_side_plugged")) ? "RestPlugged"
                 : (plg && this._img("image_charging")) ? "RestCharging" : "Rest";
      const baked = this._cableBaked();
      // Baked pack photos already show the cable (green while charging) -
      // no overlay at all. The drawn overlay exists only for users whose own
      // photos have no cable in them.
      if (baked) {
        return `
<div class="imgWrap rest" id="restWrap" title="Open controls">
  <img id="restImg" class="carImg" src="${src}" alt="">
  <svg class="car ovl" viewBox="0 0 233 108" preserveAspectRatio="none" style="pointer-events:none">
    <defs>${dfDefs(rSfx, this._car)}</defs>
    ${dfGlow(rSfx, this._car, null, this._carBox(src, rSfx))}
  </svg>
  <button class="ctlBtn" id="ctlOpen">Controls</button>
</div>`;
      }
      const pxy = this._car.port_xy || "159,47";
      const [px, py] = pxy.split(",").map(Number);
      const cable = this._car.cable_path ||
        `M ${px - 43} 108 C ${px - 19} 103 ${px - 7} 76 ${px} ${py + 1}`;
      return `
<div class="imgWrap rest" id="restWrap" title="Open controls">
  <img id="restImg" class="carImg" src="${src}" alt="">
  <svg class="car ovl" viewBox="0 0 233 108" preserveAspectRatio="none" style="pointer-events:none">
    <defs>${dfDefs(rSfx, this._car)}</defs>
    ${dfGlow(rSfx, this._car, null, this._carBox(src, rSfx))}
  </svg>
  <svg class="car ovl" id="restChgOvl" viewBox="0 0 233 108" preserveAspectRatio="none" style="display:none">
    <path id="restCable" d="${cable}" stroke="#3f6db5" stroke-width="2.6" fill="none" stroke-linecap="round"/>
    <path id="restCableDash" d="${cable}" pathLength="100" stroke="#3aa869" stroke-opacity=".85" stroke-width="1.6" fill="none"
          stroke-linecap="round" stroke-dasharray="28 72" style="display:none">
      <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1.5s" repeatCount="indefinite"/>
    </path>
    <circle id="restGlow" cx="${px}" cy="${py}" r="2.6" fill="#4fd07a" style="display:none">
      <animate attributeName="opacity" values="1;.45;1" dur="1.5s" repeatCount="indefinite"/>
    </circle>
  </svg>
  <button class="ctlBtn" id="ctlOpen">Controls</button>
</div>`;
    }

    _setView(v) {
      if (this._view === v) return;
      this._view = v;
      this._built = false;
      this._build();
      this._update();
    }

    _carImg() {
      const chg = this._hass ? this._charging() : false;
      const plg = this._hass ? this._plugged() : false;
      const tsrc = (chg && this._img("image_top_charging")) ||
                   (plg && this._img("image_top_plugged")) ||
                   this._img("image");
      const baked = this._cableBaked();
      const [bx, by] = (this._car.port_top_xy || "40,692").split(",").map(Number);
      const boltArea = baked
        ? `<g id="boltPulse" style="display:none" transform="translate(${bx},${by})">
      <g>
        <path d="M2 -13 L -7 3 h 5 l -3 12 l 11 -17 h -6 l 5 -11 z" fill="#2bd96f"/>
        <animateTransform attributeName="transform" type="scale" values="1;1.28;1" dur="1.5s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values=".85;1;.85" dur="1.5s" repeatCount="indefinite"/>
      </g>
    </g>`
        : `<g id="boltG">
      <path id="cableP" d="M 8 750 C 20 716 30 668 46 606" stroke="#4fd07a" stroke-width="5" fill="none"
            stroke-linecap="round" style="display:none">
        <animate attributeName="stroke-dashoffset" from="36" to="0" dur="1.2s" repeatCount="indefinite"/>
      </path>
      <path id="boltP" d="M56 566 L 44 586 h 8 l -4 16 l 14 -22 h -8 l 6 -14 z" fill="#9aa0a6"/>
    </g>`;
      const TA = this._car.top_anchors || {};
      const [fkx, fky] = anchor(TA, "frunk", [180, 108]);
      const [lkx, lky] = anchor(TA, "lock", [180, baked ? 466 : 400]);
      const [tkx, tky] = anchor(TA, "trunk", [180, baked ? 658 : 612]);
      const tpmsFrontY = baked ? 150 : 120;
      const tpmsRearY = baked ? 640 : 650;
      return `
<div class="imgWrap">
  <img id="topImg" class="carImg" src="${tsrc}" alt="">
  ${this._car.calibrate ? '<div class="calib" id="calibOut">calibrate: tap the image to read x,y</div>' : ""}
  <svg class="car ovl" viewBox="0 0 360 773" preserveAspectRatio="none">
    <defs>${dfDefs("Top", this._car)}</defs>
    ${dfGlow("Top", this._car, null, this._carBox(tsrc, "Top"))}
    <g paint-order="stroke" stroke="#000000aa" stroke-width="3">
      <g id="frunkTap" class="tapa">
        <rect x="${fkx - 70}" y="${fky - 78}" width="140" height="130" rx="16" fill="#000" opacity="0" stroke="none"/>
        <text id="frunkLbl" class="olbl" x="${fkx}" y="${fky}" text-anchor="middle"
              font-size="20" font-weight="600" fill="#f2f3f4">Open</text>
      </g>
      <g id="trunkTap" class="tapa">
        <rect x="${tkx - 70}" y="${tky - 72}" width="140" height="120" rx="16" fill="#000" opacity="0" stroke="none"/>
        <text id="trunkLbl" class="olbl" x="${tkx}" y="${tky}" text-anchor="middle"
              font-size="20" font-weight="600" fill="#f2f3f4">Open</text>
      </g>
    </g>
    <g id="lockTap" class="tapa">
      <circle cx="${lkx}" cy="${lky}" r="30" fill="#000" opacity="0"/>
      <g id="lockIcon" transform="translate(${lkx - 14},${lky - 14}) scale(1.15)"></g>
    </g>
    ${boltArea}
    <g id="sentryEye" style="display:none">
      <circle cx="180" cy="14" r="8" fill="#141414" stroke="#d53a3a" stroke-width="2"/>
      <circle cx="180" cy="14" r="3" fill="#d53a3a">
        <animate attributeName="opacity" values="1;.2;1" dur="1.6s" repeatCount="indefinite"/>
      </circle>
    </g>
    <g id="tpmsG" font-size="15" font-weight="600" fill="#ececec" ${this._config.show_tpms ? "" : 'style="display:none"'}>
      <text id="tpFL" x="34" y="${tpmsFrontY}" text-anchor="middle">-</text>
      <text id="tpFR" x="326" y="${tpmsFrontY}" text-anchor="middle">-</text>
      <text id="tpRL" x="34" y="${tpmsRearY}" text-anchor="middle">-</text>
      <text id="tpRR" x="326" y="${tpmsRearY}" text-anchor="middle">-</text>
    </g>
  </svg>
</div>`;
    }

    /* Drawn cabin used when no interior photo exists - feature positions sit at
       the same fractional coordinates the heat-wave overlay expects. */
    _climCabinSvg() {
      return `
<svg class="carImg climImg" viewBox="0 0 360 480" style="display:block;width:300px;height:400px;max-height:none">
  <defs>
    <linearGradient id="cabV" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#23262b"/><stop offset=".18" stop-color="#1a1c20"/>
      <stop offset="1" stop-color="#141619"/>
    </linearGradient>
  </defs>
  <!-- cabin shell -->
  <path d="M70 34 C 110 18 250 18 290 34 C 306 42 314 60 316 92 L 320 380
           C 320 428 306 452 278 458 C 220 468 140 468 82 458 C 54 452 40 428 40 380
           L 44 92 C 46 60 54 42 70 34 Z" fill="url(#cabV)" stroke="#0b0c0e" stroke-width="2"/>
  <!-- windshield header -->
  <path d="M70 34 C 110 18 250 18 290 34 C 298 38 304 45 308 55 C 260 40 100 40 52 55
           C 56 45 62 38 70 34 Z" fill="#0e1013"/>
  <!-- dash -->
  <path d="M54 58 C 110 44 250 44 306 58 L 306 84 C 250 72 110 72 54 84 Z" fill="#2a2d33"/>
  <path d="M150 62 L 210 62 L 208 78 L 152 78 Z" fill="#17191d"/>
  <!-- steering wheel (right-hand drive, matches the tap anchor) -->
  <circle cx="234" cy="78" r="25" fill="none" stroke="#3d4147" stroke-width="7"/>
  <circle cx="234" cy="78" r="4" fill="#3d4147"/>
  <path d="M212 74 L 230 78 M256 74 L 238 78 M234 100 L 234 84" stroke="#3d4147" stroke-width="5" stroke-linecap="round"/>
  <!-- door panels -->
  <path d="M44 100 L 60 104 L 58 400 L 42 396 Z" fill="#202329"/>
  <path d="M316 100 L 300 104 L 302 400 L 318 396 Z" fill="#202329"/>
  <!-- centre console -->
  <rect x="163" y="98" width="34" height="104" rx="10" fill="#22252a"/>
  <rect x="169" y="106" width="22" height="32" rx="5" fill="#17191d"/>
  <!-- front seats (centres align with the heat-wave anchors) -->
  <g fill="#2e3237" stroke="#0e1013" stroke-width="1.5">
    <rect x="91" y="88" width="60" height="12" rx="6"/>
    <path d="M87 104 h 68 a10 10 0 0 1 10 10 v 40 a12 12 0 0 1 -12 12 h -64 a12 12 0 0 1 -12 -12 v -40 a10 10 0 0 1 10 -10 Z"/>
    <rect x="203" y="88" width="60" height="12" rx="6"/>
    <path d="M199 104 h 68 a10 10 0 0 1 10 10 v 40 a12 12 0 0 1 -12 12 h -64 a12 12 0 0 1 -12 -12 v -40 a10 10 0 0 1 10 -10 Z"/>
  </g>
  <g stroke="#1c1f23" stroke-width="2" fill="none">
    <path d="M97 112 v 44 M145 112 v 44 M209 112 v 44 M257 112 v 44"/>
  </g>
  <!-- rear bench -->
  <g fill="#2e3237" stroke="#0e1013" stroke-width="1.5">
    <rect x="97" y="188" width="52" height="11" rx="5.5"/>
    <rect x="150" y="188" width="52" height="11" rx="5.5"/>
    <rect x="203" y="188" width="52" height="11" rx="5.5"/>
    <path d="M84 204 h 192 a12 12 0 0 1 12 12 v 40 a14 14 0 0 1 -14 14 h -188 a14 14 0 0 1 -14 -14 v -40 a12 12 0 0 1 12 -12 Z"/>
  </g>
  <path d="M150 210 v 54 M210 210 v 54" stroke="#1c1f23" stroke-width="2.5"/>
  <!-- boot floor -->
  <rect x="70" y="290" width="220" height="138" rx="16" fill="#191b1f"/>
  <path d="M84 306 h 192 M84 330 h 192" stroke="#212429" stroke-width="2"/>
</svg>`;
    }

    _climAnchors() {
      const m = this._car.climate_anchors || {};
      const pos = {};
      Object.keys(CLIM_ANCHOR_DEFAULTS).forEach((k) => { pos[k] = anchor(m, k, CLIM_ANCHOR_DEFAULTS[k]); });
      return pos;
    }

    _carClim() {
      const car = this._car;
      const photo = this._img("image_climate");
      const A = this._climAnchors();
      const cm = car.climate_anchors || {};
      const [ppx, ppy] = anchor(cm, "port", [78, 478]);
      const vent = (x, rot, cls) => {
        const coneDur = cls === "vR" ? "3s" : "3.6s";
        const coneBeg = cls === "vR" ? "1.1s" : "0s";
        const s1Beg = cls === "vR" ? "0.7s" : "0s";
        return `
      <g class="vent ${cls}" transform="translate(${x} 60) rotate(${rot})">
        <path class="cone" d="M -9 0 L -44 186 Q 0 210 44 186 L 9 0 Z" fill="url(#coneG)" filter="url(#mistBlur)">
          <animate attributeName="opacity" values=".7;1;.7" keyTimes="0;.5;1" dur="${coneDur}" begin="${coneBeg}" repeatCount="indefinite"/>
          <animateTransform attributeName="transform" type="scale" values=".94 1;1.08 1;.94 1" keyTimes="0;.5;1"
                            calcMode="spline" keySplines=".45 0 .55 1;.45 0 .55 1" dur="${coneDur}" begin="${coneBeg}" repeatCount="indefinite"/>
        </path>
        <g clip-path="url(#coneClip-${cls})">
          <path class="streak s1" d="M -18 32 C -26 66 -10 100 -20 140" stroke="#eef3f8" stroke-width="11"
                fill="none" stroke-linecap="round" filter="url(#mistBlur)" opacity="0">
            <animate attributeName="opacity" values="0;.5;.3;0" keyTimes="0;.25;.7;1" dur="2.6s" begin="${s1Beg}" repeatCount="indefinite"/>
            <animateTransform attributeName="transform" type="translate" values="0 -16;0 52" dur="2.6s" begin="${s1Beg}" repeatCount="indefinite"/>
          </path>
          <path class="streak s2" d="M 15 26 C 8 64 24 102 13 144" stroke="#eef3f8" stroke-width="10"
                fill="none" stroke-linecap="round" filter="url(#mistBlur)" opacity="0">
            <animate attributeName="opacity" values="0;.5;.3;0" keyTimes="0;.25;.7;1" dur="3.1s" begin="1.3s" repeatCount="indefinite"/>
            <animateTransform attributeName="transform" type="translate" values="0 -16;0 52" dur="3.1s" begin="1.3s" repeatCount="indefinite"/>
          </path>
        </g>
      </g>`;
      };
      return `
<div class="imgWrap climWrap">
  ${photo ? `<img class="carImg climImg" src="${photo}" alt="">` : this._climCabinSvg()}
  ${car.calibrate ? '<div class="calib" id="calibOut">calibrate: tap the image to read x,y</div>' : ""}
  <svg class="car ovl" viewBox="0 0 360 600" preserveAspectRatio="none">
    <defs>
      <filter id="mistBlur" x="-120%" y="-30%" width="340%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
      <linearGradient id="coneG" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#e6ecf3" stop-opacity=".5"/>
        <stop offset=".55" stop-color="#e6ecf3" stop-opacity=".22"/>
        <stop offset="1" stop-color="#e6ecf3" stop-opacity="0"/>
      </linearGradient>
      <clipPath id="coneClip-vL"><path d="M -11 0 L -46 188 Q 0 214 46 188 L 11 0 Z"/></clipPath>
      <clipPath id="coneClip-vR"><path d="M -11 0 L -46 188 Q 0 214 46 188 L 11 0 Z"/></clipPath>
      ${dfDefs("Clim", car)}
    </defs>
    ${dfGlow("Clim", car, null, this._carBox(photo, "Clim"))}
    <g id="climHaze" style="display:none">
      ${vent(A.fl[0], -3, "vL")}
      ${vent(A.fr[0], 3, "vR")}
    </g>
    <g id="climCableG" style="display:none">
      <path id="climCable" d="M ${ppx - 78} ${ppy + 84} C ${ppx - 36} ${ppy + 80} ${ppx - 26} ${ppy + 46} ${ppx - 11} ${ppy + 17} C ${ppx - 7} ${ppy + 9} ${ppx - 3} ${ppy + 4} ${ppx} ${ppy}"
            stroke="#3f6db5" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path id="climCableDash" d="M ${ppx - 78} ${ppy + 84} C ${ppx - 36} ${ppy + 80} ${ppx - 26} ${ppy + 46} ${ppx - 11} ${ppy + 17} C ${ppx - 7} ${ppy + 9} ${ppx - 3} ${ppy + 4} ${ppx} ${ppy}"
            pathLength="100" stroke="#3aa869" stroke-opacity=".9" stroke-width="2.4" fill="none"
            stroke-linecap="round" stroke-dasharray="28 72" style="display:none">
        <animate attributeName="stroke-dashoffset" from="100" to="0" dur="1.5s" repeatCount="indefinite"/>
      </path>
      <path id="climBolt" transform="translate(${ppx - 42} ${ppy - 46})"
            d="M10 0 L 0 17 h 7 l -3.5 14 l 12 -19 h -7 l 5 -12 z" fill="#cfd2d5"/>
      <rect id="climPortNub" x="${ppx - 4}" y="${ppy - 10}" width="9" height="11" rx="1.5"
            fill="#2a2c2e" stroke="#606468" stroke-width="1"/>
      <path id="climPortFlap" d="M ${ppx + 4} ${ppy - 25} L ${ppx - 4} ${ppy - 12} L ${ppx + 11} ${ppy - 16} Z"
            fill="#c62f36" stroke="#7e1f24" stroke-width="1" stroke-linejoin="round"/>
      <circle id="climGlow" cx="${ppx}" cy="${ppy}" r="4" fill="#d53a3a">
        <animate attributeName="opacity" values="1;.45;1" dur="1.5s" repeatCount="indefinite"/>
      </circle>
    </g>
    ${heatWaves("seatFL", A.fl[0], A.fl[1])}
    ${heatWaves("seatFR", A.fr[0], A.fr[1])}
    ${heatWaves("seatRL", A.rl[0], A.rl[1])}
    ${heatWaves("seatRR", A.rr[0], A.rr[1])}
    <g id="wheelHeat" class="tapa" style="cursor:pointer">
      <circle cx="${A.wheel[0]}" cy="${A.wheel[1]}" r="26" fill="#000" opacity="0"/>
      <g id="wheelHeatIcon" transform="translate(${A.wheel[0] - 17},${A.wheel[1] - 17}) scale(1.42)">
        <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4C15.72,4 18.85,6.55 19.74,10H4.26C5.15,6.55 8.28,4 12,4M12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14M4.26,14H8.09L11,17V19.93C7.55,19.5 4.79,17.06 4.26,14M15.91,14H19.74C19.21,17.06 16.45,19.5 13,19.93V17L15.91,14Z"
              fill="#a9adb2"/>
      </g>
      <path id="wheelHeat_w0" d="M ${A.wheel[0] - 5} ${A.wheel[1] - 15} q 3.4 -2.6 0 -5.2 q -3.4 -2.6 0 -5.2"
            stroke="#a9adb2" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <path id="wheelHeat_w1" d="M ${A.wheel[0] + 5} ${A.wheel[1] - 15} q 3.4 -2.6 0 -5.2 q -3.4 -2.6 0 -5.2"
            stroke="#a9adb2" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <text id="wheelHeat_auto" x="${A.wheel[0]}" y="${A.wheel[1] + 25}" text-anchor="middle"
            font-size="10.5" font-weight="700" fill="#a9adb2" style="display:none">Auto</text>
    </g>
    <g id="heatToast" style="display:none">
      <rect id="heatToastBg" x="0" y="0" rx="6" height="24" width="90" fill="#000000d0"/>
      <text id="heatToastTxt" x="0" y="0" font-size="13.5" font-weight="600" fill="#f2f3f4"></text>
    </g>
  </svg>
</div>
<div class="climPage">
  <div class="climTemps" id="climTemps">-</div>
  <div class="climCtl">
    <button class="pwr" id="climPwr">${svgIcon(ICONS.power)}<span id="climPwrLb">Off</span></button>
    <button class="arrow" id="tDn">‹</button>
    <span class="big" id="tTgt">-</span>
    <button class="arrow" id="tUp">›</button>
    <button class="pwr" id="climVent">${svgIcon(ICONS.vent)}<span>Vent</span></button>
  </div>
  <button class="defrostBtn" id="btnDefrost">${climIcon(CLIM_GLYPH.defrost)}Defrost Car</button>
  ${this._climExtraHtml()}
</div>`;
    }

    /* Bioweapon / Camp / Pet / Cabin Overheat Protection - rendered only when
       the integration exposes the matching capability. */
    _climExtraHtml() {
      const cs = this._st("climate");
      const fans = (cs && cs.attributes.fan_modes) || [];
      const presets = (cs && cs.attributes.preset_modes) || [];
      const has = (arr, v) => arr.some((o) => String(o).toLowerCase() === v);
      /* tesla_custom reports the SAME preset_modes and fan_modes list for every
         car, so these lists are not capability detection. Buddy is offered
         Bioweapon Defense and has no such thing. There is no reliable signal
         to test, so a car can opt out by name: hide_climate: [bio, camp, pet]. */
      const hidden = (this._car.hide_climate || []).map((x) => String(x).toLowerCase());
      const show = (k) => hidden.indexOf(k) < 0;
      let html = "";
      if (has(fans, "bioweapon") && show("bio"))
        html += `<button class="defrostBtn climX" id="btnBio">${climIcon(`<path d="${ICONS.shield}"/>`)}Bioweapon Defense Mode</button>`;
      if (has(presets, "camp") && show("camp"))
        html += `<button class="defrostBtn climX" id="btnCamp">${climIcon(CLIM_GLYPH.tent)}Camp Mode</button>`;
      if (has(presets, "dog") && show("pet"))
        html += `<button class="defrostBtn climX" id="btnPet">${climIcon(CLIM_GLYPH.paw)}Pet Mode</button>`;
      const cop = this._st("cop");
      if (cop) {
        let segs;
        if (cop.entity_id.startsWith("select.")) {
          segs = (cop.attributes.options || ["Off", "No A/C", "On"]).map((o) => [o, o]);
        } else {   // tesla_fleet exposes it as a climate entity
          segs = [["Off", "off"], ["No A/C", "fan_only"], ["On", "cool"]];
        }
        html += `<div class="copWrap"><div class="copLbl">Cabin Overheat Protection</div>
          <div class="copSeg" id="copSeg">` +
          segs.map(([label, val]) => `<button data-cop="${val}">${label}</button>`).join("") +
          `</div></div>`;
      }
      return html;
    }

    _carSvg() {
      if (this._view === "clim") return this._carClim();
      if (this._resting()) return this._carRest();
      if (this._img("image")) return this._carImg();
      return this._carArt();
    }

    /* Built-in fallback artwork - outlines traced 1:1 from reference photos of the
       real cars (Model 3 art currently shares the Model Y trace); the surface
       rendering is original. Tap/overlay anchors match the previous geometry. */
    /* No image pack for this model+paint. There used to be a full drawn car
       here as a fallback; it was removed deliberately - a hand-drawn car that
       is not quite your car reads as broken, and it quietly removed any reason
       to contribute a pack. Say what is missing, list what exists, recruit. */
    _carArt() {
      const car = this._car;
      const dir = /3/.test(String(car.model || "")) ? "3" : "y";
      const slug = String(car.paint || "").toLowerCase().replace(/[^a-z]/g, "");
      const path = "images/models/" + dir + "/" + (slug || "&lt;paint&gt;") + "/app/";
      const have = PACKS_SHIPPED.map((p) =>
        `<li><b>${esc(p.model)}</b> &middot; ${esc(p.paint)}</li>`).join("");
      return `
<div class="noPack">
  <svg class="noPackCar" viewBox="0 0 64 26" aria-hidden="true">
    <path d="M3 19 L6 12 C8 8 12 6 20 6 h16 c8 0 13 2 17 6 l4 7"
          fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M2 19 h60" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    <circle cx="17" cy="19" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
    <circle cx="47" cy="19" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
  </svg>
  <div class="noPackTitle">No image pack yet</div>
  <div class="noPackBody">Nothing bundled for <b>${esc(car.model || "this model")}</b>
    in <b>${esc(car.paint || "no paint set")}</b>. Everything else on this card works -
    only the picture is missing.</div>
  <div class="noPackHave">Packs that ship today:<ul>${have}</ul>
    Set <b>Model</b> and <b>Paint</b> to one of these to borrow its artwork.</div>
  <div class="noPackPath">${path}</div>
  <div class="noPackBody">A pack is seven photos from the Tesla app. If you own this car,
    you are the right person to build one -
    <a href="https://github.com/MrNickIE/tesla-fleet-homeassistant" target="_blank" rel="noopener">contribute a pack</a>.</div>
</div>`;
    }

    _setLockIcon(locked) {
      const g = this.shadowRoot.getElementById("lockIcon");
      if (!g) return;
      g.innerHTML = '<path d="' + (locked ? ICONS.lock : ICONS.unlock) + '" fill="#dfe0e2" opacity=".95"/>';
    }

    _update() {
      const q = (id) => this.shadowRoot.getElementById(id);

      /* Detection is all-or-nothing: miss the battery entity and NOTHING
         resolves, so the card used to render blank with no explanation of why
         (issue #1 - the reporter had no way to tell it was a prefix problem). */
      const dg = q("diag");
      if (dg) {
        const c0 = this._car;
        if (c0 && !c0._integration && this._hass) {
          const p = String(c0.prefix || "").replace(/[&<>"]/g, (m) =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
          dg.innerHTML = "No Tesla entities found for prefix <b>" + (p || "(empty)") + "</b>. " +
            "This card looks for <code>sensor." + p + "battery</code> (Tesla Custom) or " +
            "<code>sensor." + p + "battery_level</code> (Tesla Fleet). Open " +
            "<b>Developer tools &rarr; States</b>, find your car's battery sensor, and set the " +
            "prefix to everything between <code>sensor.</code> and <code>battery</code> " +
            "(including the trailing underscore).";
          dg.hidden = false;
        } else {
          dg.hidden = true;
        }
      }

      // battery line
      const pct = this._num("battery");
      const rng = this._num("range");
      const charging = this._charging();
      const bf = q("battFill");
      bf.style.width = Math.max(0, Math.min(100, pct || 0)) * 0.21 + "px";
      bf.className = "battFill" + (charging ? " chg" : pct !== null && pct <= 10 ? " crit" : pct !== null && pct <= 20 ? " low" : "");
      q("battTxt").textContent =
        (pct === null ? "-" : Math.round(pct) + "%") +
        (rng === null ? "" : " · " + Math.round(rng) + " " + this._unit("range", "km"));

      // status
      const asleep = this._is("asleep", "on");
      const online = this._is("online", "on");
      const shiftS = this._st("shift");
      const shift = shiftS ? shiftS.state : "P";
      let status, durKey;
      if (!online) { status = "Offline"; durKey = "online"; }
      else if (charging) { status = "Charging"; durKey = "charging"; }
      else if (asleep) { status = "Asleep"; durKey = "asleep"; }
      else if (shift === "D" || shift === "R" || shift === "N") { status = "Driving"; durKey = "shift"; }
      else { status = "Parked"; durKey = "shift"; }
      const durS = this._st(durKey);
      const dur = durS ? relDur(durS.last_changed) : "";
      let subTxt = status + (dur && dur !== "just now" ? " " + dur : "");
      if (charging) {
        const mins = this._minsToFull();
        if (!isNaN(mins) && mins > 0) {
          const h = Math.floor(mins / 60), m = Math.round(mins % 60);
          subTxt = (h ? h + "h " : "") + m + "m remaining to charge limit";
        }
      }
      /* The app puts the running mode where the title goes, so you cannot miss
         it. The card's equivalent is this status line. Pet Mode on a parked car
         used to be invisible unless you opened the Climate view, which is a bad
         way to treat a mode whose whole job is keeping an animal safe. */
      const climS0 = this._st("climate");
      const pmode = String((climS0 && climS0.attributes.preset_mode) || "").toLowerCase();
      const MODE_LABEL = { dog: "Pet Mode", camp: "Camp Mode", keep: "Keep Climate On", defrost: "Defrosting" };
      if (MODE_LABEL[pmode]) subTxt = MODE_LABEL[pmode] + " \u00b7 " + subTxt;
      q("sub").textContent = subTxt;

      // on-car states
      const lockS = this._st("lock");
      const locked = lockS && lockS.state === "locked";
      this._setLockIcon(locked);
      const frunkOpen = this._is("frunk", "open");
      const trunkOpen = this._is("trunk", "open");
      if (!this._arm.frunk) {
        const fl = q("frunkLbl");
        if (fl) { fl.textContent = frunkOpen ? "Close" : "Open"; fl.style.fill = frunkOpen ? "#e0a63c" : ""; }
      }
      if (!this._arm.trunk) {
        const tl = q("trunkLbl");
        if (tl) { tl.textContent = trunkOpen ? "Close" : "Open"; tl.style.fill = trunkOpen ? "#e0a63c" : ""; }
      }
      const plugged = this._plugged();
      const portOpen2 = this._is("charge_port", "open");
      const bolt = q("boltP");
      if (bolt) {
        bolt.style.display = plugged ? "" : "none";
        bolt.setAttribute("fill", charging ? "#4fd07a" : "#cfd2d5");
      }
      const nub = q("portNub");
      if (nub) nub.style.display = plugged ? "" : "none";
      const flap = q("portFlap");
      if (flap) flap.style.display = plugged || portOpen2 ? "" : "none";
      const se = q("sentryEye");
      if (se) se.style.display = this._is("sentry", "on") ? "" : "none";
      const bBolt = q("battBolt");
      if (bBolt) bBolt.style.display = charging ? "" : "none";
      q("battTxt").style.color = charging ? "#4fd07a" : "";
      const bakedC = this._cableBaked();
      const rOvl = q("restChgOvl");
      if (rOvl) {
        rOvl.style.display = (!bakedC && (charging || plugged) && this._img("image_charging")) ? "" : "none";
        const rc = q("restCable");
        if (rc) rc.setAttribute("stroke", charging ? "#2f7a49" : "#3f6db5");
        const rd = q("restCableDash");
        if (rd) rd.style.display = charging ? "" : "none";
        const rg = q("restGlow");
        if (rg) rg.style.display = charging ? "" : "none";
      }
      const ri = q("restImg");
      if (ri) {
        const rsrc = (charging && this._img("image_charging")) ||
                     (plugged && (this._img("image_side_plugged") || this._img("image_charging"))) ||
                     this._img("image_side");
        if (rsrc && !ri.getAttribute("src").endsWith(rsrc)) ri.setAttribute("src", rsrc);
      }
      const ti = q("topImg");
      if (ti) {
        const tsrc = (charging && this._img("image_top_charging")) ||
                     (plugged && this._img("image_top_plugged")) ||
                     this._img("image");
        if (tsrc && !ti.getAttribute("src").endsWith(tsrc)) ti.setAttribute("src", tsrc);
      }
      const bpulse = q("boltPulse");
      if (bpulse) bpulse.style.display = charging ? "" : "none";
      const cBtns = q("chgBtns");
      if (cBtns) {
        const portOpen = this._is("charge_port", "open");
        const stopB2 = q("btnStopChg");
        const portB2 = q("btnUnlockPort");
        cBtns.classList.toggle("show", charging || plugged || portOpen);
        if (stopB2) stopB2.style.display = charging ? "" : "none";
        if (portB2) {
          portB2.style.gridColumn = charging ? "" : "1 / -1";
          if (!charging && !plugged && portOpen) {
            portB2.textContent = "Close Charge Port";
            portB2.dataset.mode = "close";
          } else {
            portB2.textContent = "Unlock Charge Port";
            portB2.dataset.mode = "unlock";
          }
        }
      }

      // tpms - tesla_custom reports psi, tesla_fleet reports bar
      if (this._config.show_tpms) {
        const u = this._unit("tpms_fl", "psi").toLowerCase();
        const isBar = u === "bar";
        const minWarn = isBar ? this._config.tpms_min / 14.5038 : this._config.tpms_min;
        [["tpFL", "tpms_fl"], ["tpFR", "tpms_fr"], ["tpRL", "tpms_rl"], ["tpRR", "tpms_rr"]].forEach(([id, key]) => {
          const v = this._num(key);
          const el = q(id);
          if (!el) return;
          el.textContent = v === null ? "" : (isBar ? v.toFixed(1) : Math.round(v)) + " " + u;
          el.style.fill = v !== null && v < minWarn ? "#e0a63c" : "#ececec";
        });
      }

      // action row states
      const vent = q("aVent");
      if (vent && !this._arm.vent) vent.classList.toggle("on", this._is("windows_cover", "open"));

      // climate row
      const climS = this._st("climate");
      const climOn = this._climOn();
      const inT = this._num("inside_temp");
      const outT = this._num("outside_temp");
      q("climSub").textContent =
        (climOn ? "On · " : "") +
        (inT === null ? "" : "Interior " + Math.round(inT) + "°") +
        (outT === null ? "" : (inT === null ? "" : " · ") + "Exterior " + Math.round(outT) + "°");
      const pwr = q("climPwr");
      if (pwr) {
        pwr.classList.toggle("on", !!climOn);
        q("climPwrLb").textContent = climOn ? "On" : "Off";
      }
      const tT = q("tTgt");
      if (tT) tT.textContent = climS && climS.attributes.temperature ? climS.attributes.temperature + "°" : "-";
      const ctTemps = q("climTemps");
      if (ctTemps) ctTemps.textContent =
        (inT === null ? "" : "Interior " + Math.round(inT) + "°C") +
        (outT === null ? "" : (inT === null ? "" : "  ·  ") + "Exterior " + Math.round(outT) + "°C") || "-";
      const cVent = q("climVent");
      if (cVent) cVent.classList.toggle("on", this._is("windows_cover", "open"));
      const hideSeats = (this._car.hide_seats || []).map((x) => String(x).toLowerCase());
      /* Auto is a MODE, not a level. The app writes the word under the glyph
         rather than implying a level, so the card does the same. The waves are
         still coloured, because the car may well be heating right now; the
         label is what stops Auto reading as "someone set this to maximum". */
      const paintHeat = (id, h) => {
        const g = q(id);
        if (!g) return;
        const col = h.mode === "cool" ? COOL_COL : HEAT_COL;
        const lit = h.mode === "auto" ? 3 : h.level;
        g.classList.toggle("heatOn", h.mode !== "off");
        for (let i = 0; i < 3; i++) {
          const w = q(id + "_w" + i);
          if (w) w.setAttribute("stroke", i < lit ? col : IDLE_COL);
        }
        const at = q(id + "_auto");
        if (at) {
          at.style.display = h.mode === "auto" ? "" : "none";
          at.setAttribute("fill", col);
        }
      };
      [["seatFL","seat_fl"],["seatFR","seat_fr"],["seatRL","seat_rl"],["seatRR","seat_rr"]].forEach(([id, key]) => {
        const g = q(id);
        if (!g) return;
        const s = this._st(key);
        // hide seats the integration doesn't expose, that are unavailable,
        // or that the car physically lacks (hide_seats: [rc] etc.)
        const hidden = !s || s.state === "unavailable" || s.state === "unknown" ||
                       hideSeats.includes(id.slice(4).toLowerCase());
        g.style.display = hidden ? "none" : "";
        if (hidden) return;
        let st = s.state || "off";
        if (this._pendSeat && this._pendSeat.key === key && Date.now() - this._pendSeat.ts < 12000) st = this._pendSeat.val;
        paintHeat(id, parseHeat(st));
      });
      if (q("wheelHeat")) {
        const wEnt = this._steerEnt();
        q("wheelHeat").style.display = wEnt ? "" : "none";
        const wh = parseHeat(wEnt && wEnt.state);
        const whOn = wh.mode !== "off";
        /* the app steps the wheel glyph through its levels the same way it
           steps the seats, so two waves here rather than three: a real car has
           two heat steps on the wheel, not three. */
        const wCol = wh.mode === "cool" ? COOL_COL : HEAT_COL;
        const wLit = wh.mode === "auto" ? 2 : Math.min(wh.level, 2);
        for (let i = 0; i < 2; i++) {
          const w = q("wheelHeat_w" + i);
          if (w) w.setAttribute("stroke", i < wLit ? wCol : IDLE_COL);
        }
        const wAuto = q("wheelHeat_auto");
        if (wAuto) {
          wAuto.style.display = wh.mode === "auto" ? "" : "none";
          wAuto.setAttribute("fill", wh.mode === "cool" ? COOL_COL : HEAT_COL);
        }
        q("wheelHeat").classList.toggle("wheelOn", whOn);
        const wIc = q("wheelHeatIcon");
        if (wIc) wIc.querySelector("path").setAttribute("fill",
          whOn ? (wh.mode === "cool" ? COOL_COL : HEAT_COL) : IDLE_COL);
      }
      const dfOn = this._defrostOn();
      const dfB = q("btnDefrost");
      if (dfB) {
        dfB.classList.toggle("on", dfOn);
        dfB.classList.toggle("pending", this._pendVal("defrost") !== undefined);
      }
      const cpB = q("climPwr");
      if (cpB) cpB.classList.toggle("pending", this._pendVal("clim") !== undefined);
      const dfBadge = q("battDefrost");
      if (dfBadge) dfBadge.style.display = dfOn ? "" : "none";
      ["dfClim", "dfTop", "dfRest", "dfRestPlugged", "dfRestCharging"].forEach((gid) => {
        const gg = q(gid);
        if (gg) gg.style.display = dfOn ? "" : "none";
      });
      const haze = q("climHaze");
      /* the app does not draw vent mist while defrost is running */
      if (haze) haze.style.display = climOn && !dfOn ? "" : "none";
      const ccg = q("climCableG");
      if (ccg) {
        ccg.style.display = plugged ? "" : "none";
        const cc = q("climCable");
        if (cc) cc.setAttribute("stroke", charging ? "#2f7a49" : "#3f6db5");
        const ccd = q("climCableDash");
        if (ccd) ccd.style.display = charging ? "" : "none";
        const cg = q("climGlow");
        if (cg) cg.setAttribute("fill", charging ? "#4fd07a" : plugged ? "#d53a3a" : "#6f6f6f");
        const cb = q("climBolt");
        if (cb) cb.setAttribute("fill", charging ? "#4fd07a" : "#cfd2d5");
      }
      const pendVal = (p) => p && Date.now() - p.ts < 20000 ? p.val : null;
      const curPreset = String(pendVal(this._pendPreset) || (climS && climS.attributes.preset_mode) || "").toLowerCase();
      const curFan = String(pendVal(this._pendFan) || (climS && climS.attributes.fan_mode) || "").toLowerCase();
      const bioB2 = q("btnBio");
      if (bioB2) bioB2.classList.toggle("on", curFan === "bioweapon");
      const campB2 = q("btnCamp");
      if (campB2) campB2.classList.toggle("on", curPreset === "camp");
      const petB2 = q("btnPet");
      if (petB2) petB2.classList.toggle("on", curPreset === "dog");
      const copSeg2 = q("copSeg");
      if (copSeg2) {
        const cop = this._st("cop");
        const cur = String(pendVal(this._pendCop) || (cop && cop.state) || "").toLowerCase();
        copSeg2.querySelectorAll("button").forEach((b) =>
          b.classList.toggle("on", String(b.dataset.cop).toLowerCase() === cur));
      }

      // charging row
      const lim = this._num("charge_limit");
      const pw = this._num("charger_power");
      const eta = this._etaText();
      let chgSub;
      if (charging) chgSub = "Charging" + (pw ? " · " + pw + " kW" : "") + (eta ? " · done " + eta : "");
      else if (plugged) chgSub = "Charging Complete";
      else chgSub = "Unplugged" + (lim ? " · Limit " + Math.round(lim) + "%" : "");
      q("chgSub").textContent = chgSub;
      q("chgState").textContent = charging
        ? "  ·  Charging" + (pw ? " at " + pw + " kW" : "")
        : plugged ? "  ·  Charging Complete" : "";
      const ad = this._num("energy_added");
      if (charging) {
        const bits = [];
        if (pw !== null) bits.push(pw + " kW");
        if (ad !== null) bits.push("+" + ad + " kWh");
        const amS = this._st("charging_amps");
        if (amS) {
          const mx = amS.attributes.max;
          bits.push(Math.round(parseFloat(amS.state)) + (mx ? "/" + Math.round(mx) : "") + "A");
        }
        const volts = this._num("charger_voltage");
        if (volts !== null) bits.push(Math.round(volts) + "V");
        q("chgLine2").textContent = bits.join(" · ");
      } else {
        q("chgLine2").textContent = ad === null ? "" : ad + " kWh added during last charging session";
      }
      if (!this._limDrag && this.shadowRoot.activeElement !== q("cLim")) q("cLim").value = lim || 80;
      q("cLimVal").textContent = (lim ? Math.round(lim) : 80) + "%";
      const am = this._num("charging_amps");
      q("cAmp").textContent = am === null ? "-" : Math.round(am) + " A";
      const cbl = q("cableP");
      if (cbl) {
        cbl.style.display = plugged ? "" : "none";
        cbl.setAttribute("stroke", charging ? "#4fd07a" : "#4a9eff");
        cbl.setAttribute("stroke-dasharray", charging ? "10 8" : "");
      }
      const ap = q("aPort");
      if (ap) ap.classList.toggle("on", this._is("charge_port", "open") || plugged);

      // location row
      const locS = this._st("location");
      q("locSub").textContent = locS
        ? (locS.state === "home" ? "Home" : locS.state === "not_home" ? "Away" : locS.state)
        : "-";

      // footer
      const odo = this._num("odometer");
      q("odo").textContent = odo === null ? "" :
        (this._car.model ? this._car.model + " · " : "") + Math.round(odo).toLocaleString() + " " + this._unit("odometer", "km");
      const lu = this._st("last_update");
      const rel = lu ? relDur(lu.state) : "";
      q("upd").textContent = rel ? (rel === "just now" ? "Updated just now" : "Updated " + rel + " ago") : "";
    }
  }

  class TeslaFleetCardEditor extends HTMLElement {
    setConfig(config) {
      const prev = this._config && this._config.cars;
      this._config = JSON.parse(JSON.stringify(config || {}));
      if (!Array.isArray(this._config.cars) || !this._config.cars.length) {
        this._config.cars = [{ name: "My Tesla", model: PACK_DEFAULT.model,
                               paint: PACK_DEFAULT.paint, prefix: "" }];
      }
      /* issue #1, the half that was missed in v1.1.0. Home Assistant feeds the
         config straight back into setConfig after every change the editor
         emits, and _render() replaces the whole shadow root - so that echo
         destroyed the very input being typed into and dropped focus, which
         reads as the editor jumping back to the first car. The DOM already
         matches a config we produced ourselves, so re-render only when the
         cars genuinely differ (first load, or an edit made in YAML). */
      if (this._rendered && stableStr(prev) === stableStr(this._config.cars)) return;
      this._rendered = true;
      this._render();
    }
    set hass(hass) { this._hass = hass; }
    _render() {
      if (!this.shadowRoot) this.attachShadow({ mode: "open" });
      let html = `
        <style>
          .car { border:1px solid var(--divider-color,#444); border-radius:8px; padding:8px 10px; margin:8px 0; }
          label { display:flex; justify-content:space-between; align-items:center; margin:5px 0; font-size:13px; gap:10px; }
          input, select { flex:1; max-width:60%; padding:4px 6px; }
          .rm { float:right; background:none; border:none; color:#c66; cursor:pointer; font-size:12px; }
          .add { margin-top:6px; cursor:pointer; }
          .hint { font-size:11.5px; color:var(--secondary-text-color,#999); margin-top:4px; }
        </style><div>`;
      this._config.cars.forEach((c, i) => {
        html += `<div class="car" data-i="${i}">
          <button class="rm" data-rm="${i}" ${this._config.cars.length < 2 ? "disabled" : ""}>remove</button>
          <label>Name <input data-i="${i}" data-k="name" value="${c.name || ""}"></label>
          <label>Model <select data-i="${i}" data-k="model">
            ${["", "Model 3", "Model Y"].map((m) => `<option value="${m}" ${((c.model || "") === m) ? "selected" : ""}>${m || "-"}</option>`).join("")}
          </select></label>
          <label>Paint <select data-i="${i}" data-k="paint">
            ${["", "red", "grey", "silver", "white", "black", "blue"].map((p) => `<option value="${p}" ${((c.paint || "") === p) ? "selected" : ""}>${p || "-"}</option>`).join("")}
          </select></label>
          <label>Entity prefix <input data-i="${i}" data-k="prefix" value="${c.prefix || ""}" placeholder="e.g. buddy_"></label>
          <div class="hint">Paint picks the image pack (e.g. Model&nbsp;3 + grey &rarr; models/3/grey). The integration is auto-detected from the prefix, and a missing trailing underscore is corrected for you. Advanced options - custom images, tap anchors, integration override, entity overrides - live in YAML (Show code editor); see the README.</div>
        </div>`;
      });
      html += `<button class="add" id="add">+ Add car</button></div>`;
      this.shadowRoot.innerHTML = html;
      this.shadowRoot.querySelectorAll("input, select").forEach((inp) =>
        inp.addEventListener("change", () => {
          const i = parseInt(inp.dataset.i, 10);
          const car = this._config.cars[i];
          car[inp.dataset.k] = inp.value;
          /* issue #1: picking a paint did nothing, because a stored `color`
             (the old "+ Add car" always wrote blue) shadowed it at render time.
             The picker now CLEARS color rather than writing a hex, so the UI
             never produces one and `paint` stays the single source of truth.
             `color` survives only as a hand-written YAML override. */
          /* `color` is no longer read by the card; strip any left over from an
             older config so it does not sit there implying it still does. */
          if (inp.dataset.k === "paint") delete car.color;
          this._emit();
        })
      );
      this.shadowRoot.querySelectorAll("[data-rm]").forEach((b) =>
        b.addEventListener("click", () => {
          this._config.cars.splice(parseInt(b.dataset.rm, 10), 1);
          this._render();
          this._emit();
        })
      );
      this.shadowRoot.getElementById("add").addEventListener("click", () => {
        /* no color here on purpose: a hard-coded one shadows the paint picker */
        /* default to a combination that actually has artwork, so a freshly
           added car looks right before anything else is filled in */
        this._config.cars.push({ name: "New car", model: PACK_DEFAULT.model,
                                 paint: PACK_DEFAULT.paint, prefix: "" });
        this._render();
        this._emit();
      });
    }
    _emit() {
      const cfg = Object.assign({ type: "custom:tesla-fleet-card" }, this._config);
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: cfg }, bubbles: true, composed: true }));
    }
  }

  customElements.define("tesla-fleet-card", TeslaFleetCard);
  customElements.define("tesla-fleet-card-editor", TeslaFleetCardEditor);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "tesla-fleet-card",
    name: "Tesla Fleet Card",
    description: "Tesla-app-style card for tesla_custom & tesla_fleet - multi-car, one-click switching",
    preview: true,
  });
  console.info(
    "%c TESLA-FLEET-CARD %c v" + CARD_VERSION + " ",
    "background:#e82127;color:#fff;font-weight:700;border-radius:4px 0 0 4px;padding:2px 0",
    "background:#333;color:#fff;border-radius:0 4px 4px 0;padding:2px 0"
  );
})();
