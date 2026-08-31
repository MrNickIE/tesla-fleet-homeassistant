/* Tesla Fleet Card
   A Tesla-app-style, multi-car Lovelace card for Home Assistant.
   Works with both the tesla_custom (HACS) and official tesla_fleet
   integrations — auto-detected per car.
   Install guide, all options, and the image-pack spec live in the README:
   https://github.com/MrNickIE/tesla-fleet-homeassistant
   Built by Claude in conversation with MrNickIE — MIT licence, share freely. */
(function () {
  "use strict";

  const CARD_VERSION = "1.0.2-dev";

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
    charger_voltage: "sensor.{p}charger_voltage",
    seat_fl: "select.{p}heated_seat_left",
    seat_fr: "select.{p}heated_seat_right",
    seat_rl: "select.{p}heated_seat_rear_left",
    seat_rc: "select.{p}heated_seat_rear_center",
    seat_rr: "select.{p}heated_seat_rear_right",
    steering_heat: "switch.{p}heated_steering",
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

  /* Official tesla_fleet integration — same keys, its own entity naming.
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
  const CAR_DEFAULTS = { name: "Tesla", model: "", color: "#f2f3f5", hood_tint: "", integration: "auto", image: "", image_side: "", image_charging: "", image_side_plugged: "", image_top_plugged: "", image_top_charging: "", cable: "overlay", cable_path: "", image_climate: "", images: "", port_xy: "159,47", port_top_xy: "40,692", climate_anchors: {}, top_anchors: {}, defrost_glass: {}, calibrate: false, hide_seats: [], paint: "", prefix: "", entities: {} };

  const PAINT_COLORS = { red: "#a4232e", grey: "#5c5e62", gray: "#5c5e62", white: "#f2f3f5",
    black: "#171a20", blue: "#1f3a93", silver: "#c8c9cb" };

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
    </g>`;
  }

  /* -- Defrost glow ----------------------------------------------------------
     Measured off Nick's own app screen recording (ffmpeg, 15fps sampling of a
     4s window), rather than guessed:
       * the REAR screen is a flat vertical gradient — deep at the roofline,
         brightest at the outer edge (redness ramps ~4.4x top to bottom) — and
         is COMPLETELY STATIC: 0.06 variation over 7 seconds.
       * the WINDSCREEN band breathes on a 4.0s cycle at about +/-12%. Only
         that band moves; a control patch of cabin measured 0.09 over the same
         window, so it is the glow, not the view shifting.
       * the vent mist cones are NOT drawn while defrost runs.
       * climate off means defrost off — the app drops both together.
     The climate-view geometry is NOT hand-traced. The recording contains the
     same view with defrost on and off, and the car render is identical between
     them (body patches differ by ~1/255), so differencing the two frames yields
     the glow itself. Connected components separate the two glows (69k and 74k
     px) from the UI text that also changed (~250px each, rejected). That mask
     was warped into pack-image space by matching car bounding boxes, giving the
     outlines and per-row alpha below. Two things it settled: the glows are
     broad soft washes over each END OF THE CABIN, not tight glass polygons, and
     the wing mirrors do NOT tint. Colours are NOT from the recording — that
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
     the shut line and fading upward — exactly the measured rear profile. */

  /* Peaks and colour. clim_* are the video-measured view and are left alone.
     The pane_* set is used on the views with no reference; its colour is more
     saturated because a composite match against the reference screenshot showed
     the old one going muddy: brightest pixels measured RGB 155/67/52 against the
     app's 108/39/31 — brighter in red but far greyer, which reads as dark. */
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
    /* drawn fallback art: one glass path, warm both ends, clear across the roof */
    return { colour: DF_COLOR.rear,
      stops: dfScale(W, P.ws, 0, .42).concat([[.46, .012], [.54, .012]]).concat(dfScale(R, P.rear, .58, 1)) };
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
  function dfGlow(sfx, car, override) {
    const regions = dfRegions(sfx, car, override);
    if (!regions.length) return "";
    const body = regions.map((r) => {
      const d = r.raw || DF_PATHS[r.d];
      if (!d) return "";
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

  function hexRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(hex, f) {
    const rgb = hexRgb(hex);
    if (!rgb) return hex;
    const ch = (x) => Math.max(0, Math.min(255, Math.round(x * f)));
    return "#" + ((ch(rgb[0]) << 16) | (ch(rgb[1]) << 8) | ch(rgb[2])).toString(16).padStart(6, "0");
  }
  function lum(hex) {
    const rgb = hexRgb(hex);
    return rgb ? (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255 : 0.5;
  }

  ICONS.plug = "M16 7V3h-2v4h-4V3H8v4c-1.1 0-2 .9-2 2v5.5L9.5 18v3h5v-3l3.5-3.5V9c0-1.1-.9-2-2-2z";

  class TeslaFleetCard extends HTMLElement {
    static getConfigElement() {
      return document.createElement("tesla-fleet-card-editor");
    }
    static getStubConfig() {
      return { cars: [{ name: "My Tesla", model: "Model Y", color: "#f2f3f5", prefix: "" }] };
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
        car._cableSet = c.cable !== undefined;
        if (!c.color && car.paint && PAINT_COLORS[String(car.paint).toLowerCase()])
          car.color = PAINT_COLORS[String(car.paint).toLowerCase()];
        const forced = normIntegration(car.integration);
        car._integration = forced || "";           // "" = auto-detect at first hass
        car._entities = resolveEntities(car, forced || "tesla_custom");
        car._detected = !!forced;
        return car;
      });
      this._sel = Math.min(this._config.default_car || 0, this._cars.length - 1);
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
    }

    get _car() { return this._cars[this._sel]; }

    set hass(hass) {
      this._hass = hass;
      if (!this._config) return;
      this._cars.forEach((car) => {
        if (car._detected) return;
        const p = car.prefix || "";
        let integ = "";
        if (hass.states["sensor." + p + "battery"]) integ = "tesla_custom";
        else if (hass.states["sensor." + p + "battery_level"]) integ = "tesla_fleet";
        if (integ) {
          car._integration = integ;
          car._entities = resolveEntities(car, integ);
          car._detected = true;
          if (car === this._car) this._built = false;   // rebuild with the right entities
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
    _defrostOn() {
      const ds = this._st("defrost_switch");
      if (ds) return ds.state === "on";
      const cs = this._st("climate");
      /* tesla_custom leaves preset_mode on "defrost" after the HVAC is switched
         off, which left the glass lit with the climate off. The app drops both
         together, so treat an off/unknown climate as defrost off. */
      if (!cs || cs.state === "off" || cs.state === "unavailable" || cs.state === "unknown") return false;
      return cs.attributes.preset_mode === "defrost";
    }

    _steeringOn() {
      const s = this._st("steering_heat");
      if (!s) return false;
      const v = String(s.state).toLowerCase();
      return v !== "off" && v !== "unavailable" && v !== "unknown";
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
      // Then the repo itself over GitHub raw — always current, updates on a
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
      this._hass.callService(domain, service, data);
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
  .defrostBtn:active { background:#2c2c2c; }
  .battGlyph { width:24px; height:11px; border:1.5px solid #6f6f6f; border-radius:3px; position:relative; }
  .battGlyph:after { content:""; position:absolute; right:-4px; top:2.5px; width:2.5px; height:4px;
    background:#6f6f6f; border-radius:0 1px 1px 0; }
  .battFill { position:absolute; left:1px; top:1px; bottom:1px; background:#8f9296; border-radius:1px; }
  .battFill.chg { background:#4fd07a; } .battFill.low { background:#e0a63c; } .battFill.crit { background:#d53a3a; }
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
  /* mist animation is SMIL (in the SVG markup) — CSS transforms on filtered
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
        <span id="battTxt">—</span><span id="battBolt" style="display:none">${svgIcon(ICONS.bolt)}</span><span id="battDefrost" style="display:none" title="Defrost on"><svg viewBox="0 0 24 24"><path d="M6 21 q4 -4.5 0 -9 q-4 -4.5 0 -9 M12 21 q4 -4.5 0 -9 q-4 -4.5 0 -9 M18 21 q4 -4.5 0 -9 q-4 -4.5 0 -9" fill="none" stroke="#ff8c42" stroke-width="2.4" stroke-linecap="round"/></svg></span></div>
      <div class="sub" id="sub">—</div>
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
        <span><span class="rTitle">Climate</span><div class="rSub" id="climSub">—</div></span>
        ${svgIcon(ICONS.chevR, "chev")}</button>

    </div>
    <div class="row" id="rowChg">
      <button class="rowHead" id="headChg">${svgIcon(ICONS.bolt, "ric")}
        <span><span class="rTitle">Charging</span><div class="rSub" id="chgSub">—</div></span>
        ${svgIcon(ICONS.chevR, "chev")}</button>
      <div class="rowBody">
        <div class="chgLine1">Charge limit: <b id="cLimVal">—</b><span id="chgState"></span></div>
        <div class="chgLine2" id="chgLine2"></div>
        <div class="sliderWrap"><div class="limTick"></div>
          <input type="range" min="0" max="100" step="1" id="cLim" class="chgSlider"></div>
        <div class="ampRow"><button id="ampDn">‹</button><span id="cAmp">—</span><button id="ampUp">›</button></div>
        <div class="chgBtns" id="chgBtns">
          <button id="btnStopChg">Stop Charging</button>
          <button id="btnUnlockPort">Unlock Charge Port</button>
        </div>
      </div>
    </div>
    <div class="row" id="rowLoc">
      <button class="rowHead" id="headLoc">${svgIcon(ICONS.pin, "ric")}
        <span><span class="rTitle">Location</span><div class="rSub" id="locSub">—</div></span>
        ${svgIcon(ICONS.chevR, "chev")}</button>
    </div>
  </div>

  <div class="ftr">
    <span id="odo">—</span>
    <span id="upd">—</span>
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
      // no rear-centre seat heater in any Tesla — seatRC removed globally (Nick, 2026-08-31)
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
        // tesla_custom: Off/Auto/High/Medium/Low — tesla_fleet: off/low/medium/high
        // — ventilated-seat cars: Off/Heat Low/Heat Medium/Heat High/Auto/Cool….
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
        const s = this._st("steering_heat");
        if (!s) return;
        if (s.entity_id.startsWith("switch.")) {          // tesla_custom
          this._call("switch", s.state === "on" ? "turn_off" : "turn_on", { entity_id: s.entity_id });
        } else {                                          // tesla_fleet: a select (off/low/high)
          const avail = Array.isArray(s.attributes.options) && s.attributes.options.length
            ? s.attributes.options : ["off", "high"];
          const off = avail.find((o) => o.toLowerCase() === "off") || avail[0];
          const hot = avail.find((o) => o.toLowerCase() === "high") ||
                      avail.find((o) => o.toLowerCase() !== "off") || avail[avail.length - 1];
          const next = this._steeringOn() ? off : hot;
          this._call("select", "select_option", { entity_id: s.entity_id, option: next });
        }
      });
      const dfBtn = q("btnDefrost");
      if (dfBtn) dfBtn.addEventListener("click", () => {
        const ds = this._st("defrost_switch");
        if (ds) {                                         // tesla_fleet: a real defrost switch
          this._call("switch", ds.state === "on" ? "turn_off" : "turn_on", { entity_id: ds.entity_id });
          return;
        }
        const cs = this._st("climate");                   // tesla_custom: climate preset
        if (!cs) return;
        const on = cs.attributes.preset_mode === "defrost";
        this._call("climate", "set_preset_mode", { entity_id: cs.entity_id, preset_mode: on ? "normal" : "defrost" });
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
          '<button data-i="' + i + '"><span class="dot" style="background:' + c.color + '"></span>' +
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
    _toggleClimate() {
      const s = this._st("climate");
      if (!s) return;
      // tesla_custom's climate entity doesn't support climate.turn_on/turn_off —
      // set_hvac_mode works everywhere.
      const modes = s.attributes.hvac_modes || [];
      const turningOn = this._climOn() === false;
      if (turningOn) {
        const on = modes.find((m) => m === "heat_cool") || modes.find((m) => m && m !== "off") || "heat_cool";
        this._call("climate", "set_hvac_mode", { entity_id: s.entity_id, hvac_mode: on });
      } else {
        this._call("climate", "set_hvac_mode", { entity_id: s.entity_id, hvac_mode: "off" });
      }
      // optimistic: Tesla's state echo is slow — show the intent immediately
      this._pendClim = { on: turningOn, ts: Date.now() };
      this._update();
    }
    _climOn() {
      if (this._pendClim && Date.now() - this._pendClim.ts < 20000) return this._pendClim.on;
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
      // resting view only with a real photo — imageless cars open on the
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
      // Baked pack photos already show the cable (green while charging) —
      // no overlay at all. The drawn overlay exists only for users whose own
      // photos have no cable in them.
      if (baked) {
        return `
<div class="imgWrap rest" id="restWrap" title="Open controls">
  <img id="restImg" class="carImg" src="${src}" alt="">
  <svg class="car ovl" viewBox="0 0 233 108" preserveAspectRatio="none" style="pointer-events:none">
    <defs>${dfDefs(rSfx, this._car)}</defs>
    ${dfGlow(rSfx, this._car)}
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
    ${dfGlow(rSfx, this._car)}
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
    ${dfGlow("Top", this._car)}
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
      <text id="tpFL" x="34" y="${tpmsFrontY}" text-anchor="middle">—</text>
      <text id="tpFR" x="326" y="${tpmsFrontY}" text-anchor="middle">—</text>
      <text id="tpRL" x="34" y="${tpmsRearY}" text-anchor="middle">—</text>
      <text id="tpRR" x="326" y="${tpmsRearY}" text-anchor="middle">—</text>
    </g>
  </svg>
</div>`;
    }

    /* Drawn cabin used when no interior photo exists — feature positions sit at
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
    ${dfGlow("Clim", car)}
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
    </g>
    <g id="heatToast" style="display:none">
      <rect id="heatToastBg" x="0" y="0" rx="6" height="24" width="90" fill="#000000d0"/>
      <text id="heatToastTxt" x="0" y="0" font-size="13.5" font-weight="600" fill="#f2f3f4"></text>
    </g>
  </svg>
</div>
<div class="climPage">
  <div class="climTemps" id="climTemps">—</div>
  <div class="climCtl">
    <button class="pwr" id="climPwr">${svgIcon(ICONS.power)}<span id="climPwrLb">Off</span></button>
    <button class="arrow" id="tDn">‹</button>
    <span class="big" id="tTgt">—</span>
    <button class="arrow" id="tUp">›</button>
    <button class="pwr" id="climVent">${svgIcon(ICONS.vent)}<span>Vent</span></button>
  </div>
  <button class="defrostBtn" id="btnDefrost">Defrost Car</button>
  ${this._climExtraHtml()}
</div>`;
    }

    /* Bioweapon / Camp / Pet / Cabin Overheat Protection — rendered only when
       the integration exposes the matching capability. */
    _climExtraHtml() {
      const cs = this._st("climate");
      const fans = (cs && cs.attributes.fan_modes) || [];
      const presets = (cs && cs.attributes.preset_modes) || [];
      const has = (arr, v) => arr.some((o) => String(o).toLowerCase() === v);
      let html = "";
      if (has(fans, "bioweapon"))
        html += `<button class="defrostBtn climX" id="btnBio">Bioweapon Defense Mode</button>`;
      if (has(presets, "camp"))
        html += `<button class="defrostBtn climX" id="btnCamp">Camp Mode</button>`;
      if (has(presets, "dog"))
        html += `<button class="defrostBtn climX" id="btnPet">Pet Mode</button>`;
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

    /* Built-in fallback artwork — outlines traced 1:1 from reference photos of the
       real cars (Model 3 art currently shares the Model Y trace); the surface
       rendering is original. Tap/overlay anchors match the previous geometry. */
    _carArt() {
      const A = TeslaFleetCard._ART[/3/.test(String(this._car.model || "")) ? "3" : "y"];
      /* the drawn art's glass is one runtime path, so its region is built here */
      const dfArt = [{ k: "art", g: "art", raw: A.glass }];
      const c = this._car.color || "#f2f3f5";
      const light = lum(c) > 0.55;
      const hi = shade(c, light ? 1.03 : 1.3);
      const mid = c;
      const lo = shade(c, light ? 0.78 : 0.55);
      const edge = shade(c, light ? 0.55 : 0.34);
      const onBody = light ? "#3c3f42" : "#e8e9ea";
      const tint = this._car.hood_tint;
      const dashY = 236.4;
      return `
<svg class="car" viewBox="0 0 360 640">
  <defs>
    <linearGradient id="bodyH" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${lo}"/><stop offset=".2" stop-color="${mid}"/>
      <stop offset=".45" stop-color="${hi}"/><stop offset=".55" stop-color="${hi}"/>
      <stop offset=".8" stop-color="${mid}"/><stop offset="1" stop-color="${lo}"/>
    </linearGradient>
    <linearGradient id="bodyV" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="${light ? .4 : .26}"/>
      <stop offset=".13" stop-color="#fff" stop-opacity="0"/>
      <stop offset=".85" stop-color="#000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000" stop-opacity=".3"/>
    </linearGradient>
    <linearGradient id="glassG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#23272d"/><stop offset=".12" stop-color="#101215"/>
      <stop offset=".85" stop-color="#0d0f12"/><stop offset="1" stop-color="#080a0c"/>
    </linearGradient>
    <linearGradient id="tintG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${tint || "transparent"}" stop-opacity=".8"/>
      <stop offset="1" stop-color="${tint || "transparent"}" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="noseL" cx=".5" cy=".3" r=".72">
      <stop offset="0" stop-color="#fff" stop-opacity="${light ? .3 : .2}"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <filter id="softB" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
    <clipPath id="bodyC"><path d="${A.body}"/></clipPath>
    <clipPath id="glassC"><path d="${A.glass}"/></clipPath>
    ${dfDefs("Art", this._car, dfArt)}
  </defs>

  <ellipse cx="180" cy="334" rx="126" ry="288" fill="#000" opacity=".5" filter="url(#softB)"/>
  <path d="${A.body}" fill="url(#bodyH)"/>
  <path d="${A.body}" fill="url(#bodyV)"/>

  <g clip-path="url(#bodyC)">
    <ellipse cx="180" cy="116" rx="88" ry="58" fill="url(#noseL)"/>
    ${tint ? '<rect x="60" y="56" width="240" height="140" fill="url(#tintG)"/>' : ""}
    <path d="M132 84 C 128 108 130 140 142 172 M228 84 C 232 108 230 140 218 172"
          fill="none" stroke="rgba(8,9,11,.4)" stroke-width="1.6"/>
    <path d="M143 66 C 156 62 204 62 217 66" fill="none" stroke="rgba(8,9,11,.3)" stroke-width="1.2"/>
    <path d="M70 160 C 70 116 84 84 114 66 L 104 60 C 76 78 62 112 64 160 Z" fill="#000" opacity=".16"/>
    <path d="M290 160 C 290 116 276 84 246 66 L 256 60 C 284 78 298 112 296 160 Z" fill="#000" opacity=".16"/>
    <path d="M92 612 C 140 622 220 622 268 612 L 268 640 L 92 640 Z" fill="#000" opacity=".22"/>
    <path d="M92 556 L 104 552 L 105 566 L 93 570 Z" fill="none" stroke="rgba(8,9,11,.5)" stroke-width="1.1"/>
  </g>

  <path d="${A.lights[0]}" fill="#e9eff6"/>
  <path d="${A.lights[1]}" fill="#e9eff6"/>

  <path d="${A.glass}" fill="url(#glassG)"/>
  <g clip-path="url(#glassC)">
    <path d="M96 ${dashY} C 140 ${dashY - 12} 220 ${dashY - 12} 264 ${dashY}
             L 264 ${dashY + 7} C 220 ${dashY - 5} 140 ${dashY - 5} 96 ${dashY + 7} Z"
          fill="#3a3e45" opacity=".6"/>
    <ellipse cx="143" cy="${dashY + 14}" rx="19" ry="6" fill="none" stroke="#26292e" stroke-width="3" opacity=".8"/>
    <g fill="#1b1e22" opacity=".65">
      <path d="M126 ${dashY + 46} h 38 a13 13 0 0 1 13 13 v 34 a13 13 0 0 1 -13 13 h -38 a13 13 0 0 1 -13 -13 v -34 a13 13 0 0 1 13 -13 Z"/>
      <path d="M196 ${dashY + 46} h 38 a13 13 0 0 1 13 13 v 34 a13 13 0 0 1 -13 13 h -38 a13 13 0 0 1 -13 -13 v -34 a13 13 0 0 1 13 -13 Z"/>
      <rect x="115" y="${dashY + 148}" width="130" height="52" rx="15"/>
    </g>
    <g fill="#262a30" opacity=".6">
      <rect x="130" y="${dashY + 50}" width="30" height="11" rx="5.5"/>
      <rect x="200" y="${dashY + 50}" width="30" height="11" rx="5.5"/>
      <rect x="124" y="${dashY + 152}" width="26" height="9" rx="4.5"/>
      <rect x="167" y="${dashY + 152}" width="26" height="9" rx="4.5"/>
      <rect x="210" y="${dashY + 152}" width="26" height="9" rx="4.5"/>
    </g>
    <rect x="171" y="${dashY + 52}" width="18" height="66" rx="9" fill="#121417" opacity=".7"/>
    <path d="M124 ${dashY - 28} L 166 ${dashY - 54} M178 ${dashY - 26} L 222 ${dashY - 52}"
          stroke="#0a0b0d" stroke-width="3" stroke-linecap="round" opacity=".7"/>
    <path d="${A.glass}" fill="none" stroke="#3c434c" stroke-width="2.5" opacity=".35"/>
  </g>
  <path d="${A.glass}" fill="none" stroke="#07080a" stroke-width="1.6" opacity=".9"/>
  ${dfGlow("Art", this._car, dfArt)}

  <g>
    <path d="M74 246 L 52 238 C 44 235 40 240 43 247 C 46 256 55 262 65 261 L 78 258 Z" fill="${mid}" stroke="${edge}" stroke-width="1"/>
    <path d="M286 246 L 308 238 C 316 235 320 240 317 247 C 314 256 305 262 295 261 L 282 258 Z" fill="${mid}" stroke="${edge}" stroke-width="1"/>
    <path d="M48 242 C 52 240 59 241 63 244 C 64 250 61 255 56 256 C 50 256 46 252 45 247 C 45 244 46 243 48 242 Z" fill="#17191d"/>
    <path d="M312 242 C 308 240 301 241 297 244 C 296 250 299 255 304 256 C 310 256 314 252 315 247 C 315 244 314 243 312 242 Z" fill="#17191d"/>
  </g>
  <path d="${A.body}" fill="none" stroke="${edge}" stroke-width="1.5"/>

  <!-- frunk tap -->
  <g id="frunkTap" class="tapa">
    <rect x="118" y="80" width="124" height="98" rx="14" fill="#000" opacity="0"/>
    <text id="frunkLbl" class="olbl" x="180" y="140" text-anchor="middle"
          font-size="18" font-weight="600" fill="${onBody}">Open</text>
  </g>
  <!-- trunk tap (on rear glass) -->
  <g id="trunkTap" class="tapa">
    <rect x="118" y="470" width="124" height="76" rx="14" fill="#000" opacity="0"/>
    <text id="trunkLbl" class="olbl" x="180" y="518" text-anchor="middle"
          font-size="18" font-weight="600" fill="#cfd2d5">Open</text>
  </g>
  <!-- lock, centre of the roof -->
  <g id="lockTap" class="tapa">
    <circle cx="180" cy="404" r="28" fill="#000" opacity="0"/>
    <g id="lockIcon" transform="translate(167,391) scale(1.1)"></g>
  </g>
  <!-- charge port, rear left by the taillight -->
  <g id="boltG">
    <path id="cableP" d="M 0 549 C 22 549 26 573 48 574 C 66 575 82 570 92 566"
          stroke="#4a9eff" stroke-width="4.5" fill="none" stroke-linecap="round" style="display:none">
      <animate attributeName="stroke-dashoffset" from="36" to="0" dur="1.2s" repeatCount="indefinite"/>
    </path>
    <rect id="portNub" x="90" y="560" width="10" height="11" rx="2.5" fill="#1a1c20" style="display:none"/>
    <path id="portFlap" d="M 104 553 L 96 566 L 108 563 Z" fill="#c62f36" style="display:none"/>
    <path id="boltP" d="M52 518 L 42 535 h 7 l -3.5 14 l 12 -19 h -7 l 5 -12 z" fill="#6f6f6f" style="display:none"/>
  </g>
  <!-- sentry -->
  <g id="sentryEye" style="display:none">
    <circle cx="180" cy="28" r="8" fill="#141414" stroke="#d53a3a" stroke-width="2"/>
    <circle cx="180" cy="28" r="3" fill="#d53a3a">
      <animate attributeName="opacity" values="1;.2;1" dur="1.6s" repeatCount="indefinite"/>
    </circle>
  </g>
  <!-- TPMS corners -->
  <g id="tpmsG" font-size="15" font-weight="600" fill="#ececec" ${this._config.show_tpms ? "" : 'style="display:none"'}>
    <text id="tpFL" x="30" y="104" text-anchor="middle">—</text>
    <text id="tpFR" x="330" y="104" text-anchor="middle">—</text>
    <text id="tpRL" x="30" y="602" text-anchor="middle">—</text>
    <text id="tpRR" x="330" y="602" text-anchor="middle">—</text>
  </g>
</svg>`;
    }

    _setLockIcon(locked) {
      const g = this.shadowRoot.getElementById("lockIcon");
      if (!g) return;
      g.innerHTML = '<path d="' + (locked ? ICONS.lock : ICONS.unlock) + '" fill="#dfe0e2" opacity=".95"/>';
    }

    _update() {
      const q = (id) => this.shadowRoot.getElementById(id);

      // battery line
      const pct = this._num("battery");
      const rng = this._num("range");
      const charging = this._charging();
      const bf = q("battFill");
      bf.style.width = Math.max(0, Math.min(100, pct || 0)) * 0.21 + "px";
      bf.className = "battFill" + (charging ? " chg" : pct !== null && pct <= 10 ? " crit" : pct !== null && pct <= 20 ? " low" : "");
      q("battTxt").textContent =
        (pct === null ? "—" : Math.round(pct) + "%") +
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

      // tpms — tesla_custom reports psi, tesla_fleet reports bar
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
      if (this._pendClim && Date.now() - this._pendClim.ts >= 20000) this._pendClim = null;
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
      if (tT) tT.textContent = climS && climS.attributes.temperature ? climS.attributes.temperature + "°" : "—";
      const ctTemps = q("climTemps");
      if (ctTemps) ctTemps.textContent =
        (inT === null ? "" : "Interior " + Math.round(inT) + "°C") +
        (outT === null ? "" : (inT === null ? "" : "  ·  ") + "Exterior " + Math.round(outT) + "°C") || "—";
      const cVent = q("climVent");
      if (cVent) cVent.classList.toggle("on", this._is("windows_cover", "open"));
      const LVL = { off: 0, low: 1, medium: 2, high: 3, auto: 3 };
      const hideSeats = (this._car.hide_seats || []).map((x) => String(x).toLowerCase());
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
        const lvl = LVL[String(st).toLowerCase().replace(/^(heat|cool) /, "")] || 0;
        g.classList.toggle("heatOn", lvl > 0);
        for (let i = 0; i < 3; i++) {
          const w = q(id + "_w" + i);
          if (w) w.setAttribute("stroke", i < lvl ? "#e64545" : "#a9adb2");
        }
      });
      if (q("wheelHeat")) {
        q("wheelHeat").style.display = this._st("steering_heat") ? "" : "none";
        const whOn = this._steeringOn();
        q("wheelHeat").classList.toggle("wheelOn", whOn);
        const wIc = q("wheelHeatIcon");
        if (wIc) wIc.querySelector("path").setAttribute("fill", whOn ? "#e64545" : "#a9adb2");
      }
      const dfOn = this._defrostOn();
      const dfB = q("btnDefrost");
      if (dfB) dfB.classList.toggle("on", dfOn);
      const dfBadge = q("battDefrost");
      if (dfBadge) dfBadge.style.display = dfOn ? "" : "none";
      ["dfClim", "dfTop", "dfRest", "dfRestPlugged", "dfRestCharging", "dfArt"].forEach((gid) => {
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
      q("cAmp").textContent = am === null ? "—" : Math.round(am) + " A";
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
        : "—";

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
      this._config = JSON.parse(JSON.stringify(config || {}));
      if (!Array.isArray(this._config.cars) || !this._config.cars.length) {
        this._config.cars = [{ name: "My Tesla", model: "", color: "#f2f3f5", prefix: "" }];
      }
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
            ${["", "Model 3", "Model Y"].map((m) => `<option value="${m}" ${((c.model || "") === m) ? "selected" : ""}>${m || "—"}</option>`).join("")}
          </select></label>
          <label>Paint <select data-i="${i}" data-k="paint">
            ${["", "red", "grey", "white", "black", "blue"].map((p) => `<option value="${p}" ${((c.paint || "") === p) ? "selected" : ""}>${p || "—"}</option>`).join("")}
          </select></label>
          <label>Entity prefix <input data-i="${i}" data-k="prefix" value="${c.prefix || ""}" placeholder="e.g. buddy_"></label>
          <div class="hint">The integration is auto-detected from the prefix. Advanced options — custom images, tap anchors, integration override, entity overrides — live in YAML (Show code editor); see the README.</div>
        </div>`;
      });
      html += `<button class="add" id="add">+ Add car</button></div>`;
      this.shadowRoot.innerHTML = html;
      this.shadowRoot.querySelectorAll("input, select").forEach((inp) =>
        inp.addEventListener("change", () => {
          const i = parseInt(inp.dataset.i, 10);
          this._config.cars[i][inp.dataset.k] = inp.value;
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
        this._config.cars.push({ name: "New car", model: "", color: "#3b6fd1", prefix: "" });
        this._render();
        this._emit();
      });
    }
    _emit() {
      const cfg = Object.assign({ type: "custom:tesla-fleet-card" }, this._config);
      this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: cfg }, bubbles: true, composed: true }));
    }
  }

  TeslaFleetCard._ART = (function(){
    const Y = { body: "M 172.8 58.0 C 163.5 58.1 156.3 58.9 148.9 60.3 C 141.5 61.6 137.7 62.1 128.6 66.1 C 119.5 70.1 101.7 79.9 94.3 84.2 C 86.9 88.5 87.2 89.1 84.4 91.8 C 81.6 94.5 79.5 96.6 77.6 100.4 C 75.6 104.2 74.0 108.3 72.7 114.8 C 71.4 121.3 70.3 125.2 70.0 139.6 C 69.7 154.0 70.3 188.8 70.9 201.0 C 71.5 213.2 73.1 207.8 73.6 212.7 C 74.0 217.6 75.6 226.3 73.6 230.7 C 71.6 235.1 64.4 236.9 61.4 239.3 C 58.4 241.7 56.7 242.7 55.5 245.2 C 54.3 247.7 54.0 252.6 54.2 254.2 C 54.4 255.8 54.7 255.4 56.9 254.6 C 59.1 253.8 64.7 250.1 67.3 249.2 C 69.9 248.3 71.7 248.9 72.7 249.2 C 73.8 249.5 73.5 233.4 73.6 251.0 C 73.7 268.6 72.9 324.2 73.1 354.7 C 73.2 385.1 74.7 418.9 74.5 433.7 C 74.3 448.5 73.0 437.5 72.2 443.6 C 71.5 449.7 70.4 460.1 70.0 470.2 C 69.6 480.3 69.5 494.0 70.0 504.5 C 70.5 515.0 70.8 523.6 73.1 533.3 C 75.3 543.0 81.4 557.6 83.5 562.6 C 85.6 567.6 85.2 562.7 85.7 563.1 C 86.2 563.5 85.6 564.5 86.2 564.9 C 86.8 565.3 88.7 563.5 89.4 565.4 C 90.2 567.3 87.6 573.0 90.7 576.2 C 93.8 579.4 103.9 582.0 108.3 584.7 C 112.7 587.4 113.5 589.9 116.9 592.4 C 120.4 594.9 125.1 597.6 129.0 599.6 C 132.9 601.6 135.2 602.6 140.3 604.1 C 145.4 605.6 151.1 607.6 159.3 608.6 C 167.5 609.6 181.3 610.2 189.5 610.0 C 197.7 609.8 202.3 608.6 208.4 607.3 C 214.5 605.9 220.4 604.3 226.0 601.9 C 231.6 599.5 238.0 595.8 242.2 592.9 C 246.4 590.0 249.3 585.7 251.3 584.3 C 253.3 582.9 251.5 585.6 254.4 584.3 C 257.3 582.9 266.2 579.2 268.8 576.2 C 271.4 573.2 268.5 568.6 269.7 566.3 C 270.9 564.0 273.5 567.5 276.1 562.6 C 278.7 557.7 283.3 544.2 285.5 536.9 C 287.7 529.5 288.3 525.1 289.1 518.5 C 289.9 511.9 290.4 507.0 290.5 497.3 C 290.6 487.6 290.4 470.8 289.6 460.3 C 288.9 449.8 286.4 468.9 286.0 434.1 C 285.6 399.3 285.9 282.0 286.9 251.5 C 287.9 221.0 289.2 250.3 291.8 251.0 C 294.4 251.7 300.4 254.8 302.7 255.5 C 305.0 256.2 305.3 256.9 305.8 255.5 C 306.3 254.2 306.0 249.3 305.8 247.4 C 305.6 245.5 307.7 246.7 304.5 243.8 C 301.3 240.9 289.4 234.8 286.4 229.8 C 283.4 224.8 285.9 218.9 286.4 214.0 C 286.8 209.1 288.4 208.6 289.1 200.5 C 289.8 192.4 290.5 171.2 290.5 165.3 C 290.5 159.4 289.2 169.6 289.1 164.9 C 289.0 160.2 290.2 145.6 290.0 137.4 C 289.8 129.2 289.1 122.4 287.8 115.7 C 286.5 109.0 283.7 100.4 282.4 97.2 C 281.1 94.0 280.6 97.5 280.1 96.8 C 279.6 96.1 279.7 93.8 279.2 93.2 C 278.7 92.6 281.5 96.2 277.0 93.2 C 272.5 90.2 260.6 79.9 252.2 75.1 C 243.8 70.3 234.8 66.9 226.9 64.3 C 219.0 61.7 213.8 60.4 204.8 59.4 C 195.8 58.4 182.1 57.9 172.8 58.0 Z",
      glass: "M 164.2 174.4 C 155.3 175.1 145.4 176.6 136.7 178.4 C 128.0 180.2 118.7 182.9 111.9 185.2 C 105.1 187.5 98.9 185.7 96.1 192.4 C 93.3 199.1 97.7 219.7 95.2 225.3 C 92.7 230.9 84.6 225.1 81.2 225.8 C 77.8 226.6 76.0 227.9 74.9 229.8 C 73.8 231.8 73.8 236.2 74.5 237.5 C 75.2 238.8 77.9 237.5 79.4 237.9 C 80.9 238.3 83.1 232.4 83.5 240.2 C 83.9 248.0 82.0 268.4 81.7 284.8 C 81.4 301.2 81.4 321.0 81.7 338.5 C 82.0 356.0 82.2 370.0 83.5 389.9 C 84.8 409.8 87.5 438.7 89.8 457.6 C 92.1 476.5 95.8 493.8 97.5 503.1 C 99.2 512.4 99.2 511.8 100.2 513.5 C 101.2 515.2 103.4 519.1 103.8 513.5 C 104.2 507.9 101.1 485.4 102.4 479.7 C 103.8 474.0 109.6 468.7 111.9 479.2 C 114.2 489.7 115.3 529.8 116.4 542.8 C 117.5 555.8 117.8 553.1 118.7 557.2 C 119.6 561.3 120.6 564.4 121.8 567.2 C 123.0 570.0 124.2 572.0 125.9 573.9 C 127.6 575.8 128.0 576.9 131.7 578.9 C 135.4 580.9 140.8 584.2 148.0 586.1 C 155.2 588.0 167.1 589.6 174.6 590.2 C 182.1 590.8 187.5 590.2 193.1 589.7 C 198.7 589.2 202.9 588.4 208.0 587.0 C 213.1 585.6 219.5 583.2 223.7 581.1 C 227.9 579.0 230.7 577.1 233.2 574.4 C 235.7 571.7 236.9 569.9 238.6 564.9 C 240.2 559.9 241.1 567.7 243.1 544.6 C 245.1 521.5 247.9 446.1 250.8 426.5 C 253.7 406.9 259.4 411.6 260.3 426.9 C 261.2 442.1 256.3 502.8 256.2 518.0 C 256.1 533.2 259.1 519.8 259.8 518.0 C 260.6 516.2 260.2 509.1 260.7 507.2 C 261.1 505.2 261.3 513.0 262.5 506.3 C 263.7 499.6 266.7 474.2 267.9 467.0 C 269.1 459.8 268.4 475.8 269.7 463.0 C 271.0 450.2 274.4 402.6 275.6 390.4 C 276.8 378.2 276.8 395.1 277.0 389.9 C 277.2 384.7 276.7 365.7 277.0 359.3 C 277.3 352.9 278.4 356.0 278.8 351.6 C 279.2 347.2 279.5 351.7 279.2 333.1 C 278.9 314.5 276.1 256.0 277.0 240.2 C 277.9 224.4 283.2 240.5 284.6 238.4 C 286.0 236.3 285.6 229.4 285.1 227.6 C 284.6 225.8 282.9 228.3 281.5 227.6 C 280.1 226.8 279.3 223.9 276.5 223.1 C 273.7 222.3 266.9 227.7 264.8 222.6 C 262.7 217.5 264.9 197.4 263.9 192.4 C 262.8 187.4 259.5 192.8 258.5 192.4 C 257.5 192.0 258.4 190.5 258.0 190.1 C 257.6 189.7 258.0 191.1 255.8 190.1 C 253.6 189.1 247.5 185.3 244.9 184.3 C 242.3 183.3 241.0 184.5 240.0 184.3 C 239.0 184.1 242.0 183.9 239.1 182.9 C 236.2 181.9 231.0 179.8 222.8 178.4 C 214.6 177.0 199.7 175.1 189.9 174.4 C 180.1 173.7 173.1 173.7 164.2 174.4 Z",
      lights: ["M 119.1 78.7 C 118.9 77.8 113.8 80.3 111.0 81.5 C 108.2 82.7 105.6 84.0 102.4 86.0 C 99.2 88.0 95.0 90.8 92.1 93.2 C 89.2 95.6 86.0 99.1 84.8 100.4 C 83.6 101.8 83.7 102.3 84.8 101.3 C 85.9 100.3 88.3 96.8 91.2 94.5 C 94.1 92.2 99.7 88.4 102.0 87.3 C 104.3 86.2 104.6 87.3 105.1 87.8 C 105.6 88.3 106.7 89.0 105.1 90.5 C 103.5 92.0 97.7 95.1 95.7 96.8 C 93.8 98.5 94.1 100.0 93.4 100.8 C 92.7 101.5 92.5 99.7 91.6 101.3 C 90.7 102.9 89.0 106.8 88.0 110.3 C 87.0 113.8 85.5 120.0 85.3 122.0 C 85.1 124.0 85.8 122.5 86.6 122.0 C 87.4 121.5 87.7 123.3 90.3 118.9 C 92.9 114.5 99.0 100.7 102.4 95.4 C 105.8 90.1 108.8 88.7 110.5 87.3 C 112.2 85.9 111.0 88.3 112.4 86.9 C 113.8 85.5 119.3 79.6 119.1 78.7 Z", "M 258.0 88.2 C 256.4 88.0 259.5 93.8 259.4 95.0 C 259.3 96.2 255.9 91.5 257.6 95.4 C 259.3 99.3 267.1 114.1 269.7 118.4 C 272.2 122.7 272.9 122.5 272.9 121.1 C 272.9 119.7 270.2 112.8 269.7 109.9 C 269.2 107.0 269.2 104.6 269.7 103.5 C 270.2 102.4 272.0 102.8 272.9 103.1 C 273.8 103.4 274.8 105.6 275.2 105.4 C 275.6 105.2 276.2 103.8 275.2 102.2 C 274.2 100.6 272.2 98.2 269.3 95.9 C 266.4 93.6 259.6 88.4 258.0 88.2 Z"] };
    Y.side = { body: "M 558 45 C 556.3 34.3 553.7 42.7 552 40 C 550.3 37.3 550.7 32.8 548 29 C 545.3 25.2 540.5 20.2 536 17 C 531.5 13.8 527.8 12.0 521 10 C 514.2 8.0 499.5 6.7 495 5 C 490.5 3.3 525.8 0.8 494 0 C 462.2 -0.8 335.8 -0.8 304 0 C 272.2 0.8 308.2 2.3 303 5 C 297.8 7.7 280.8 12.5 273 16 C 265.2 19.5 263.3 21.0 256 26 C 248.7 31.0 236.2 40.0 229 46 C 221.8 52.0 218.0 59.3 213 62 C 208.0 64.7 202.3 60.8 199 62 C 195.7 63.2 194.2 65.3 193 69 C 191.8 72.7 194.0 79.8 192 84 C 190.0 88.2 184.2 92.0 181 94 C 177.8 96.0 176.0 94.3 173 96 C 170.0 97.7 166.5 102.7 163 104 C 159.5 105.3 154.3 102.7 152 104 C 149.7 105.3 150.7 110.5 149 112 C 147.3 113.5 146.7 110.3 142 113 C 137.3 115.7 125.7 125.3 121 128 C 116.3 130.7 115.2 128.0 114 129 C 112.8 130.0 115.5 131.2 114 134 C 112.5 136.8 107.8 143.8 105 146 C 102.2 148.2 98.7 146.2 97 147 C 95.3 147.8 95.3 147.5 95 151 C 94.7 154.5 95.7 164.5 95 168 C 94.3 171.5 91.7 169.0 91 172 C 90.3 175.0 91.7 181.3 91 186 C 90.3 190.7 87.7 195.5 87 200 C 86.3 204.5 86.3 209.8 87 213 C 87.7 216.2 90.3 217.0 91 219 C 91.7 221.0 89.3 222.3 91 225 C 92.7 227.7 98.3 233.3 101 235 C 103.7 236.7 105.8 236.7 107 235 C 108.2 233.3 106.0 226.5 108 225 C 110.0 223.5 117.0 224.0 119 226 C 121.0 228.0 120.8 235.0 120 237 C 119.2 239.0 115.0 236.2 114 238 C 113.0 239.8 113.3 245.5 114 248 C 114.7 250.5 116.2 251.7 118 253 C 119.8 254.3 123.0 254.3 125 256 C 127.0 257.7 128.3 261.8 130 263 C 131.7 264.2 134.0 262.0 135 263 C 136.0 264.0 132.0 267.0 136 269 C 140.0 271.0 154.5 273.3 159 275 C 163.5 276.7 160.0 278.0 163 279 C 166.0 280.0 172.3 279.7 177 281 C 181.7 282.3 178.3 285.5 191 287 C 203.7 288.5 236.3 290.3 253 290 C 269.7 289.7 284.3 286.5 291 285 C 297.7 283.5 289.7 282.3 293 281 C 296.3 279.7 308.0 278.5 311 277 C 314.0 275.5 309.8 273.2 311 272 C 312.2 270.8 316.8 271.2 318 270 C 319.2 268.8 316.5 266.5 318 265 C 319.5 263.5 325.2 262.8 327 261 C 328.8 259.2 327.0 256.3 329 254 C 331.0 251.7 330.5 250.8 339 247 C 347.5 243.2 372.5 234.3 380 231 C 387.5 227.7 382.5 227.7 384 227 C 385.5 226.3 386.0 228.5 389 227 C 392.0 225.5 397.7 219.8 402 218 C 406.3 216.2 406.2 219.5 415 216 C 423.8 212.5 447.0 200.2 455 197 C 463.0 193.8 459.5 198.0 463 197 C 466.5 196.0 468.0 192.7 476 191 C 484.0 189.3 504.7 188.3 511 187 C 517.3 185.7 512.5 183.7 514 183 C 515.5 182.3 517.5 183.8 520 183 C 522.5 182.2 526.2 180.3 529 178 C 531.8 175.7 535.3 171.7 537 169 C 538.7 166.3 537.8 163.5 539 162 C 540.2 160.5 542.8 163.3 544 160 C 545.2 156.7 544.8 145.7 546 142 C 547.2 138.3 550.2 142.5 551 138 C 551.8 133.5 549.8 119.0 551 115 C 552.2 111.0 556.2 115.8 558 114 C 559.8 112.2 562.0 115.5 562 104 C 562.0 92.5 559.7 55.7 558 45 Z",
      glass: "M 194 97 C 194.8 99.8 194.2 100.7 200 103 C 205.8 105.3 223.2 108.8 229 111 C 234.8 113.2 227.8 113.5 235 116 C 242.2 118.5 259.8 123.7 272 126 C 284.2 128.3 300.5 131.0 308 130 C 315.5 129.0 314.3 122.2 317 120 C 319.7 117.8 321.0 121.0 324 117 C 327.0 113.0 332.5 99.7 335 96 C 337.5 92.3 338.3 95.8 339 95 C 339.7 94.2 338.3 92.3 339 91 C 339.7 89.7 341.0 87.7 343 87 C 345.0 86.3 349.7 88.7 351 87 C 352.3 85.3 350.3 78.8 351 77 C 351.7 75.2 354.3 78.2 355 76 C 355.7 73.8 353.5 66.8 355 64 C 356.5 61.2 360.5 59.8 364 59 C 367.5 58.2 374.2 56.2 376 59 C 377.8 61.8 376.3 71.8 375 76 C 373.7 80.2 369.7 82.7 368 84 C 366.3 85.3 365.7 83.0 365 84 C 364.3 85.0 365.5 89.0 364 90 C 362.5 91.0 357.3 88.0 356 90 C 354.7 92.0 356.8 99.3 356 102 C 355.2 104.7 353.3 102.5 351 106 C 348.7 109.5 343.5 118.8 342 123 C 340.5 127.2 340.5 129.5 342 131 C 343.5 132.5 348.7 135.3 351 132 C 353.3 128.7 354.7 115.0 356 111 C 357.3 107.0 353.2 108.0 359 108 C 364.8 108.0 379.8 113.3 391 111 C 402.2 108.7 419.7 97.7 426 94 C 432.3 90.3 423.5 91.7 429 89 C 434.5 86.3 453.7 80.5 459 78 C 464.3 75.5 459.5 74.8 461 74 C 462.5 73.2 464.0 75.0 468 73 C 472.0 71.0 481.3 64.8 485 62 C 488.7 59.2 487.7 57.7 490 56 C 492.3 54.3 496.0 54.7 499 52 C 502.0 49.3 506.2 43.7 508 40 C 509.8 36.3 510.2 31.8 510 30 C 509.8 28.2 507.5 31.2 507 29 C 506.5 26.8 505.0 19.2 507 17 C 509.0 14.8 517.0 16.8 519 16 C 521.0 15.2 523.3 13.5 519 12 C 514.7 10.5 497.5 9.0 493 7 C 488.5 5.0 523.2 1.2 492 0 C 460.8 -1.2 337.2 -1.2 306 0 C 274.8 1.2 311.5 3.3 305 7 C 298.5 10.7 279.3 15.2 267 22 C 254.7 28.8 237.8 42.3 231 48 C 224.2 53.7 227.7 54.5 226 56 C 224.3 57.5 222.3 55.7 221 57 C 219.7 58.3 219.3 62.7 218 64 C 216.7 65.3 214.7 63.0 213 65 C 211.3 67.0 211.0 72.5 208 76 C 205.0 79.5 197.3 82.5 195 86 C 192.7 89.5 193.2 94.2 194 97 Z",
      frontLower: "M 355 234 C 351.8 233.5 339.5 238.0 336 235 C 332.5 232.0 335.8 222.2 334 216 C 332.2 209.8 326.5 202.0 325 198 C 323.5 194.0 327.8 193.2 325 192 C 322.2 190.8 313.3 190.0 308 191 C 302.7 192.0 298.2 193.8 293 198 C 287.8 202.2 280.3 211.7 277 216 C 273.7 220.3 274.0 220.0 273 224 C 272.0 228.0 272.0 237.2 271 240 C 270.0 242.8 268.2 236.0 267 241 C 265.8 246.0 265.5 264.2 264 270 C 262.5 275.8 269.7 274.8 258 276 C 246.3 277.2 205.2 277.5 194 277 C 182.8 276.5 192.7 274.0 191 273 C 189.3 272.0 185.3 273.8 184 271 C 182.7 268.2 184.7 258.8 183 256 C 181.3 253.2 177.0 255.7 174 254 C 171.0 252.3 168.8 247.5 165 246 C 161.2 244.5 153.5 245.7 151 245 C 148.5 244.3 151.8 242.7 150 242 C 148.2 241.3 142.5 241.8 140 241 C 137.5 240.2 137.3 237.7 135 237 C 132.7 236.3 127.7 235.7 126 237 C 124.3 238.3 124.7 243.5 125 245 C 125.3 246.5 127.5 244.0 128 246 C 128.5 248.0 127.3 254.5 128 257 C 128.7 259.5 130.5 260.3 132 261 C 133.5 261.7 136.0 260.0 137 261 C 138.0 262.0 134.0 265.0 138 267 C 142.0 269.0 156.5 271.3 161 273 C 165.5 274.7 162.0 276.0 165 277 C 168.0 278.0 174.3 277.7 179 279 C 183.7 280.3 181.0 283.5 193 285 C 205.0 286.5 235.0 288.3 251 288 C 267.0 287.7 282.3 284.5 289 283 C 295.7 281.5 287.7 280.3 291 279 C 294.3 277.7 306.0 276.5 309 275 C 312.0 273.5 307.8 271.2 309 270 C 310.2 268.8 314.8 269.2 316 268 C 317.2 266.8 314.5 264.5 316 263 C 317.5 261.5 323.0 261.0 325 259 C 327.0 257.0 325.3 253.3 328 251 C 330.7 248.7 338.3 247.0 341 245 C 343.7 243.0 341.7 240.2 344 239 C 346.3 237.8 353.2 238.8 355 238 C 356.8 237.2 358.2 234.5 355 234 Z",
      rearDark: "M 542 103 C 539.8 100.8 536.7 100.3 532 102 C 527.3 103.7 520.0 104.2 514 113 C 508.0 121.8 499.0 146.2 496 155 C 493.0 163.8 498.3 162.3 496 166 C 493.7 169.7 490.0 173.3 482 177 C 474.0 180.7 458.5 183.2 448 188 C 437.5 192.8 425.5 203.0 419 206 C 412.5 209.0 413.3 204.8 409 206 C 404.7 207.2 396.3 210.8 393 213 C 389.7 215.2 393.0 217.2 389 219 C 385.0 220.8 372.7 222.0 369 224 C 365.3 226.0 365.5 230.2 367 231 C 368.5 231.8 372.5 231.5 378 229 C 383.5 226.5 394.2 218.5 400 216 C 405.8 213.5 404.2 217.5 413 214 C 421.8 210.5 445.0 198.2 453 195 C 461.0 191.8 457.8 196.0 461 195 C 464.2 194.0 464.0 190.7 472 189 C 480.0 187.3 502.3 186.3 509 185 C 515.7 183.7 510.5 181.7 512 181 C 513.5 180.3 515.5 181.8 518 181 C 520.5 180.2 524.2 178.3 527 176 C 529.8 173.7 533.3 169.8 535 167 C 536.7 164.2 535.8 160.5 537 159 C 538.2 157.5 540.8 161.2 542 158 C 543.2 154.8 542.8 143.7 544 140 C 545.2 136.3 548.2 140.0 549 136 C 549.8 132.0 549.7 119.5 549 116 C 548.3 112.5 546.2 117.2 545 115 C 543.8 112.8 544.2 105.2 542 103 Z",
      lights: ["M 262 179 C 262.0 178.0 249.5 182.7 244 185 C 238.5 187.3 229.0 192.0 229 193 C 229.0 194.0 238.5 193.3 244 191 C 249.5 188.7 262.0 180.0 262 179 Z", "M 119 134 C 119.3 132.2 111.2 140.2 109 143 C 106.8 145.8 106.3 149.2 106 151 C 105.7 152.8 104.8 156.8 107 154 C 109.2 151.2 118.7 135.8 119 134 Z"] };
    return { y: Y, "3": Y };
  })();

  customElements.define("tesla-fleet-card", TeslaFleetCard);
  customElements.define("tesla-fleet-card-editor", TeslaFleetCardEditor);
  window.customCards = window.customCards || [];
  window.customCards.push({
    type: "tesla-fleet-card",
    name: "Tesla Fleet Card",
    description: "Tesla-app-style card for tesla_custom & tesla_fleet — multi-car, one-click switching",
    preview: true,
  });
  console.info(
    "%c TESLA-FLEET-CARD %c v" + CARD_VERSION + " ",
    "background:#e82127;color:#fff;font-weight:700;border-radius:4px 0 0 4px;padding:2px 0",
    "background:#333;color:#fff;border-radius:0 4px 4px 0;padding:2px 0"
  );
})();
