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
    /* The no-pack panel's suggested folder must carry the generation. The
       unqualified folder is served to BOTH generations, so sending a Juniper
       owner there would have them create the wrong-bodywork problem the panel
       exists to end. This panel always renders in a headless container, because
       the image probe cannot reach the pack CDN. */
    const packPanel = (model, vin, extra) => {
      const c = climModel(model, extra, vin);
      c._view = ""; c._built = false; c.hass = c._hass;
      const root = c.shadowRoot;
      const path = root.querySelector(".noPackPath");
      const cta = root.querySelector("a.packCta");
      return { path: path ? path.textContent.trim() : null,
               href: cta ? cta.getAttribute("href") : null };
    };
    R.pack_juniper = packPanel("Model Y", "LRWYHCEKXTC730074", { paint: "blue" });
    R.pack_classic = packPanel("Model Y", "LRWYHCEKXPC730074", { paint: "blue" });
    R.pack_unknown = packPanel("Model 3", "LRW3F7FS4PC762296", { paint: "blue" });
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

    /* ---- the preview strip --------------------------------------------- */
    /* The strip must be opt-in, must actually change what the overlays draw,
       and must NEVER call a service: it exists to look at states, not to put
       a real car into them. The v1.1.4 demo switch was deleted for being a
       hidden global; a test that only checked "the buttons exist" would have
       passed for that too. */
    const pvCard = (cfg) => {
      const st = customStates("p_");
      st["binary_sensor.p_online"] = { entity_id: "binary_sensor.p_online", state: "on", attributes: {} };
      st["device_tracker.p_location_tracker"] = { entity_id: "device_tracker.p_location_tracker",
        state: "not_home", attributes: { latitude: 1, longitude: 2 } };
      const c = document.createElement("tesla-fleet-card");
      document.body.appendChild(c);
      c.setConfig(Object.assign({ type: "custom:tesla-fleet-card", cars: [
        /* cable: "overlay" forces the DRAWN cable: a car with pack photos has
           its cable baked into the image, so #cableP would not exist at all
           and the cable assertions would read null rather than a colour. */
        { name: "P", model: "Model Y", paint: "red", prefix: "p_", image_side: "side.jpg",
          cable: "overlay", image: "topdown.jpg",
          wheels: { lift: 1.2, front: [106.9,77.9,15.65,10.99,109.3], rear: [187.9,45.8,0.9] } }
      ]}, cfg || {}));
      c.hass = { states: st };
      return c;
    };
    const pvClick = (c, k) => {
      const b = c.shadowRoot.querySelector('[data-pv="' + k + '"]');
      if (b) b.click();
      return !!b;
    };
    R.pv_absent_by_default = !!pvCard({}).shadowRoot.getElementById("pvw");
    (() => {
      const c = pvCard({ preview: true });
      R.pv_buttons = c.shadowRoot.querySelectorAll("[data-pv]").length;
      /* no service call may leave the card while previewing */
      let calls = 0;
      c.hass = Object.assign({}, c._hass, { callService: () => { calls++; return Promise.resolve(); } });
      c._built = false; c._build(); c._update();
      const road = () => {
        const o = c.shadowRoot.getElementById("driveOvl");
        return o ? o.style.display !== "none" : false;
      };
      /* Nick: "plugged in without power, the cable is blue... plugged in
         charging, the cable does the green animation". The animation is a
         permanent stroke-dashoffset animate element that only has anything to
         move when stroke-dasharray is set, which _update does ONLY when
         charging. So the dasharray IS the animation and must be asserted. */
      const cable = () => {
        const p = c.shadowRoot.getElementById("cableP");
        return p ? [p.style.display !== "none", p.getAttribute("stroke"),
                    p.getAttribute("stroke-dasharray") || ""] : null;
      };
      R.pv_parked_no_road = (pvClick(c, "parked"), road());
      R.pv_fast_road      = (pvClick(c, "fast"), road());
      /* the drawn cable lives in the TOP-DOWN view (_carImg), so switch to it
         before reading the cable: in the resting view #cableP does not exist
         and the assertion reads null rather than a colour. */
      const inCtl = (k) => {
        pvClick(c, k);
        c._view = "ctl"; c._built = false; c._build(); c._update();
        return cable();
      };
      R.pv_charging_cable = inCtl("charging");
      R.pv_plugged_cable  = inCtl("plugged");
      c._view = ""; c._built = false; c._build(); c._update();
      /* the speed on the status line must follow the preview too */
      pvClick(c, "slow");
      const sub = c.shadowRoot.getElementById("sub");
      R.pv_slow_sub = sub ? sub.textContent : null;
      /* back to Live: the fake must fall away completely */
      pvClick(c, "off");
      R.pv_off_clears = c._preview;
      R.pv_no_service_calls = calls;
    })();

    /* ---- lean packs: 4 files, the card draws the cable ------------------ */
    /* Seven files become four. The charging variants and topdown-plugged are
       generated by the overlay, so a request for one must resolve to the BASE
       render: with a configured images: base the old code returned a URL for a
       file that is not there, which renders as a broken image. side-plugged
       survives because the app swings the camera round when you plug in. */
    (() => {
      const c = document.createElement("tesla-fleet-card");
      document.body.appendChild(c);
      c.setConfig({ type: "custom:tesla-fleet-card", cars: [
        { name: "L", model: "Model Y", paint: "red", prefix: "l_",
          images: "/packs/y/red/app", cable: "overlay" }] });
      const st = customStates("l_");
      st["binary_sensor.l_online"] = { entity_id: "binary_sensor.l_online", state: "on", attributes: {} };
      c.hass = { states: st };
      R.lean_baked = c._cableBaked();
      R.lean_topdown_plugged = c._img("image_top_plugged");
      R.lean_topdown_charging = c._img("image_top_charging");
      R.lean_side_charging = c._img("image_charging");
      R.lean_side_plugged = c._img("image_side_plugged");
      R.lean_base = c._img("image");
    })();
    /* and a normal pack is unaffected: it still expects its cables baked in */
    (() => {
      const c = document.createElement("tesla-fleet-card");
      document.body.appendChild(c);
      c.setConfig({ type: "custom:tesla-fleet-card", cars: [
        { name: "B", model: "Model Y", paint: "red", prefix: "b_",
          images: "/packs/y/red/app" }] });
      const st = customStates("b_");
      st["binary_sensor.b_online"] = { entity_id: "binary_sensor.b_online", state: "on", attributes: {} };
      c.hass = { states: st };
      R.baked_baked = c._cableBaked();
      R.baked_topdown_plugged = c._img("image_top_plugged");
    })();

    /* ---- the map view -------------------------------------------------- */
    /* HA's Map dashboard is a strategy dashboard, so nothing can deep-link
       into it centred on one car. The card therefore builds HA's OWN map card
       with a single entity and a zoom. What matters in a test is the CONFIG we
       hand HA, because that is the whole feature, plus every fallback path:
       loadCardHelpers is semi-public and a car can have no coordinates. */
    const mapCar = (extra, at, cardCfg) => {
      const st = customStates("m_");
      st["binary_sensor.m_online"] = { entity_id: "binary_sensor.m_online",
        state: "on", attributes: {} };
      st["device_tracker.m_location_tracker"] = { entity_id: "device_tracker.m_location_tracker",
        state: "not_home", attributes: at === "none" ? {} : (at || { latitude: 53.3, longitude: -6.2 }) };
      const c = document.createElement("tesla-fleet-card");
      document.body.appendChild(c);
      c.setConfig(Object.assign({ type: "custom:tesla-fleet-card", cars: [Object.assign(
        { name: "M", model: "Model 3", paint: "grey", prefix: "m_" }, extra || {})] }, cardCfg || {}));
      c.hass = { states: st };
      return c;
    };
    const tapLoc = (c) => c.shadowRoot.getElementById("headLoc").click();

    /* no coordinates is a sentence, not an empty grey box */
    (() => {
      const c = mapCar(null, "none");
      tapLoc(c);
      const n = c.shadowRoot.querySelector(".mapNote");
      R.map_no_coords = n ? n.textContent.indexOf("not reporting coordinates") >= 0 : null;
    })();

    /* the old behaviour is still available, and must NOT change view */
    (() => {
      const c = mapCar({ location_tap: "more-info" });
      let fired = null;
      c.addEventListener("hass-more-info", (e) => { fired = e.detail.entityId; });
      tapLoc(c);
      R.map_optout_event = fired;
      R.map_optout_view = c._view;
    })();

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

    /* ---- the baked cable animates again -------------------------------
       v1.0.1 replaced the whole rest-view overlay with an early return for
       baked packs, which silently killed the green dashes that used to run
       along the photographed cable. Nick spotted it; nothing in the suite
       did. These are that gap. */
    (() => {
      const packCar = (extra) => Object.assign({
        name: "P", model: "Model Y", paint: "red", prefix: "p_", cable: "baked",
        image_side: "/local/x/models/y/red/app/side.jpg",
        image_side_plugged: "/local/x/models/y/red/app/side-plugged.jpg",
        image_charging: "/local/x/models/y/red/app/side-charging.jpg"
      }, extra || {});
      const mk = (car, st) => {
        const c = document.createElement("tesla-fleet-card");
        document.body.appendChild(c);
        c.setConfig({ type: "custom:tesla-fleet-card", cars: [car] });
        c.hass = st;
        return c;
      };
      const states = (charging, plugged) => ({ states: {
        "binary_sensor.p_online":   { entity_id: "binary_sensor.p_online", state: "on", attributes: {} },
        "binary_sensor.p_charger":  { entity_id: "binary_sensor.p_charger",
                                      state: plugged ? "on" : "off", attributes: {} },
        "binary_sensor.p_charging": { entity_id: "binary_sensor.p_charging",
                                      state: charging ? "on" : "off", attributes: {} }
      }});
      const dash = (c) => c.shadowRoot.getElementById("restCableDash");
      const ovl  = (c) => c.shadowRoot.getElementById("restChgOvl");

      let c = mk(packCar(), states(true, true));
      R.baked_dash_exists   = !!dash(c);
      R.baked_no_solidcable = !c.shadowRoot.getElementById("restCable");
      R.baked_no_glow       = !c.shadowRoot.getElementById("restGlow");
      R.baked_dash_animated = dash(c) ? dash(c).querySelectorAll("animate").length : 0;
      R.baked_dash_width    = dash(c) ? dash(c).getAttribute("stroke-width") : null;
      R.baked_dash_soft     = dash(c)
        ? (dash(c).getAttribute("filter") || "").indexOf("cableSoft") >= 0
          && parseFloat(dash(c).getAttribute("stroke-opacity")) < 0.8 : false;
      R.baked_path_is_pack  = dash(c)
        ? (dash(c).getAttribute("d").indexOf("M 74.8 93.3") === 0
           && dash(c).getAttribute("d").indexOf("132.8 47.8") > 0) : false;
      R.baked_ovl_charging  = ovl(c) ? ovl(c).style.display !== "none" : null;
      c.remove();

      c = mk(packCar(), states(false, true));
      R.baked_ovl_plugged_idle = ovl(c) ? ovl(c).style.display !== "none" : null;
      c.remove();
      c = mk(packCar(), states(false, false));
      R.baked_ovl_parked = ovl(c) ? ovl(c).style.display !== "none" : null;
      c.remove();

      /* a car whose photos match no shipped pack gets no invented curve */
      c = mk(packCar({ image_side: "/local/mine/side.jpg",
                       image_side_plugged: "/local/mine/side-plugged.jpg",
                       image_charging: "/local/mine/side-charging.jpg" }), states(true, true));
      R.baked_unknown_pack_no_dash = !c.shadowRoot.getElementById("restChgOvl");
      c.remove();

      /* an explicit cable_path wins over the pack's trace */
      c = mk(packCar({ cable_path: "M 1 2 C 3 4 5 6 7 8" }), states(true, true));
      R.baked_cable_path_override = dash(c) ? dash(c).getAttribute("d") : null;
      c.remove();

      /* the CLIMATE view must match the Controls view for a baked photo: a
         pulsing bolt at the port, no drawn cable. It used to draw a second
         cable at a default anchor calibrated for another pack. */
      const climOf = (car, st) => {
        const k = mk(car, st);
        const t = [...k.shadowRoot.querySelectorAll("*")]
          .find((e) => e.children.length === 0 && e.textContent.trim() === "Climate");
        if (t) t.click();
        return k;
      };
      c = climOf(Object.assign(packCar(), {
            image_climate: "/local/x/models/y/red/app/climate.jpg" }), states(true, true));
      R.clim_baked_has_bolt   = !!c.shadowRoot.getElementById("climBoltPulse");
      R.clim_baked_no_cable   = !c.shadowRoot.getElementById("climCable");
      R.clim_baked_no_dash    = !c.shadowRoot.getElementById("climCableDash");
      R.clim_bolt_animated    = (() => {
        const g = c.shadowRoot.getElementById("climBoltPulse");
        return g ? g.querySelectorAll("animate, animateTransform").length : 0; })();
      R.clim_bolt_charging    = (() => {
        const g = c.shadowRoot.getElementById("climBoltPulse");
        return g ? g.style.display !== "none" : null; })();
      c.remove();
      c = climOf(Object.assign(packCar(), {
            image_climate: "/local/x/models/y/red/app/climate.jpg" }), states(false, true));
      R.clim_bolt_plugged_idle = (() => {
        const g = c.shadowRoot.getElementById("climBoltPulse");
        return g ? g.style.display !== "none" : null; })();
      c.remove();

      /* a car with no pack photos still gets the drawn cable */
      c = climOf({ name: "N", model: "Model 3", paint: "grey", prefix: "p_" }, states(true, true));
      R.clim_unbaked_keeps_cable = !!c.shadowRoot.getElementById("climCable");
      c.remove();

      /* the climate port comes from the PACK, not from per-car config. The card
         default was calibrated against one pack and put the bolt in open air on
         every other one. */
      const boltAt = (k) => {
        const g = k.shadowRoot.getElementById("climBoltPulse");
        return g ? g.getAttribute("transform") : null;
      };
      c = climOf(Object.assign(packCar(), {
            image_climate: "/local/x/models/y/red/app/climate.jpg" }), states(true, true));
      R.clim_port_yred = boltAt(c); c.remove();
      c = climOf({ name: "G", model: "Model 3", paint: "grey", prefix: "p_", cable: "baked",
                   image_climate: "/local/x/models/3/grey/app/climate.jpg" }, states(true, true));
      R.clim_port_3grey = boltAt(c); c.remove();
      /* an unrecognised pack falls back to the card default rather than guessing */
      c = climOf({ name: "U", model: "Model 3", paint: "grey", prefix: "p_", cable: "baked",
                   image_climate: "/local/mine/climate.jpg" }, states(true, true));
      R.clim_port_unknown = boltAt(c); c.remove();
      c = climOf({ name: "WY", model: "Model Y", paint: "white", prefix: "p_", cable: "baked",
                   image_climate: "/local/x/models/y/white/app/climate.jpg" }, states(true, true));
      R.clim_port_ywhite = boltAt(c); c.remove();
      /* every shipped pack must have BOTH a cable path and a climate port: a pack
         with one and not the other is how the white Y shipped half-done. */
      c = mk({ name: "WY2", model: "Model Y", paint: "white", prefix: "p_", cable: "baked",
               image_charging: "/local/x/models/y/white/app/side-charging.jpg",
               image_side_plugged: "/local/x/models/y/white/app/side-plugged.jpg",
               image_side: "/local/x/models/y/white/app/side.jpg" }, states(true, true));
      R.ywhite_has_dash = !!dash(c);
      c.remove();
      /* per-car config still wins, which is how an unpublished pack is handled */
      c = climOf(Object.assign(packCar(), {
            image_climate: "/local/x/models/y/red/app/climate.jpg",
            climate_anchors: { port: [11, 22] } }), states(true, true));
      R.clim_port_override = boltAt(c); c.remove();

      /* the Model 3 pack's cable path is its own, not the Model Y's */
      c = mk({ name: "G2", model: "Model 3", paint: "grey", prefix: "p_", cable: "baked",
               image_charging: "/local/x/models/3/grey/app/side-charging.jpg",
               image_side_plugged: "/local/x/models/3/grey/app/side-plugged.jpg",
               image_side: "/local/x/models/3/grey/app/side.jpg" }, states(true, true));
      R.m3_path_is_own = dash(c) ? dash(c).getAttribute("d").indexOf("M 63.2 96.5") === 0 : false;
      R.m3_path_not_ymodel = dash(c) ? dash(c).getAttribute("d").indexOf("M 74.8") !== 0 : false;
      c.remove();
    })();

    /* ---- detected vs configured ---------------------------------------
       Buddy really was configured as a Model Y for weeks. His VIN says
       Model 3 at position 4, and nothing in the editor said otherwise, so
       the mislabel only surfaced when somebody read the VIN by hand. These
       cases are that bug: the panel must state what the car says about
       itself, and must call a disagreement a disagreement. */
    const vinState = (prefix, vin) => {
      const st = {};
      st["binary_sensor." + prefix + "online"] = {
        entity_id: "binary_sensor." + prefix + "online", state: "on", attributes: { vin: vin }
      };
      return st;
    };
    const BUDDY = "LRW3F7FS5RC043917";   /* 2024 Model 3  -> Highland */
    const PATSY = "LRWYHCEKXPC730074";   /* 2023 Model Y  -> classic  */
    const T2    = "XP7YHCER3TB884184";   /* 2026 Model Y  -> Juniper  */
    const edCfg = (car) => ({ type: "custom:tesla-fleet-card", cars: [car] });
    const hint = () => ed.shadowRoot.querySelector(".car .hint").textContent;
    const warned = () => !!ed.shadowRoot.querySelector(".car .hint.warn");

    /* the mislabel: config says Model Y, the VIN says Model 3 */
    ed.hass = { states: vinState("buddy_", BUDDY) };
    ed.setConfig(edCfg({ name: "Buddy", model: "Model Y", paint: "blue", prefix: "buddy_" }));
    R.det_conflict_warns = warned();
    R.det_conflict_names_vin_model = hint().indexOf("VIN says Model 3") >= 0;
    R.det_conflict_names_config = hint().indexOf("set to Model Y") >= 0;

    /* corrected: no warning, and it says so */
    ed.setConfig(edCfg({ name: "Buddy", model: "Model 3", paint: "blue", prefix: "buddy_" }));
    R.det_agree_no_warn = warned();
    R.det_agree_says_matches = hint().indexOf("matches") >= 0;
    R.det_agree_shows_year = hint().indexOf("2024") >= 0;

    /* the detection itself, across all three real cars */
    ed.setConfig(edCfg({ name: "B", model: "Model 3", prefix: "buddy_" }));
    R.det_buddy = ed._detected(ed._config.cars[0]);
    ed.hass = { states: vinState("patsy_", PATSY) };
    ed.setConfig(edCfg({ name: "P", model: "Model Y", prefix: "patsy_" }));
    R.det_patsy = ed._detected(ed._config.cars[0]);
    ed.hass = { states: vinState("t2_", T2) };
    ed.setConfig(edCfg({ name: "T", model: "Model Y", prefix: "t2_" }));
    R.det_t2 = ed._detected(ed._config.cars[0]);

    /* "modely" and "Model Y" must not read as a disagreement */
    R.det_case_insensitive = ((c) => {
      ed.setConfig(edCfg({ name: "T", model: "modely", prefix: "t2_" }));
      return ed._detected(ed._config.cars[0]).conflict;
    })();

    /* no VIN is not an error, and must not claim a detection */
    ed.hass = { states: {} };
    ed.setConfig(edCfg({ name: "N", model: "Model 3", prefix: "nope_" }));
    R.det_no_vin = ed._detected(ed._config.cars[0]);
    R.det_no_vin_hint = hint().indexOf("No VIN yet") >= 0;

    /* the re-render guard has to notice a VIN arriving after the panel opened */
    ed.hass = { states: {} };
    ed.setConfig(edCfg({ name: "Buddy", model: "Model Y", prefix: "buddy_" }));
    R.det_before_vin_warns = warned();
    ed.hass = { states: vinState("buddy_", BUDDY) };
    R.det_after_vin_warns = warned();

    /* issue #1: "+ Add car" used to write a hard-coded blue that shadowed the
       paint picker for good. Picking a paint must clear any stale colour. */
    ed.setConfig({ type: "custom:tesla-fleet-card",
      cars: [{ name: "L", model: "Model Y", paint: "red", prefix: "l_", color: "#1e90ff" }] });
    const ps = ed.shadowRoot.querySelector('[data-k="paint"]');
    ps.value = "white";
    ps.dispatchEvent(new Event("change"));
    R.paint_clears_stale_color = emitted.cars[0].color === undefined;
    R.paint_is_written = emitted.cars[0].paint;

    /* ---- the Generation field appears only where it is needed ---------- */
    const onlineWithVin = (p, vin) => {
      const st = {};
      st["binary_sensor." + p + "online"] = { entity_id: "binary_sensor." + p + "online",
        state: "on", attributes: { vin: vin } };
      return st;
    };
    const genField = (car, vin) => {
      ed._rendered = false;
      ed.hass = { states: onlineWithVin(car.prefix, vin) };
      ed.setConfig({ type: "custom:tesla-fleet-card", cars: [car] });
      const sel = ed.shadowRoot.querySelector('[data-k="generation"]');
      return sel ? [...sel.options].map((o) => o.value) : null;
    };
    /* a 2023 Model 3 is the one case the year cannot settle, so ask */
    R.gen_field_ambiguous = genField(
      { name: "A", model: "Model 3", paint: "grey", prefix: "a_" }, "LRW3F7FS4PC762296");
    /* a 2024 Model 3 decides itself, so do not clutter it */
    R.gen_field_decided = genField(
      { name: "B", model: "Model 3", paint: "grey", prefix: "b_" }, "LRW3F7FS5RC043917");
    /* a Model Y is never ambiguous, whatever the year */
    R.gen_field_modely = genField(
      { name: "C", model: "Model Y", paint: "red", prefix: "c_" }, "LRWYHCEKXPC730074");
    /* no VIN means no year, which is not a question the user can be asked
       usefully, so stay quiet and leave `generation` to YAML */
    (() => {
      ed._rendered = false;
      ed.hass = { states: {} };
      ed.setConfig({ type: "custom:tesla-fleet-card",
        cars: [{ name: "D", model: "Model 3", paint: "grey", prefix: "d_" }] });
      R.gen_field_no_vin = !!ed.shadowRoot.querySelector('[data-k="generation"]');
    })();
    /* an answered car keeps the field, or the control vanishes under the hand
       that just used it */
    (() => {
      ed._rendered = false;
      ed.hass = { states: onlineWithVin("e_", "LRW3F7FS5RC043917") };
      ed.setConfig({ type: "custom:tesla-fleet-card",
        cars: [{ name: "E", model: "Model 3", paint: "grey", prefix: "e_",
                 generation: "classic" }] });
      const sel = ed.shadowRoot.querySelector('[data-k="generation"]');
      R.gen_field_sticks = !!sel;
      R.gen_field_selected = sel ? sel.value : null;
      if (sel) { sel.value = ""; sel.dispatchEvent(new Event("change")); }
      R.gen_cleared_removes_key = emitted.cars[0].generation === undefined;
    })();

    return R;
  }, customStates.toString());

  /* ---- the card refuses to borrow the other generation's bodywork -------
     This one needs the real probe, so `fetch` is stubbed to answer HEAD for
     one pack folder and 404 for everything else. That is exactly the situation
     on GitHub raw today: models/3/grey/app exists and is the Highland pack,
     and no models/3-classic/grey/app exists yet. */
  Object.assign(r, await page.evaluate(async (customStatesSrc) => {
    const customStates = eval("(" + customStatesSrc + ")");
    const R = {};
    const realFetch = window.fetch;
    const serveOnly = (needle) => {
      window.fetch = (url) => Promise.resolve({ ok: String(url).indexOf(needle) >= 0 });
    };
    const render = async (car, vin) => {
      const c = document.createElement("tesla-fleet-card");
      document.body.appendChild(c);
      c.setConfig({ type: "custom:tesla-fleet-card", cars: [car] });
      const st = customStates(car.prefix);
      st["binary_sensor." + car.prefix + "online"] = {
        entity_id: "binary_sensor." + car.prefix + "online",
        state: "on", attributes: { vin: vin } };
      c.hass = { states: st };
      await new Promise((z) => setTimeout(z, 120));
      return !!c.shadowRoot.getElementById("restImg");
    };
    const M3 = { model: "Model 3", paint: "grey" };
    const HIGHLAND = "LRW3F7FS5RC043917";   /* 2024 */
    const CLASSIC = "LRW3F7FR3NC609256";    /* 2022 */

    serveOnly("raw.githubusercontent.com/MrNickIE/tesla-fleet-homeassistant/main/images/models/3/grey/app/");
    /* the Highland pack is the right car for a Highland, so use it */
    R.pack_highland_gets_pack = await render(
      Object.assign({ name: "H", prefix: "h_" }, M3), HIGHLAND);
    /* and it is a photograph of the wrong car for a pre-refresh one */
    R.pack_classic_refuses = await render(
      Object.assign({ name: "K", prefix: "k_" }, M3), CLASSIC);
    /* unless the owner would rather have the wrong bodywork than no picture */
    R.pack_classic_opt_in = await render(
      Object.assign({ name: "O", prefix: "o_", allow_other_generation: true }, M3), CLASSIC);

    /* a pack of the user's OWN at the same path has no recorded generation, so
       the card has no business refusing it */
    serveOnly("/local/tesla-fleet-card/images/models/3/grey/app/");
    R.pack_local_not_judged = await render(
      Object.assign({ name: "L", prefix: "l_" }, M3), CLASSIC);

    /* THE ONE THAT MATTERS, and the one v1.1.6 shipped broken. _probeImages
       runs over EVERY car in the config, so every helper it calls must be
       given the car it is judging. It called this._generation(), which reads
       the SELECTED car, so five cars were judged by the sixth and the refusal
       did nothing at all on any real multi-car card. A single-car fixture
       cannot see this: this._car and the car being probed are the same object.
       So this fixture has two cars, and asks about the one NOT selected. */
    serveOnly("raw.githubusercontent.com/MrNickIE/tesla-fleet-homeassistant/main/images/models/3/grey/app/");
    (() => {
      const mk = () => {
        const c = document.createElement("tesla-fleet-card");
        document.body.appendChild(c);
        c.setConfig({ type: "custom:tesla-fleet-card", cars: [
          { name: "Newer", model: "Model 3", paint: "grey", prefix: "n_", generation: "highland" },
          { name: "Older", model: "Model 3", paint: "grey", prefix: "p_", generation: "classic" }] });
        const st = Object.assign(customStates("n_"), customStates("p_"));
        c.hass = { states: st };
        return [c, st];
      };
      window.__multi = mk;
    })();
    /* A renamed pack folder must keep its measured geometry. The numbers were
       measured from the PHOTOGRAPHS, so `models/3-highland/grey/app` and the
       historical `models/3/grey/app` are the same photo set and must resolve
       to the same wheels and the same road. Renaming a local pack folder to
       say which generation it holds is exactly what silently stopped the
       wheels turning after v1.1.7 shipped. */
    const geomFor = (base) => {
      const c = document.createElement("tesla-fleet-card");
      document.body.appendChild(c);
      c.setConfig({ type: "custom:tesla-fleet-card", cars: [
        { name: "G", model: "Model 3", paint: "grey", prefix: "g_",
          image_side: base + "/side.jpg", images: base }] });
      const st = customStates("g_");
      st["binary_sensor.g_online"] = { entity_id: "binary_sensor.g_online",
        state: "on", attributes: {} };
      st["sensor.g_shift_state"] = { entity_id: "sensor.g_shift_state", state: "D", attributes: {} };
      st["device_tracker.g_location_tracker"] = { entity_id: "device_tracker.g_location_tracker",
        state: "not_home", attributes: { latitude: 1, longitude: 2, speed: 40 } };
      c.hass = { states: st };
      const o = c.shadowRoot.getElementById("driveOvl");
      return {
        clips: o ? o.querySelectorAll("clipPath[id^=dwC] ellipse").length : 0,
        spinners: o ? o.querySelectorAll("animateTransform").length : 0,
        roadY: o && o.querySelector("line") ? o.querySelector("line").getAttribute("y1") : null
      };
    };
    R.geom_canonical = geomFor("/local/x/images/models/3/grey/app");
    R.geom_qualified = geomFor("/local/x/images/models/3-highland/grey/app");

    /* ---- the two Model Y Juniper packs are one pack in two colours ------
       White and blue are the same Tesla app render wearing different paint.
       Until 2026-09-03 the white pack's three side photos had been cropped
       independently -- the car came out 506, 470 and 542 pixels wide across
       two canvas heights -- so no single cable path or wheel ellipse could
       sit on all three, and the car visibly changed size when it started
       charging. They were re-framed onto the blue pack's canvas, and from
       that point the two packs must resolve to the SAME cable, the SAME
       wheels and the SAME road.

       That is what these check. If they ever disagree again, one of the two
       image sets has been re-cropped without its measurements being redone,
       which is precisely the failure they exist to catch -- and the failure
       that shipped unnoticed for three versions. */
    const junDash = (dir) => {
      const c = document.createElement("tesla-fleet-card");
      document.body.appendChild(c);
      c.setConfig({ type: "custom:tesla-fleet-card", cars: [{
        name: "J", model: "Model Y", paint: "white", prefix: "p_", cable: "baked",
        image_side:         "/local/x/images/" + dir + "/side.jpg",
        image_side_plugged: "/local/x/images/" + dir + "/side-plugged.jpg",
        image_charging:     "/local/x/images/" + dir + "/side-charging.jpg" }] });
      c.hass = { states: {
        "binary_sensor.p_online":   { entity_id: "binary_sensor.p_online",   state: "on", attributes: {} },
        "binary_sensor.p_charger":  { entity_id: "binary_sensor.p_charger",  state: "on", attributes: {} },
        "binary_sensor.p_charging": { entity_id: "binary_sensor.p_charging", state: "on", attributes: {} } } };
      const d = c.shadowRoot.getElementById("restCableDash");
      const out = d ? d.getAttribute("d") : null;
      c.remove();
      return out;
    };
    R.jun_white_cable    = junDash("models/y/white/app");
    R.jun_blue_cable     = junDash("models/y-juniper/blue/app");
    R.jun_blue_has_cable = !!R.jun_blue_cable;
    /* the blue pack's folder already says "juniper", so deriving a
       generation-qualified alias from it produced models/y-juniper-juniper,
       a folder that exists nowhere. No alias should be minted for it. */
    R.jun_no_double_alias = junDash("models/y-juniper-juniper/blue/app") === null;
    R.jun_white_geom = geomFor("/local/x/images/models/y/white/app");
    R.jun_blue_geom  = geomFor("/local/x/images/models/y-juniper/blue/app");
    /* the road is measured, not defaulted: a Juniper pack that fell through
       to ROAD_DEFAULT would put its marking at the clamp, y = 105 */
    R.jun_road_measured = R.jun_blue_geom.roadY !== null
                          && Math.abs(parseFloat(R.jun_blue_geom.roadY) - 105) > 1;

    R.pack_multi_car = await (async () => {
      const [c, st] = window.__multi();
      await new Promise((z) => setTimeout(z, 150));
      /* car 0 selected and Highland: it should have the pack */
      const first = !!c.shadowRoot.getElementById("restImg");
      /* switch to the pre-refresh car: its own generation must decide, not
         the one that happened to be on screen while probing ran */
      c._sel = 1; c._built = false; c.hass = { states: st };
      await new Promise((z) => setTimeout(z, 150));
      const second = !!c.shadowRoot.getElementById("restImg");
      return [first, second];
    })();

    window.fetch = realFetch;

    /* THE MAP CONFIG. This lives in the async block because loadCardHelpers()
       returns a promise: the same fixture in the synchronous block silently
       recorded undefined for every assertion, which reads as five broken
       features rather than one un-awaited promise. */
    const realHelpers = window.loadCardHelpers;
    let seen = null, fed = 0;
    window.loadCardHelpers = () => Promise.resolve({
      createCardElement: (cfg) => {
        seen = cfg;
        const el = document.createElement("div");
        el.className = "fakeMap";
        Object.defineProperty(el, "hass", { set() { fed++; }, configurable: true });
        return el;
      }
    });
    const mc = document.createElement("tesla-fleet-card");
    document.body.appendChild(mc);
    mc.setConfig({ type: "custom:tesla-fleet-card", map_zoom: 17, cars: [
      { name: "M", model: "Model 3", paint: "grey", prefix: "m_" }] });
    const mst = customStates("m_");
    mst["binary_sensor.m_online"] = { entity_id: "binary_sensor.m_online", state: "on", attributes: {} };
    mst["device_tracker.m_location_tracker"] = { entity_id: "device_tracker.m_location_tracker",
      state: "not_home", attributes: { latitude: 53.3, longitude: -6.2 } };
    mc.hass = { states: mst };
    mc.shadowRoot.getElementById("headLoc").click();
    R.map_view_opened = mc._view;
    await new Promise((z) => setTimeout(z, 80));
    R.map_cfg = seen;
    R.map_mounted = !!mc.shadowRoot.querySelector(".fakeMap");
    mc.hass = { states: mst };            /* a live card must keep getting hass */
    R.map_fed_hass = fed > 1;
    R.map_hides_rows = (() => {
      const card = mc.shadowRoot.querySelector("ha-card");
      return card ? card.classList.contains("mapMode") : null;
    })();
    /* the bare chevron vanished into the map tiles, and the map is draggable so
       it cannot double as a way out: the map view's back control must be
       labelled, not just present */
    R.map_has_back = (() => {
      const b = mc.shadowRoot.getElementById("ctlBack");
      if (!b) return null;
      /* and it must sit in the BOTTOM half: the map card's own zoom controls
         are top left and the pill landed on them. Asserted by rectangle, not
         by getComputedStyle().top === "auto": on a positioned element the
         computed value resolves to used pixels, so that reads "0px" whether
         the override worked or not, and would have passed on the broken
         version. */
      const bb = b.getBoundingClientRect();
      const box = mc.shadowRoot.getElementById("mapBox").getBoundingClientRect();
      return [b.classList.contains("mapBack"),
              b.textContent.replace(/[^A-Za-z]/g, ""),
              box.height > 0 && bb.top - box.top > box.height / 2];
    })();
    /* leaving the view must let the nested card go */
    mc._setView("");
    R.map_released = !mc._mapEl;
    window.loadCardHelpers = realHelpers;

    return R;
  }, customStates.toString()));

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
  check("a Juniper is sent to the Juniper folder",
    r.pack_juniper.path, "images/models/y-juniper/blue/app/");
  check("a pre-refresh car is sent to its own folder",
    r.pack_classic.path, "images/models/y-classic/blue/app/");
  /* A 2023 Model 3 could be either car, so there is no generation to qualify
     with. The unqualified folder is the honest answer, not a guessed one. */
  check("an unknown generation is not guessed at",
    r.pack_unknown.path, "images/models/3/blue/app/");
  check("the contribute link lands on the instructions",
    String(r.pack_juniper.href).indexOf("#contributing-an-image-pack") > 0, true);
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

  console.log("\nlean packs (4 files, drawn cable)");
  check("a lean pack is not baked",         r.lean_baked, false);
  check("topdown-plugged falls back to the base render",
    r.lean_topdown_plugged, r.lean_base);
  check("topdown-charging falls back too",  r.lean_topdown_charging, r.lean_base);
  /* side-charging must NOT fall back: it stays its own file, because the side
     view has no render with the port open and no cable to draw into, so a
     fallback would show charging with a baked blue cable */
  check("side-charging stays its own file",
    r.lean_side_charging, "/packs/y/red/app/side-charging.jpg");
  check("side-plugged is still its own file",
    r.lean_side_plugged, "/packs/y/red/app/side-plugged.jpg");
  check("a normal pack is still baked",     r.baked_baked, true);
  check("and still uses its own topdown-plugged",
    r.baked_topdown_plugged, "/packs/y/red/app/topdown-plugged.jpg");

  console.log("\nthe preview strip");
  check("absent unless preview: true",   r.pv_absent_by_default, false);
  check("one button per state",          r.pv_buttons, 10);
  check("Parked draws no road",          r.pv_parked_no_road, false);
  check("100 km/h draws the road",       r.pv_fast_road, true);
  check("charging: green AND animated (dashed)",
    r.pv_charging_cable, [true, "#4fd07a", "10 8"]);
  check("plugged, no power: blue and static",
    r.pv_plugged_cable, [true, "#4a9eff", ""]);
  check("the faked speed reaches the status line",
    r.pv_slow_sub.indexOf("20") >= 0, true);
  check("Live clears the fake",          r.pv_off_clears, null);
  check("previewing sends no commands",  r.pv_no_service_calls, 0);

  console.log("\nthe map view");
  check("tapping Location opens the map",  r.map_view_opened, "map");
  check("leaving it releases the map card", r.map_released, true);
  check("HA's own map card is mounted",    r.map_mounted, true);
  check("one entity, and the configured zoom",
    [r.map_cfg && r.map_cfg.type, r.map_cfg && r.map_cfg.entities, r.map_cfg && r.map_cfg.default_zoom],
    ["map", ["device_tracker.m_location_tracker"], 17]);
  check("the map keeps receiving hass",    r.map_fed_hass, true);
  check("the map view hides the rows",     r.map_hides_rows, true);
  check("the back control is a labelled pill, bottom left",
    r.map_has_back, [true, "Back", true]);
  check("no coordinates says so plainly",  r.map_no_coords, true);
  check("location_tap more-info still opens the dialog",
    r.map_optout_event, "device_tracker.m_location_tracker");
  check("and does not change view",        r.map_optout_view, "");

  console.log("\nthe editor");
  check("renders every car", r.editor_renders_all_cars, 3);
  check("emits the edit", r.editor_emits_edit, "Renamed");
  check("the edited field survives a config echo", r.editor_field_survives_echo, true);
  check("focus survives a config echo", r.editor_focus_survives_echo, true);
  check("rebuilds on a genuine YAML edit", r.editor_rebuilds_on_yaml_edit, 4);
  check("add car", r.editor_add_car, 4);
  check("remove car", r.editor_remove_car, 2);

  console.log("\nthe baked cable animates again");
  check("the dashes exist on a baked pack", r.baked_dash_exists, true);
  check("no second cable is drawn", r.baked_no_solidcable, true);
  check("no glow is drawn", r.baked_no_glow, true);
  check("the dashes are animated", r.baked_dash_animated, 1);
  check("thinner stroke over a photo", r.baked_dash_width, "1.05");
  check("the dashes are softened, not a hard line", r.baked_dash_soft, true);
  check("it uses the pack's traced path", r.baked_path_is_pack, true);
  check("shown while charging", r.baked_ovl_charging, true);
  check("hidden when plugged but idle", r.baked_ovl_plugged_idle, false);
  check("hidden when parked", r.baked_ovl_parked, false);
  check("an unknown pack gets no invented curve", r.baked_unknown_pack_no_dash, true);
  check("cable_path overrides the pack", r.baked_cable_path_override, "M 1 2 C 3 4 5 6 7 8");

  console.log("\nthe climate view matches the Controls view");
  check("a baked photo gets the pulsing bolt", r.clim_baked_has_bolt, true);
  check("no second cable is drawn", r.clim_baked_no_cable, true);
  check("no travelling dashes either", r.clim_baked_no_dash, true);
  check("the bolt is animated", r.clim_bolt_animated, 2);
  check("shown while charging", r.clim_bolt_charging, true);
  check("hidden when plugged but idle", r.clim_bolt_plugged_idle, false);
  check("a car with no pack keeps its drawn cable", r.clim_unbaked_keeps_cable, true);
  check("y/red climate port from the pack", r.clim_port_yred, "translate(44 501)");
  check("3/grey climate port from the pack", r.clim_port_3grey, "translate(61 461)");
  check("an unknown pack falls back to the default", r.clim_port_unknown, "translate(78 478)");
  check("y/white climate port from the pack", r.clim_port_ywhite, "translate(56 477)");
  check("y/white now has a cable path too", r.ywhite_has_dash, true);
  check("per-car config still wins", r.clim_port_override, "translate(11 22)");
  check("the Model 3 has its own cable path", r.m3_path_is_own, true);
  check("and it is not the Model Y's", r.m3_path_not_ymodel, true);

  console.log("\nwhat the car says about itself");
  check("a wrong model is flagged", r.det_conflict_warns, true);
  check("the flag names the VIN's model", r.det_conflict_names_vin_model, true);
  check("the flag names the configured model", r.det_conflict_names_config, true);
  check("a correct model is not flagged", r.det_agree_no_warn, false);
  check("a correct model says so", r.det_agree_says_matches, true);
  check("the detected year is shown", r.det_agree_shows_year, true);
  check("Buddy: 2024 Model 3, Highland", r.det_buddy,
        { vin: "LRW3F7FS5RC043917", year: 2024, model: "Model 3", gen: "highland", conflict: false });
  check("Patsy: 2023 Model Y, classic", r.det_patsy,
        { vin: "LRWYHCEKXPC730074", year: 2023, model: "Model Y", gen: "classic", conflict: false });
  check("T2: 2026 Model Y, Juniper", r.det_t2,
        { vin: "XP7YHCER3TB884184", year: 2026, model: "Model Y", gen: "juniper", conflict: false });
  check("\"modely\" is not a disagreement", r.det_case_insensitive, false);
  check("no VIN detects nothing", r.det_no_vin, null);
  check("no VIN says so plainly", r.det_no_vin_hint, true);
  check("no warning before the VIN arrives", r.det_before_vin_warns, false);
  check("the warning appears when it does", r.det_after_vin_warns, true);
  check("picking a paint clears a stale colour", r.paint_clears_stale_color, true);
  check("picking a paint is written", r.paint_is_written, "white");

  console.log("\nthe wrong generation is refused");
  check("a Highland gets the Highland pack",   r.pack_highland_gets_pack, true);
  check("a pre-refresh car refuses it",        r.pack_classic_refuses, false);
  check("allow_other_generation opts back in", r.pack_classic_opt_in, true);
  check("a local pack is not judged",          r.pack_local_not_judged, true);
  /* [selected Highland keeps its pack, the other car still refuses]. v1.1.6
     returned [true, true]: every car was judged by whichever was on screen. */
  check("each car is judged on its own generation", r.pack_multi_car, [true, false]);
  /* the measurements follow the photographs, not the folder name */
  check("a renamed pack keeps its wheels",
    [r.geom_qualified.clips > 0, r.geom_qualified.spinners > 0], [true, true]);
  check("a renamed pack has the same geometry",
    r.geom_qualified, r.geom_canonical);

  console.log("\nthe two Model Y Juniper packs are one pack in two colours");
  check("the blue Juniper pack ships",        r.jun_blue_has_cable, true);
  check("both Junipers use one cable path",   r.jun_white_cable, r.jun_blue_cable);
  check("both Junipers use one set of wheels",
    [r.jun_blue_geom.clips, r.jun_blue_geom.spinners],
    [r.jun_white_geom.clips, r.jun_white_geom.spinners]);
  check("both Junipers use one road",         r.jun_blue_geom.roadY, r.jun_white_geom.roadY);
  check("the Juniper road is measured",       r.jun_road_measured, true);
  check("no models/y-juniper-juniper alias",  r.jun_no_double_alias, true);

  console.log("\nthe Generation field");
  check("a 2023 Model 3 is asked",         r.gen_field_ambiguous, ["", "highland", "classic"]);
  check("a 2024 Model 3 is not asked",     r.gen_field_decided, null);
  check("a Model Y is not asked",          r.gen_field_modely, null);
  check("no VIN means no question",        r.gen_field_no_vin, false);
  check("an answered car keeps the field", r.gen_field_sticks, true);
  check("the answer is shown as selected", r.gen_field_selected, "classic");
  check("clearing it removes the key",     r.gen_cleared_removes_key, true);

  await browser.close();
  console.log("\n" + passed + " passed, " + failures.length + " failed");
  if (failures.length) { console.log("failed: " + failures.join(", ")); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
