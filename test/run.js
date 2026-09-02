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
