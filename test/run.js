/* Tesla Fleet Card - regression tests.
 *
 * Runs the real card in a real browser. That matters: the bug this suite was
 * born from (issue #1, "it reverts to the first vehicle") was a shadow-root
 * teardown that only shows up with genuine innerHTML semantics. It was
 * reasoned about, declared fixed, and shipped broken. A hand-rolled DOM shim
 * would have missed it too.
 *
 *   npm install && node test/run.js
 *
 * Exits non-zero on any failure, so it is CI-ready.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const CARD = path.join(__dirname, "..", "tesla-fleet-card.js");

let passed = 0;
const failures = [];
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log("  pass  " + name); }
  else { failures.push(name); console.log("  FAIL  " + name +
    "\n          expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual)); }
}

/* A car's worth of tesla_custom states. `entity_id` is not optional: the card
   reads state.entity_id to tell a binary_sensor from a sensor, and real Home
   Assistant states always carry it. A mock without it throws and looks
   convincingly like a card bug. */
function customStates(p) {
  const s = {};
  const sensors = ["battery", "range", "charger_power", "charging_rate", "energy_added",
    "time_charge_complete", "odometer", "temperature_inside", "temperature_outside",
    "shift_state", "data_last_update_time", "tpms_front_left", "tpms_front_right",
    "tpms_rear_left", "tpms_rear_right"];
  sensors.forEach((k) => { s["sensor." + p + k] = { state: "42", attributes: { unit_of_measurement: "km" } }; });
  ["charging", "charger", "online", "asleep", "doors", "windows"].forEach((k) => {
    s["binary_sensor." + p + k] = { state: "off", attributes: {} }; });
  s["climate." + p + "hvac_climate_system"] =
    { state: "off", attributes: { preset_mode: "off", current_temperature: 20, temperature: 21 } };
  s["lock." + p + "doors"] = { state: "locked", attributes: {} };
  s["device_tracker." + p + "location_tracker"] = { state: "home", attributes: { latitude: 1, longitude: 2 } };
  ["frunk", "trunk", "charger_door", "windows"].forEach((k) => {
    s["cover." + p + k] = { state: "closed", attributes: {} }; });
  ["charge_limit", "charging_amps"].forEach((k) => { s["number." + p + k] = { state: "80", attributes: {} }; });
  s["switch." + p + "charger"] = { state: "off", attributes: {} };
  s["switch." + p + "sentry_mode"] = { state: "off", attributes: {} };
  Object.keys(s).forEach((k) => { s[k].entity_id = k; });
  return s;
}

(async () => {
  const browser = await chromium.launch(
    process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  await page.setContent("<!doctype html><html><body></body></html>");
  await page.addScriptTag({ content: fs.readFileSync(CARD, "utf8") });

  const r = await page.evaluate((customStatesSrc) => {
    const customStates = eval("(" + customStatesSrc + ")");
    const R = {};
    const cars3 = () => ({ type: "custom:tesla-fleet-card", cars: [
      { name: "One", model: "Model 3", paint: "grey", prefix: "one_" },
      { name: "Two", model: "Model Y", paint: "red", prefix: "two_" },
      { name: "Three", model: "Model 3", paint: "grey", prefix: "three_" }] });

    const mkCard = (cars, states) => {
      const c = document.createElement("tesla-fleet-card");
      document.body.appendChild(c);
      c.setConfig({ type: "custom:tesla-fleet-card", cars });
      if (states) c.hass = { states };
      return c;
    };

    /* ---- integration detection ---------------------------------------- */
    R.detect_custom = mkCard([{ name: "A", model: "Model 3", paint: "grey", prefix: "buddy_" }],
      customStates("buddy_"))._cars[0]._integration;

    const fleet = { "sensor.foo_battery_level": { state: "50", attributes: {}, entity_id: "sensor.foo_battery_level" } };
    R.detect_fleet = mkCard([{ name: "B", model: "Model 3", paint: "grey", prefix: "foo_" }],
      fleet)._cars[0]._integration;

    R.detect_empty_prefix = mkCard([{ name: "C", model: "Model 3", paint: "grey", prefix: "" }],
      customStates(""))._cars[0]._integration;

    /* issue #1: the reporter typed grande_bianco for grande_bianco_* entities */
    R.detect_missing_underscore = mkCard([{ name: "D", model: "Model 3", paint: "grey", prefix: "grande_bianco" }],
      customStates("grande_bianco_"))._cars[0]._integration;
    R.missing_underscore_fleet_too = mkCard([{ name: "E", model: "Model 3", paint: "grey", prefix: "foo" }],
      fleet)._cars[0]._integration;

    /* a prefix that is genuinely wrong must still fail, so the on-card
       diagnostic still fires rather than being papered over */
    const wrong = mkCard([{ name: "F", model: "Model 3", paint: "grey", prefix: "nonsense_" }],
      customStates("buddy_"));
    R.wrong_prefix_not_detected = wrong._cars[0]._integration || null;
    R.wrong_prefix_shows_diag = wrong.shadowRoot.innerHTML.includes("No Tesla entities found for prefix");

    /* KNOWN GAP, fixed by device-based discovery in v1.2.0, not by this suite:
       a German install names the entity sensor.<car>_batterieladung, so nothing
       resolves. Asserted as the CURRENT behaviour so the day it starts passing
       is visible rather than silent. */
    const de = { "sensor.auto_batterieladung": { state: "50", attributes: {}, entity_id: "sensor.auto_batterieladung" } };
    R.localised_ids_known_gap = mkCard([{ name: "G", model: "Model 3", paint: "grey", prefix: "auto_" }],
      de)._cars[0]._integration || null;

    /* ---- entity maps -------------------------------------------------- */
    const cv = mkCard([{ name: "H", model: "Model 3", paint: "grey", prefix: "buddy_" }], customStates("buddy_"));
    R.charger_voltage_blank_on_custom = cv._cars[0]._entities.charger_voltage;
    const cvf = mkCard([{ name: "I", model: "Model 3", paint: "grey", prefix: "foo_" }], fleet);
    R.charger_voltage_present_on_fleet = cvf._cars[0]._entities.charger_voltage;

    /* a per-car override must beat the derived pattern (this is how a renamed
       entity is worked around without touching Home Assistant) */
    const ov = mkCard([{ name: "J", model: "Model 3", paint: "grey", prefix: "buddy_",
      entities: { location: "device_tracker.renamed_thing" } }], customStates("buddy_"));
    R.entity_override_wins = ov._cars[0]._entities.location;

    /* ---- the card renders --------------------------------------------- */
    R.card_renders = mkCard([{ name: "K", model: "Model 3", paint: "grey", prefix: "buddy_" }],
      customStates("buddy_")).shadowRoot.innerHTML.length > 2000;

    /* ---- seat and wheel heat: mode AND level ---------------------------
       Tesla stores a mode plus a level. Flattening them made Auto look like
       maximum heat and made a cooled seat render in hot red. Both were found
       by driving a real car, not by reading the code. */
    const climCard = (extra) => {
      const st = customStates("t_");
      Object.keys(extra).forEach((k) => { st[k] = { entity_id: k, state: extra[k], attributes: {} }; });
      st["climate.t_hvac_climate_system"] = { entity_id: "climate.t_hvac_climate_system", state: "heat_cool",
        attributes: { preset_mode: "normal", preset_modes: ["normal", "defrost", "keep", "dog", "camp"],
                      fan_mode: "off", fan_modes: ["off", "bioweapon"], current_temperature: 20, temperature: 20 } };
      const c = document.createElement("tesla-fleet-card");
      document.body.appendChild(c);
      c.setConfig({ type: "custom:tesla-fleet-card", cars: [{ name: "T", model: "Model 3", paint: "grey", prefix: "t_" }] });
      c.hass = { states: st };
      c._view = "clim"; c._built = false; c.hass = { states: st };
      return c;
    };
    const glyph = (c, id, n) => {
      const waves = [];
      for (let i = 0; i < n; i++) {
        const w = c.shadowRoot.getElementById(id + "_w" + i);
        waves.push(w ? w.getAttribute("stroke") : null);
      }
      const a = c.shadowRoot.getElementById(id + "_auto");
      /* count only genuinely coloured waves. A MISSING element reads as null,
         and counting null as "lit" made these tests pass against the old
         version for the wrong reason. */
      const ON = ["#e43335", "#385ec4"];
      return { lit: waves.filter((x) => ON.indexOf(x) >= 0).length,
               col: waves.find((x) => ON.indexOf(x) >= 0) || null,
               grey: waves.every((x) => x === "#90908e"),
               autoCol: a ? a.getAttribute("fill") : null,
               auto: a ? a.style.display !== "none" : null };
    };
    const seat = (v) => glyph(climCard({ "select.t_heated_seat_left": v }), "seatFL", 3);
    R.seat_off        = seat("Off");
    R.seat_low        = seat("Low");
    R.seat_high       = seat("High");
    R.seat_heatMedium = seat("Heat Medium");
    R.seat_coolHigh   = seat("Cool High");
    R.seat_auto       = seat("Auto");
    R.wheel_low   = glyph(climCard({ "select.t_heated_steering_wheel": "Low",  "switch.t_heated_steering": "on" }), "wheelHeat", 2);
    R.wheel_high  = glyph(climCard({ "select.t_heated_steering_wheel": "High", "switch.t_heated_steering": "on" }), "wheelHeat", 2);
    R.wheel_auto  = glyph(climCard({ "select.t_heated_steering_wheel": "Auto", "switch.t_heated_steering": "off" }), "wheelHeat", 2);
    R.wheel_switchOnly = glyph(climCard({ "switch.t_heated_steering": "on" }), "wheelHeat", 2);

    /* ---- Bioweapon Defense: a model test, not a capability test --------
       tesla_custom reports fan_modes ["off","bioweapon"] for every car,
       checked on four of Nick's. The mode needs a HEPA filter, which Model
       S/X/Y carry and Model 3 does not. */
    const climModel = (model, extra, vin) => {
      const st = customStates("t_");
      if (vin) st["binary_sensor.t_online"] = { entity_id: "binary_sensor.t_online",
        state: "on", attributes: { vin: vin } };
      st["climate.t_hvac_climate_system"] = { entity_id: "climate.t_hvac_climate_system",
        state: "heat_cool", attributes: { preset_mode: "normal",
          preset_modes: ["normal", "defrost", "keep", "dog", "camp"],
          fan_mode: "off", fan_modes: ["off", "bioweapon"],
          current_temperature: 20, temperature: 20 } };
      const c = document.createElement("tesla-fleet-card");
      document.body.appendChild(c);
      c.setConfig({ type: "custom:tesla-fleet-card", cars: [Object.assign(
        { name: "T", model: model, paint: "grey", prefix: "t_" }, extra || {})] });
      c.hass = { states: st };
      c._view = "clim"; c._built = false; c.hass = { states: st };
      return c;
    };
    const hasBio = (c) => !!c.shadowRoot.getElementById("btnBio");
    R.bio_on_model_y = hasBio(climModel("Model Y"));
    R.bio_off_model_3 = hasBio(climModel("Model 3"));
    R.bio_off_model_3_spaced = hasBio(climModel("model3"));
    R.bio_on_model_x = hasBio(climModel("Model X"));
    /* a retrofitted Model 3 can be told it does have one, and a 2020 Model Y
       that predates the factory HEPA can be told it does not */
    R.bio_forced_on = hasBio(climModel("Model 3", { show_climate: ["bio"] }));
    R.bio_forced_off = hasBio(climModel("Model Y", { hide_climate: ["bio"] }));
    /* the YEAR decides whether this particular car got the filter: the Model Y
       line started fitting them in June 2021. Decoded from VIN position 10. */
    R.bio_y_2023 = hasBio(climModel("Model Y", null, "LRWYHCEKXPC730074")); /* P = 2023 */
    R.bio_y_2020 = hasBio(climModel("Model Y", null, "LRWYHCEKXLC730074")); /* L = 2020 */
    R.bio_y_2020_retrofit = hasBio(climModel("Model Y", { show_climate: ["bio"] },
      "LRWYHCEKXLC730074"));
    R.bio_x_2014 = hasBio(climModel("Model X", null, "5YJXCDE24FF000001")); /* F = 2015 */
    /* pack generations. The two Model Y packs are different cars: red is
       pre-refresh, white is the 2025 Juniper. */
    const genOf = (model, vin, extra) => {
      const c = climModel(model, extra, vin);
      return c._generation();
    };
    R.gen_y_2023 = genOf("Model Y", "LRWYHCEKXPC730074");   /* P = 2023 */
    R.gen_y_2026 = genOf("Model Y", "LRWYHCEKXTC730074");   /* T = 2026 */
    R.gen_3_2024 = genOf("Model 3", "LRW3F7FS5RC043917");   /* R = 2024 */
    R.gen_3_2022 = genOf("Model 3", "LRW3F7FR3NC609256");   /* N = 2022 */
    R.gen_3_2023 = genOf("Model 3", "LRW3F7FS4PC762296");   /* P = 2023 */
    R.gen_override = genOf("Model Y", "LRWYHCEKXPC730074", { generation: "juniper" });
    /* a pre-refresh Model Y pointed at the white Juniper pack must say so */
    (() => {
      const c = climModel("Model Y", { images: "models/y/white/app" }, "LRWYHCEKXPC730074");
      c._view = ""; c._built = false; c.hass = c._hass;
      const im = c.shadowRoot.getElementById("restImg");
      R.gen_mismatch_title = im ? im.title : "(no image)";
    })();
    (() => {
      const c = climModel("Model Y", { images: "models/y/red/app" }, "LRWYHCEKXPC730074");
      c._view = ""; c._built = false; c.hass = c._hass;
      const im = c.shadowRoot.getElementById("restImg");
      R.gen_match_title = im ? im.title : "(no image)";
    })();
    /* the year is decoded and shown, and the VIN is a tooltip not a label */
    (() => {
      const c = climModel("Model 3", null, "LRW3F7FS5RC043917");  /* R = 2024 */
      c._view = ""; c._built = false; c.hass = c._hass;
      const odo = c.shadowRoot.getElementById("odo");
      R.foot_year = odo ? odo.textContent : null;
      R.foot_vin_title = odo ? odo.getAttribute("title") : null;
    })();
    (() => {
      const c = climModel("Model 3", { }, "LRW3F7FS5RC043917");
      c._config.show_vin = true;
      c._view = ""; c._built = false; c.hass = c._hass;
      const odo = c.shadowRoot.getElementById("odo");
      R.foot_vin_inline = odo ? odo.textContent : null;
    })();
    /* every mode button centred, like Defrost Car above them */
    R.mode_buttons_centred = Array.prototype.map.call(
      climModel("Model Y").shadowRoot.querySelectorAll(".defrostBtn"),
      (b) => getComputedStyle(b).textAlign);

    /* ---- the driving view ----------------------------------------------
       The card swaps to a moving road and a speed readout when the car is in
       gear. Geometry was measured off a screen recording of the app rather
       than invented: see the DRIVE block in the card. */
    const driveCard = (shift, speed, extra) => {
      const st = customStates("t_");
      st["binary_sensor.t_online"].state = "on";
      st["sensor.t_shift_state"] = { entity_id: "sensor.t_shift_state", state: shift, attributes: {} };
      /* speed === "omit" leaves the key out altogether, which is a different
         thing from a null: tesla_custom reports null on a parked car, so null
         means stopped and a missing key means the integration never says. */
      const at = { latitude: 1, longitude: 2 };
      if (speed !== "omit") at.speed = speed;
      st["device_tracker.t_location_tracker"] = { entity_id: "device_tracker.t_location_tracker",
        state: "not_home", attributes: at };
      const c = document.createElement("tesla-fleet-card");
      document.body.appendChild(c);
      c.setConfig({ type: "custom:tesla-fleet-card", cars: [Object.assign(
        { name: "T", model: "Model Y", paint: "red", prefix: "t_",
          image_side: "side.jpg",
          wheels: { lift: 1.26, front: [106.9, 77.9, 15.65, 10.99, 109.3],
                    rear: [187.9, 45.8, 0.90] } }, extra || {})] });
      c.hass = { states: st };
      return c;
    };
    const driveState = (c) => {
      const o = c.shadowRoot.getElementById("driveOvl");
      const sub = c.shadowRoot.getElementById("sub");
      return {
        shown: o ? o.style.display !== "none" : null,
        lines: o ? o.querySelectorAll("line").length : null,
        slides: o ? o.querySelectorAll("line > animate").length : null,
        spinners: o ? o.querySelectorAll("animateTransform").length : null,
        wheelClips: o ? o.querySelectorAll("clipPath[id^=dwC]").length : null,
        /* the rotating pixels must be the pack photo itself, not drawn art */
        wheelImg: o && o.querySelector("image#dwImg")
          ? o.querySelector("image#dwImg").getAttribute("href") : null,
        /* both wheels lie in the same plane of the car, so they must share a
           lean and an axis ratio. Read the two clip ellipses back and compare:
           an independently fitted rear came out 18 degrees off and looked it. */
        clipGeom: o ? Array.prototype.map.call(o.querySelectorAll("clipPath[id^=dwC] ellipse"),
          (e) => [e.getAttribute("transform"),
                  /* 2dp: the clip's rx/ry are written rounded to 2dp, so a
                     third digit here compares rounding noise, not geometry */
                  (+e.getAttribute("rx") / +e.getAttribute("ry")).toFixed(2)]) : null,
        cycle: o && o.querySelector("line > animate")
          ? o.querySelector("line > animate").getAttribute("dur") : null,
        wheelDur: o && o.querySelector("animateTransform")
          ? o.querySelector("animateTransform").getAttribute("dur") : null,
        sub: sub ? sub.textContent : null
      };
    };
    R.drive_parked  = driveState(driveCard("P", 0));
    R.drive_drive   = driveState(driveCard("D", 42));
    R.drive_reverse = driveState(driveCard("R", 3));
    R.drive_no_speed = driveState(driveCard("D", 0)).sub;
    R.drive_motion_off = driveState(driveCard("D", 42, { drive_motion: "off" }));
    /* somebody else's photo gets still wheels: a wrong ellipse is a wobble */
    R.drive_unmeasured_pack = driveState(driveCard("D", 42,
      { wheels: null, image_side: "nothing/we/measured/side.jpg" })).spinners;
    /* Patsy is configured with the individual image_* keys and no `images`
       directory, so the pack has to be recognised from the photo's URL.
       Getting this wrong meant the Model Y cars showed no animation at all. */
    R.pack_from_image_side = driveState(driveCard("D", 42,
      { wheels: null, road: null,
        image_side: "/local/Tesla/models/y/red/app/side.jpg?v=1" }));
    /* speed tiers: below 20 km/h the road runs at 1.7s, above it doubles */
    /* a car in gear but stopped keeps its road and loses the motion */
    R.tier_still = driveState(driveCard("D", 0));
    /* a car whose speed cannot be read must NOT freeze: it falls back to
       moving, or the road would strand mid-slide on any integration that
       does not report a speed at all */
    R.tier_no_speed = driveState(driveCard("D", "omit"));
    /* the road speed is proportional to the car's: doubling one halves the
       other. Two tiers gave 40 and 100 km/h the same animation, which is what
       made 40 read as half its real speed. */
    R.cyc_20 = driveState(driveCard("D", 20)).cycle;
    R.cyc_40 = driveState(driveCard("D", 40)).cycle;
    R.cyc_80 = driveState(driveCard("D", 80)).cycle;
    R.cyc_ref = driveState(driveCard("D", 40)).cycle;   /* refKph -> refCycle */
    R.cyc_crawl = driveState(driveCard("D", 2)).cycle;  /* clamped by maxCycle */
    R.cyc_flat_out = driveState(driveCard("D", 250)).cycle; /* by minCycle */
    R.tier_slow = R.cyc_20; R.tier_fast = R.cyc_80;
    R.w40 = driveState(driveCard("D", 40)).wheelDur;
    R.wflat = driveState(driveCard("D", 250)).wheelDur;
    R.tier_slow_wheel = driveState(driveCard("D", 20)).wheelDur;
    R.tier_fast_wheel = driveState(driveCard("D", 80)).wheelDur;
    /* A wheel that does not roll with the road under it is the first thing
       the eye catches, and it caught Nick's. The rotation period must be
       DERIVED from the road, so the ratio between them cannot depend on the
       tier - that is what a pair of independent constants got wrong. */
    R.wheel_road_ratio = ["tier_slow", "tier_fast"].map((k, i) => {
      const cyc = parseFloat(i ? R.tier_fast : R.tier_slow);
      const wd = parseFloat(i ? R.tier_fast_wheel : R.tier_slow_wheel);
      return +(wd / cyc).toFixed(3);
    });
    /* and independently: one revolution advances the contact patch by 2*pi
       times the ellipse's semi-diameter along the direction of travel */
    (() => {
      const a = 15.65, b = 10.99, phi = 109.3, ang = -21.9;
      const al = (ang - phi) * Math.PI / 180;
      const ca = Math.cos(al) / a, sa = Math.sin(al) / b;
      const semi = 1 / Math.sqrt(ca * ca + sa * sa);
      const perRev = 2 * Math.PI * semi;
      const box = mkCard([{ name: "Z", model: "Model Y", paint: "red", prefix: "t_",
        image_side: "side.jpg" }], customStates("t_"))._carBox("side.jpg", "Rest");
      const cw = box[2] - box[0];
      const roadSpeed = Math.max(8, cw * 0.45) / parseFloat(R.tier_fast);
      R.wheel_expected_fast = +(perRev / roadSpeed).toFixed(2);
    })();
    /* a pack may carry its own reference cycle, which drive_speed then scales.
       0.86 at 40 km/h, driven at 42, so 0.86 * 40/42. */
    R.drive_cycle_override = driveState(driveCard("D", 42,
      { road: { angle: -21.9, cycle: 0.86, lines: [[93.3, 2.2]] } })).cycle;
    /* miles stay miles */
    (() => {
      const st = customStates("t_");
      st["binary_sensor.t_online"].state = "on";
      st["sensor.t_range"].attributes.unit_of_measurement = "mi";
      st["sensor.t_shift_state"] = { entity_id: "sensor.t_shift_state", state: "D", attributes: {} };
      st["device_tracker.t_location_tracker"] = { entity_id: "device_tracker.t_location_tracker",
        state: "not_home", attributes: { latitude: 1, longitude: 2, speed: 42 } };
      const c = document.createElement("tesla-fleet-card");
      document.body.appendChild(c);
      c.setConfig({ type: "custom:tesla-fleet-card",
        cars: [{ name: "T", model: "Model Y", paint: "red", prefix: "t_", image_side: "side.jpg" }] });
      c.hass = { states: st };
      R.drive_speed_imperial = c.shadowRoot.getElementById("sub").textContent;
    })();

    /* ---- the running mode must be visible on the HOME view -------------
       Pet Mode on a parked car used to show nothing outside the Climate view. */
    const homeSub = (preset) => {
      const st = customStates("t_");
      st["binary_sensor.t_online"].state = "on";   // else the card reads Offline
      st["sensor.t_shift_state"].state = "P";
      st["climate.t_hvac_climate_system"] = { entity_id: "climate.t_hvac_climate_system", state: "heat_cool",
        attributes: { preset_mode: preset, preset_modes: ["normal", "defrost", "keep", "dog", "camp"],
                      fan_mode: "off", fan_modes: ["off", "bioweapon"], current_temperature: 20, temperature: 20 } };
      const c = document.createElement("tesla-fleet-card");
      document.body.appendChild(c);
      c.setConfig({ type: "custom:tesla-fleet-card", cars: [{ name: "T", model: "Model 3", paint: "grey", prefix: "t_" }] });
      c.hass = { states: st };
      const sub = c.shadowRoot.getElementById("sub");
      return sub ? sub.textContent : null;
    };
    R.home_normal  = homeSub("normal");
    R.home_dog     = homeSub("dog");
    R.home_defrost = homeSub("defrost");

    /* ---- the editor ---------------------------------------------------- */
    const ed = document.createElement("tesla-fleet-card-editor");
    document.body.appendChild(ed);
    ed.hass = { states: {} };
    ed.setConfig(cars3());
    let emitted = null;
    ed.addEventListener("config-changed", (e) => { emitted = e.detail.config; });

    R.editor_renders_all_cars = ed.shadowRoot.querySelectorAll(".car").length;

    /* issue #1: HA echoes the config back after every change. Pre-v1.1.2 that
       tore down the shadow root, destroying the field being typed in. */
    const f = [...ed.shadowRoot.querySelectorAll("input")]
      .find((i) => i.dataset.i === "2" && i.dataset.k === "name");
    f.focus();
    f.value = "Renamed";
    f.dispatchEvent(new Event("change"));
    R.editor_emits_edit = emitted && emitted.cars[2].name;
    ed.setConfig(JSON.parse(JSON.stringify(emitted)));
    R.editor_field_survives_echo = ed.shadowRoot.contains(f);
    R.editor_focus_survives_echo = ed.shadowRoot.activeElement === f;

    /* but a real external change still has to rebuild */
    const y = cars3();
    y.cars.push({ name: "Four", model: "Model Y", paint: "white", prefix: "four_" });
    ed.setConfig(y);
    R.editor_rebuilds_on_yaml_edit = ed.shadowRoot.querySelectorAll(".car").length;

    ed.setConfig(cars3());
    ed.shadowRoot.getElementById("add").click();
    R.editor_add_car = ed.shadowRoot.querySelectorAll(".car").length;

    ed.setConfig(cars3());
    ed.shadowRoot.querySelector('[data-rm="1"]').click();
    R.editor_remove_car = ed.shadowRoot.querySelectorAll(".car").length;

    /* issue #1: "+ Add car" used to write a hard-coded blue that shadowed the
       paint picker for good. Picking a paint must clear any stale colour. */
    ed.setConfig({ type: "custom:tesla-fleet-card",
      cars: [{ name: "L", model: "Model Y", paint: "red", prefix: "l_", color: "#1e90ff" }] });
    const ps = ed.shadowRoot.querySelector('[data-k="paint"]');
    ps.value = "white";
    ps.dispatchEvent(new Event("change"));
    R.paint_clears_stale_color = emitted.cars[0].color === undefined;
    R.paint_is_written = emitted.cars[0].paint;

    return R;
  }, customStates.toString());

  console.log("\nintegration detection");
  check("tesla_custom detected", r.detect_custom, "tesla_custom");
  check("tesla_fleet detected", r.detect_fleet, "tesla_fleet");
  check("empty prefix works", r.detect_empty_prefix, "tesla_custom");
  check("missing trailing underscore tolerated", r.detect_missing_underscore, "tesla_custom");
  check("missing underscore tolerated on fleet too", r.missing_underscore_fleet_too, "tesla_fleet");
  check("a genuinely wrong prefix still fails", r.wrong_prefix_not_detected, null);
  check("a wrong prefix still shows the diagnostic", r.wrong_prefix_shows_diag, true);
  check("KNOWN GAP: localised entity IDs do not resolve (v1.2.0)", r.localised_ids_known_gap, null);

  console.log("\nentity maps");
  check("charger_voltage blank on tesla_custom", r.charger_voltage_blank_on_custom, "");
  check("charger_voltage present on tesla_fleet", r.charger_voltage_present_on_fleet, "sensor.foo_charger_voltage");
  check("a per-car entities override wins", r.entity_override_wins, "device_tracker.renamed_thing");

  console.log("\nrendering");
  check("the card renders", r.card_renders, true);
  check("no uncaught page errors", pageErrors, []);

  console.log("\nseat and wheel heat");
  check("off shows no lit waves",                 [r.seat_off.lit, r.seat_off.auto], [0, false]);
  check("Low lights one wave",                    r.seat_low.lit, 1);
  check("High lights three",                      r.seat_high.lit, 3);
  check("Buddy's \"Heat Medium\" lights two",      r.seat_heatMedium.lit, 2);
  check("cooling is BLUE, not hot red",           [r.seat_coolHigh.lit, r.seat_coolHigh.col], [3, "#385ec4"]);
  /* Measured off the app: on Auto the waves stay GREY and the word appears.
     v1.1.3 shipped them coloured, which read as "someone set this to full". */
  check("Auto is labelled, not shown as maximum", r.seat_auto.auto, true);
  check("Auto lights no waves at all",            r.seat_auto.lit, 0);
  check("Auto leaves every wave grey",            r.seat_auto.grey, true);
  check("the Auto label is grey, not hot",        r.seat_auto.autoCol, "#90908e");
  check("wheel Low lights one of two",            r.wheel_low.lit, 1);
  check("wheel High lights two",                  r.wheel_high.lit, 2);
  check("wheel Auto is labelled",                 r.wheel_auto.auto, true);
  check("wheel Auto lights no waves",             r.wheel_auto.lit, 0);
  check("wheel Auto label is grey",               r.wheel_auto.autoCol, "#90908e");
  check("wheel falls back to the switch",         r.wheel_switchOnly.lit, 2);

  console.log("\nBioweapon Defense needs a HEPA filter");
  check("Model Y is offered it",                  r.bio_on_model_y, true);
  check("Model X is offered it",                  r.bio_on_model_x, true);
  check("Model 3 is NOT",                         r.bio_off_model_3, false);
  check("however the model is spelled",           r.bio_off_model_3_spaced, false);
  check("show_climate can force it on",           r.bio_forced_on, true);
  check("hide_climate can force it off",          r.bio_forced_off, false);
  check("a 2023 Model Y keeps the button",  r.bio_y_2023, true);
  check("a 2020 Model Y loses it",         r.bio_y_2020, false);
  check("unless it was retrofitted",       r.bio_y_2020_retrofit, true);
  check("a 2015 Model X loses it too",     r.bio_x_2014, false);
  check("the footer shows year and model", r.foot_year.indexOf("2024 Model 3") === 0, true);
  check("the VIN is a tooltip, not a label",
    [r.foot_vin_title, r.foot_year.indexOf("LRW") >= 0], ["LRW3F7FS5RC043917", false]);
  check("show_vin puts it inline",         r.foot_vin_inline.indexOf("LRW3F7FS5RC043917") > 0, true);
  console.log("\npack generations");
  check("Model Y 2023 is pre-refresh",     r.gen_y_2023, "classic");
  check("Model Y 2026 is Juniper",         r.gen_y_2026, "juniper");
  check("Model 3 2024 is Highland",        r.gen_3_2024, "highland");
  check("Model 3 2022 is not",             r.gen_3_2022, "classic");
  /* Highland reached North America in January 2024, so a 2023 Model 3 could be
     either car. Guessing would serve the wrong bodywork with confidence. */
  check("Model 3 2023 refuses to guess",   r.gen_3_2023, null);
  check("config beats the VIN",            r.gen_override, "juniper");
  check("a mismatch is named on the image", r.gen_mismatch_title.indexOf("Juniper") >= 0, true);
  check("a matching pack says nothing",    r.gen_match_title, "");
  check("every mode button is centred",
    r.mode_buttons_centred.filter((a) => a !== "center"), []);

  console.log("\nthe driving view");
  check("parked shows no road",            r.drive_parked.shown, false);
  check("in gear shows the road",          r.drive_drive.shown, true);
  check("reverse counts as driving",       r.drive_reverse.shown, true);
  check("the road has markings",           r.drive_drive.lines > 0, true);
  check("one marking, not a hatch",        r.drive_drive.lines, 1);
  check("every marking slides",            r.drive_drive.slides, r.drive_drive.lines);
  /* The wheels rotate the pack photo's OWN pixels, clipped to each hub.
     The first attempt drew arcs over them and Nick called it horrific;
     asserting the href here is what stops drawn geometry coming back. */
  check("the wheels rotate real pixels",   r.drive_drive.wheelImg, "side.jpg");
  check("both wheels are clipped",         r.drive_drive.wheelClips, 2);
  check("three blur copies per wheel",     r.drive_drive.spinners, 6);
  /* the wheel must keep pace with the road at EVERY speed. It used to have a
     floor of its own, and at 120 km/h the road ran at 0.12s while the wheel
     sat at 0.18 - decoupled by half, the original fault moved up the range. */
  check("wheel tracks road at all speeds",
    [r.cyc_20, r.cyc_40, r.cyc_80, r.cyc_flat_out].map((c, i) =>
      Math.abs(parseFloat([r.tier_slow_wheel, r.w40, r.tier_fast_wheel, r.wflat][i]) /
               parseFloat(c) - 1.012) < 0.02), [true, true, true, true]);
  check("both wheels share an axis ratio", r.drive_drive.clipGeom[0][1], r.drive_drive.clipGeom[1][1]);
  check("both wheels share a lean",
    r.drive_drive.clipGeom[0][0].split(" ")[0], r.drive_drive.clipGeom[1][0].split(" ")[0]);
  check("stopped in gear keeps the road",  r.tier_still.lines, 1);
  check("stopped in gear keeps wheels",    r.tier_still.wheelClips, 2);
  check("but nothing moves",               [r.tier_still.slides, r.tier_still.spinners], [0, 0]);
  check("and a stopped wheel is sharp, not blurred",
    r.tier_still.clipGeom.length, 2);
  check("unknown speed still animates",    r.tier_no_speed.slides, 1);
  check("the road tracks the speed",       r.cyc_ref, "0.43s");
  check("double the speed, half the period",
    [r.cyc_20, r.cyc_40, r.cyc_80], ["0.86s", "0.43s", "0.22s"]);
  check("a crawl is clamped, not stopped",  r.cyc_crawl, "3.4s");
  check("flat out is clamped, not strobing", r.cyc_flat_out, "0.12s");
  /* within 1%: both the cycle and the duration are rounded before they reach
     the DOM, so at a short cycle the quantisation shows up in the ratio. 1%
     still catches the fault this guards against, which was a factor of 1.76. */
  check("the wheel/road ratio is speed-free",
    Math.abs(r.wheel_road_ratio[0] - r.wheel_road_ratio[1]) / r.wheel_road_ratio[0] < 0.01, true);
  check("and matches the rolling geometry",
    Math.abs(parseFloat(r.tier_fast_wheel) - r.wheel_expected_fast) < 0.06, true);
  /* a 0.86 reference at 40 km/h, driven at 42, so 0.86 * 40/42 */
  check("a pack can set its own reference", r.drive_cycle_override, "0.82s");
  check("speed replaces the parked timer", r.drive_drive.sub, "42 km/h");
  /* the field is in the car's display units, proven with the odometer, so
     nothing is converted; only the label follows the range sensor */
  check("no conversion, km/h labelled",    r.drive_drive.sub, "42 km/h");
  check("an imperial car says mph",        r.drive_speed_imperial, "42 mph");
  check("a stopped car keeps its status",  r.drive_no_speed, "Driving");
  check("drive_motion: off draws no road", r.drive_motion_off.lines, 0);
  check("drive_motion: off stills wheels", r.drive_motion_off.spinners, 0);
  check("an unmeasured pack gets none",    r.drive_unmeasured_pack, 0);
  check("a pack is found from image_side", r.pack_from_image_side.spinners, 6);
  check("and its road marking is on show", r.pack_from_image_side.lines, 1);

  console.log("\nthe running mode on the home view");
  check("nothing added when the mode is normal", r.home_normal, "Parked");
  check("Pet Mode is visible without opening Climate", r.home_dog, "Pet Mode \u00b7 Parked");
  check("Defrosting is visible too", r.home_defrost, "Defrosting \u00b7 Parked");

  console.log("\nthe editor");
  check("renders every car", r.editor_renders_all_cars, 3);
  check("emits the edit", r.editor_emits_edit, "Renamed");
  check("the edited field survives a config echo", r.editor_field_survives_echo, true);
  check("focus survives a config echo", r.editor_focus_survives_echo, true);
  check("rebuilds on a genuine YAML edit", r.editor_rebuilds_on_yaml_edit, 4);
  check("add car", r.editor_add_car, 4);
  check("remove car", r.editor_remove_car, 2);
  check("picking a paint clears a stale colour", r.paint_clears_stale_color, true);
  check("picking a paint is written", r.paint_is_written, "white");

  await browser.close();
  console.log("\n" + passed + " passed, " + failures.length + " failed");
  if (failures.length) { console.log("failed: " + failures.join(", ")); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
