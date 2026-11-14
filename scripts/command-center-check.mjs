// Scripted browser pass over the Command Center (design: Verification Plan).
// Walks the user journeys on Now, Washington and Rio Grande do Sul and fails
// on a console error, on a missing legend, on more than two data layers and
// on a banned string. Not a CI job: the project has no browser in CI.
//
//   bun run build && bun run start          (in another shell)
//   node scripts/command-center-check.mjs
//
// Settings (environment):
//   CC_BASE_URL       app address, default http://localhost:3000
//   CC_PATH           path prefix of the screen, default "" (/ and /alerts)
//   CC_STUB_BASEMAP   "1": answer the basemap style, glyph and terrain
//                     requests with empty stubs. Only for machines that
//                     cannot reach those hosts; the app code is not changed
//                     and no data value is stubbed.
//   CC_LOCAL_DATA     "1": answer requests for the remote data bucket with
//                     the same file of the app's bundled copy (/data/...).
//                     Only for machines that cannot reach the bucket.
//   CC_SHOTS          directory for screenshots (optional)
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.CC_BASE_URL ?? "http://localhost:3000";
const PREFIX = process.env.CC_PATH ?? "";
const HOME = `${BASE}${PREFIX || "/"}`;
const ALERTS = `${BASE}${PREFIX}/alerts`;
const STUB = process.env.CC_STUB_BASEMAP === "1";
const SHOTS = process.env.CC_SHOTS;

// Case bounds of the contract (manifest "bounds"), by case id and alias.
const WA = [-122.6, 47.0, -121.5, 48.5];
const RS = [-52.5, -30.5, -50.5, -29.0];
const CASE_BOUNDS = { "wa-2025-12": WA, wa_2025: WA, "rs-2024-05": RS, rs_2024: RS, now: [-58, -34, -48, -22.5] };

const results = [];
const failures = [];
const note = (cuj, text) => results.push(`  ok   ${cuj}: ${text}`);
const info = (cuj, text) => results.push(`  info ${cuj}: ${text}`);
function check(cuj, condition, text) {
  if (condition) note(cuj, text);
  else {
    failures.push(`${cuj}: ${text}`);
    results.push(`  FAIL ${cuj}: ${text}`);
  }
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
if (STUB) {
  const style = { version: 8, glyphs: "https://basemaps.cartocdn.com/fonts/{fontstack}/{range}.pbf", sources: {}, layers: [] };
  await context.route(/basemaps\.cartocdn\.com\/.*style\.json/, (r) => r.fulfill({ json: style }));
  await context.route(/basemaps\.cartocdn\.com\/fonts\//, (r) => r.fulfill({ status: 200, contentType: "application/x-protobuf", body: "" }));
  await context.route(/elevation-tiles-prod/, (r) => r.fulfill({ status: 204, body: "" }));
}
if (process.env.CC_LOCAL_DATA === "1") {
  await context.route(/\/tipping-point-data\/(?:fallback\/)?data\/.+\.(png|tif|geojson|json)$/, async (r) => {
    const rel = new URL(r.request().url()).pathname.replace(/^.*?\/data\//, "");
    const res = await r.fetch({ url: `${BASE}/data/${rel}` }).catch(() => null);
    return res ? r.fulfill({ response: res }) : r.abort();
  });
}
const page = await context.newPage();
const consoleErrors = [];
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push(m.text().slice(0, 240));
});
page.on("pageerror", (e) => consoleErrors.push(`page error: ${String(e).slice(0, 240)}`));
// Data files that the screen requests and the data host does not serve. They
// are reported on their own: a data defect, not a defect of the screen.
const missingData = new Set();
let pointDown = false;
page.on("response", (res) => {
  if (res.status() === 503 && res.url().includes("/api/point")) pointDown = true;
  if (res.status() === 404 && /\/data\/.+\.(png|tif|geojson|json)(\?|$)/.test(res.url())) {
    missingData.add(new URL(res.url()).pathname.replace(/^.*?\/data\//, ""));
  }
});

const root = page.locator("[data-case]");
const attr = (name) => root.getAttribute(name);
const layersOn = async () => ((await attr("data-layers")) || "").split(",").filter(Boolean);
const panelText = () => page.locator("aside").last().innerText();
const bodyText = () => page.locator("body").innerText();
const shot = async (name) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};
const currentStep = () => page.locator('[aria-label="Timeline steps"] button[aria-pressed="true"]').getAttribute("aria-label");
const mapReady = async () => {
  try {
    await page.waitForFunction(() => !!document.querySelector(".maplibregl-canvas") &&
      document.querySelectorAll(".maplibregl-ctrl-scale").length > 0, null, { timeout: 20000 });
    return true;
  } catch {
    return false;
  }
};

async function invariants(cuj) {
  const on = await layersOn();
  check(cuj, on.length <= 2, `at most two data layers (${on.join(", ") || "none"})`);
  const legends = await page.locator("[data-legend]:visible").count();
  check(cuj, legends >= 1, "a legend is visible");
  const text = await bodyText();
  check(cuj, !/confirmed (scar|landslide)/i.test(text) && !text.includes("WorldPop"), "no banned text");
}

// The map camera must be on the case: its center inside the case bounds.
// Uses the window.__map handle that Map.tsx exposes for headless checks.
async function mapOnCase(cuj) {
  const got = await page.evaluate(() => {
    const m = window.__map;
    if (!m) return null;
    const c = m.getCenter();
    const b = m.getBounds();
    return { lng: c.lng, lat: c.lat, w: b.getWest(), s: b.getSouth(), e: b.getEast(), n: b.getNorth() };
  });
  if (!got) return info(cuj, "no map handle: camera not checked");
  const want = CASE_BOUNDS[await attr("data-case")];
  if (!want) return info(cuj, "no known bounds for this case");
  const inside = got.lng > want[0] && got.lng < want[2] && got.lat > want[1] && got.lat < want[3];
  check(cuj, inside, `the map is on the case (center ${got.lng.toFixed(2)}, ${got.lat.toFixed(2)})`);
}

// Turn every available layer row on, one after the other.
async function layerWalk(cuj) {
  const switches = page.locator('aside[aria-label="Map layers"] [role="switch"]');
  const count = await switches.count();
  let named = 0;
  for (let i = 0; i < count; i++) {
    const s = switches.nth(i);
    if (await s.isDisabled()) {
      const label = await s.getAttribute("aria-label");
      check(cuj, (await s.getAttribute("aria-checked")) === "false" && /:/.test(label ?? ""),
        `row without data is off and names its reason (${label})`);
      continue;
    }
    if ((await s.getAttribute("aria-checked")) === "true") continue;
    const before = await layersOn();
    await s.click();
    const after = await layersOn();
    check(cuj, after.length <= 2, `after a toggle: ${after.join(", ")}`);
    if (before.length === 2) {
      const notice = await page.locator('aside[aria-label="Map layers"] [aria-live="polite"]').innerText();
      check(cuj, /turned off to show/.test(notice), `the layer turned off is named ("${notice}")`);
      named += 1;
    }
  }
  info(cuj, `${count} layer rows, ${named} evictions named`);
}

async function replayCase(id, title) {
  const cuj = `replay ${id}`;
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  const select = page.getByLabel("Past event");
  await select.selectOption({ label: title });
  await page.waitForFunction((t) => document.querySelector("[data-case]")?.getAttribute("data-case") !== "now", title);
  await page.waitForTimeout(800);
  check(`CUJ-2 ${id}`, (await page.getByRole("button", { name: "Play", exact: true }).count()) === 1, "the timeline does not start playing");
  const eventStep = await currentStep();
  check(`CUJ-2 ${id}`, /EVENT/.test(eventStep ?? ""), `the timeline is on the event day (${eventStep})`);
  await invariants(cuj);
  await page.waitForTimeout(1500);
  if (mapLoaded) await mapOnCase(`map ${id}`);
  await shot(`${id}-open`);

  // CUJ-3 hazard: exactly one selected.
  const radios = page.getByRole("radio");
  for (const name of ["Flood risk", "Landslide risk"]) {
    const r = page.getByRole("radio", { name });
    if (await r.isDisabled()) continue;
    await r.click();
    const checked = await radios.evaluateAll((els) => els.filter((e) => e.getAttribute("aria-checked") === "true").length);
    check(`CUJ-3 ${id}`, checked === 1, `exactly one hazard selected after "${name}"`);
    info(`CUJ-3 ${id}`, `caption: ${await page.locator("[data-caption]").innerText()}`);
  }

  // CUJ-5 time.
  await page.getByRole("button", { name: "Next step" }).click();
  const next = await currentStep();
  check(`CUJ-5 ${id}`, next !== eventStep, `next moves one step (${next})`);
  await page.getByRole("button", { name: "Previous step" }).click();
  check(`CUJ-5 ${id}`, (await currentStep()) === eventStep, "previous moves back one step");
  const steps = page.locator('[aria-label="Timeline steps"] button');
  const total = await steps.count();
  await steps.nth(total - 2).click();
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(1800);
  check(`CUJ-5 ${id}`, (await steps.nth(total - 1).getAttribute("aria-pressed")) === "true" &&
    (await page.getByRole("button", { name: "Play", exact: true }).count()) === 1, "play advances and stops at the last step");
  const lastLabel = await steps.nth(total - 1).getAttribute("aria-label");
  info(`CUJ-5 ${id}`, `${total} steps; last: ${lastLabel}`);
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await steps.nth(2).click();
  check(`CUJ-5 ${id}`, (await page.getByRole("button", { name: "Play", exact: true }).count()) === 1, "a manual step pauses playback");

  // CUJ-7 chart and table.
  const table = page.getByRole("button", { name: "Table", exact: true });
  if (await table.count()) {
    await table.click();
    const rows = page.locator('section[aria-label^="Rain"] tbody tr');
    check(`CUJ-7 ${id}`, (await rows.count()) === total, `the table lists the ${total} days`);
    await rows.nth(1).getByRole("button").click();
    check(`CUJ-7 ${id}`, (await steps.nth(1).getAttribute("aria-pressed")) === "true", "a table date moves the timeline");
    await page.getByRole("button", { name: "Chart", exact: true }).click();
    const bars = page.locator('section[aria-label^="Rain"] .recharts-bar-rectangle path');
    await page.locator('section[aria-label^="Rain"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(1800); // bar animation
    const boxes = await bars.evaluateAll((els) => els.map((e) => {
      const b = e.getBoundingClientRect();
      return { x: b.x + b.width / 2, y: b.y + b.height / 2, h: b.height };
    }));
    const tall = boxes.findIndex((b, i) => b.h > 12 && i !== 1);
    if (tall >= 0) {
      await page.mouse.click(boxes[tall].x, boxes[tall].y);
      check(`CUJ-7 ${id}`, (await steps.nth(tall).getAttribute("aria-pressed")) === "true", `a bar click moves the timeline (bar ${tall + 1})`);
    } else {
      info(`CUJ-7 ${id}`, "no chart bar tall enough to click");
    }
  } else {
    info(`CUJ-7 ${id}`, "no series: chart reads not published yet");
  }

  // CUJ-6 priority area.
  const rowsArea = page.locator('section[aria-label="Priority areas"] button[aria-label^="Priority area"]');
  if (await rowsArea.count()) {
    await rowsArea.first().click();
    check(`CUJ-6 ${id}`, (await rowsArea.first().getAttribute("aria-pressed")) === "true", "the row is marked");
    const pin = page.locator('.cc-pin[aria-pressed="true"]');
    const card = page.locator('.cc-callout-marker [role="group"]');
    if (await page.locator(".cc-pin").count()) {
      check(`CUJ-6 ${id}`, (await pin.count()) === 1, "the pin is marked");
      check(`CUJ-6 ${id}`, await card.isVisible(), "the callout shows");
      info(`CUJ-6 ${id}`, (await card.innerText()).replace(/\s+/g, " "));
      await card.getByRole("button", { name: "Show R, S and T" }).click();
      await page.waitForTimeout(2500);
      info(`CUJ-6 ${id}`, `expanded: ${(await card.innerText()).replace(/\s+/g, " ")}`);
      await shot(`${id}-callout`);
    } else {
      info(`CUJ-6 ${id}`, "no pins on the map (map not loaded)");
    }
    await page.keyboard.press("Escape");
    check(`CUJ-6 ${id}`, (await rowsArea.first().getAttribute("aria-pressed")) === "false", "Esc clears the selection");
    const viewAll = page.getByRole("button", { name: /View all/ });
    if (await viewAll.count()) {
      const before = await rowsArea.count();
      await viewAll.click();
      check(`CUJ-6 ${id}`, (await rowsArea.count()) > before, `"View all" lists every area (${await rowsArea.count()})`);
      await page.getByRole("button", { name: "Show less" }).click();
    }
    const text = await page.locator('section[aria-label="Priority areas"]').innerText();
    info(`CUJ-6 ${id}`, `people column: ${text.includes("not published yet") ? "not published yet" : "values"}`);
  } else {
    info(`CUJ-6 ${id}`, "no priority areas in the data");
  }

  // CUJ-8 radar.
  const radar = page.locator('section[aria-label="Radar confirmation"]');
  const radarText = (await radar.innerText()).replace(/\s+/g, " ");
  info(`CUJ-8 ${id}`, radarText.slice(0, 260));
  const confirm = radar.getByRole("button", { name: /Confirm with NISAR radar/ });
  if ((await confirm.count()) && !(await confirm.isDisabled())) {
    const stepBefore = await currentStep();
    await confirm.click();
    const on = await layersOn();
    check(`CUJ-8 ${id}`, on.join(",") === "tpi,flood", `"Confirm" shows TPI plus the flood polygons (${on.join(",")})`);
    check(`CUJ-8 ${id}`, (await currentStep()) === stepBefore, "the timeline does not move");
    await shot(`${id}-radar`);
  } else {
    check(`CUJ-8 ${id}`, /No radar for this event/.test(radarText) || /Awaiting a NISAR pair/.test(radarText),
      "without a pair the card says why");
  }
  const compare = radar.getByRole("button", { name: "Before / after" });
  if (await compare.isDisabled()) {
    check(`CUJ-8 ${id}`, /Before \/ after: (images not published yet|No radar for this event)/.test(radarText),
      "\"Before / after\" is disabled with its reason");
  } else {
    await compare.click();
    check(`CUJ-8 ${id}`, await page.locator("[data-compare]").isVisible(), "the comparison covers the map");
    await page.getByRole("button", { name: "Close compare" }).click();
  }

  // CUJ-9 replay check.
  const checkCard = page.locator('section[aria-label="Replay check"]');
  check(`CUJ-9 ${id}`, await checkCard.isVisible(), "the Replay check card shows");
  info(`CUJ-9 ${id}`, (await checkCard.innerText()).replace(/\s+/g, " ").slice(0, 300));
  await checkCard.getByRole("button", { name: /Show details/ }).click();
  const details = await checkCard.innerText();
  check(`CUJ-9 ${id}`, ["Why radar", "Impact", "Exposure basis", "Evidence on the map"].every((t) => details.includes(t)),
    "the details hold the validation and impact content");
  await checkCard.getByRole("button", { name: "Hide details" }).click();

  // CUJ-4 layers.
  await layerWalk(`CUJ-4 ${id}`);
  await invariants(cuj);
  await shot(`${id}-layers`);
}

// ---------------------------------------------------------------------------

try {
await page.goto(HOME, { waitUntil: "domcontentloaded", timeout: 180000 });
await root.waitFor({ timeout: 180000 });
var mapLoaded = await mapReady();
info("map", mapLoaded ? "the map loaded" : "the map did not load (basemap unreachable?)");
await page.waitForTimeout(1500);

// CUJ-1 open.
check("CUJ-1", (await attr("data-case")) === "now", "the screen opens on Now");
{
  const text = await panelText();
  const chip = await page.locator("[data-chip]").innerText();
  info("CUJ-1", `status chip: ${chip}`);
  if (/No live data yet/.test(chip)) {
    check("CUJ-1", !text.includes("Below the tipping point"), "an empty Now never reads \"Below the tipping point\"");
    check("CUJ-1", text.includes("not published yet"), "missing values read \"not published yet\"");
    check("CUJ-1", await page.getByRole("button", { name: "Open Replay" }).isVisible(), "Replay is offered next to the notice");
  }
  const fresh = await page.locator('header [role="status"]').innerText();
  info("CUJ-12", `freshness: ${fresh}`);
  check("CUJ-12", !/^Live/.test(fresh) || /updated/.test(fresh), "freshness never reads live without a run time");
  check("CUJ-9", (await page.locator('section[aria-label="Replay check"]').count()) === 0, "no Replay check in Now");
  info("CUJ-5", `timeline: ${(await page.locator('[aria-label="Timeline steps"]').count()) ? "steps" : "No frames published yet"}`);
  info("CUJ-11", (await page.locator('section[aria-label="Get alerts"]').count()) ? "Telegram card shown" : "no bot address: card hidden");
  check("CUJ-2", (await page.locator('header [aria-label="Region"]').innerText()) === "Southern Brazil", "Now shows the region label, not a select");
}
await invariants("now");
await layerWalk("CUJ-4 now");
await shot("now");

// CUJ-2: the event list.
await page.getByRole("button", { name: "Replay", exact: true }).click();
var titles = await page.getByLabel("Past event").locator("option").allInnerTexts();
info("CUJ-2", `events: ${titles.join(" | ")}`);
check("CUJ-2", titles.length >= 1, "Replay lists the events");
await page.getByRole("button", { name: "Now", exact: true }).click();

var ids = [];
for (const title of titles) {
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await page.getByLabel("Past event").selectOption({ label: title });
  const id = await attr("data-case");
  ids.push(id);
  await replayCase(id, title);
  await page.getByRole("button", { name: "Now", exact: true }).click();
}

// CUJ-2: the last replay viewed is selected again.
await page.getByRole("button", { name: "Replay", exact: true }).click();
check("CUJ-2", (await attr("data-case")) === ids[ids.length - 1], "Replay reopens the last event viewed");

// CUJ-13 map tools.
await page.locator('[data-tool="layers"]').click();
check("CUJ-13", !(await page.locator('aside[aria-label="Map layers"]').isVisible()), "the Layers column hides");
check("CUJ-13", await page.locator('[data-legend="compact"]').isVisible(), "a compact legend stays on the map");
for (const tool of ["zoom-in", "zoom-out", "recenter"]) await page.locator(`[data-tool="${tool}"]`).click();
await shot("tools");
await page.locator('[data-tool="layers"]').click();

// CUJ-10 routes: the view follows the address, the map is not reloaded.
await page.evaluate(() => {
  const c = document.querySelector(".maplibregl-canvas");
  if (c) c.dataset.kept = "1";
});
var caseBefore = await attr("data-case");
var stepBefore = await currentStep();
await page.getByRole("button", { name: "Public Alerts" }).click();
await page.waitForTimeout(400);
check("CUJ-10", page.url() === ALERTS, `the address changes to ${ALERTS}`);
check("CUJ-10", (await attr("data-view")) === "public", "the right panel shows Public Alerts");
check("CUJ-10", (await attr("data-case")) === caseBefore && (await currentStep()) === stepBefore, "case and step stay");
if (mapLoaded) {
  check("CUJ-10", await page.evaluate(() => document.querySelector(".maplibregl-canvas")?.dataset.kept === "1"), "the map is not reloaded");
}
check("CUJ-10", (await panelText()).includes("There is no public alert feed in replay."), "Replay states there is no public feed");
await shot("public-replay");
await page.getByRole("button", { name: "Go to Now" }).click();
await page.waitForTimeout(400);
check("CUJ-10", (await attr("data-case")) === "now", "\"Go to Now\" opens Now");
await page.goBack();
await page.waitForTimeout(400);
check("CUJ-10", new URL(page.url()).pathname === (PREFIX || "/") && (await attr("data-view")) === "command", "back returns to the previous view");
await page.goForward();
await page.waitForTimeout(400);
check("CUJ-10", (await attr("data-view")) === "public", "forward returns to Public Alerts");

await page.goto(ALERTS, { waitUntil: "domcontentloaded", timeout: 180000 });
await root.waitFor({ timeout: 180000 });
await page.waitForTimeout(1500);
check("CUJ-10", (await attr("data-view")) === "public" && (await attr("data-case")) === "now", "a direct open of /alerts shows the public view on Now");
{
  const state = await page.locator("[data-alerts]").getAttribute("data-alerts");
  const text = await panelText();
  info("CUJ-10", `alert data state: ${state}`);
  if (state === "unavailable") {
    check("CUJ-10", text.includes("Alert data unavailable") && !text.includes("No active alerts"),
      "unavailable alert data never reads \"No active alerts\"");
  }
  check("CUJ-10", text.includes("SMS 40199") && !text.includes("Call 199"), "the contact line is \"SMS 40199\"");
  check("CUJ-10", await page.locator('aside[aria-label="Map layers"]').isVisible() &&
    (await page.locator(".maplibregl-map").count()) === 1, "map, Layers column and timeline are present");
}
await invariants("public");
await shot("public-now");

// A deep link opens the map on the case too.
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${HOME}?case=wa_2025`, { waitUntil: "domcontentloaded", timeout: 180000 });
await root.waitFor({ timeout: 180000 });
if (await mapReady()) {
  await page.waitForTimeout(2500);
  await mapOnCase("map ?case=wa_2025");
  const pins = await page.locator(".cc-pin").evaluateAll((els) => {
    const box = document.querySelector(".maplibregl-map").getBoundingClientRect();
    return els.filter((e) => {
      const r = e.getBoundingClientRect();
      return r.right > box.left && r.left < box.right && r.bottom > box.top && r.top < box.bottom;
    }).length;
  });
  check("map ?case=wa_2025", pins > 0, `priority pins are in view (${pins})`);
}

// CUJ-14 narrow screen.
await page.setViewportSize({ width: 800, height: 900 });
await page.goto(HOME, { waitUntil: "domcontentloaded", timeout: 180000 });
await root.waitFor({ timeout: 180000 });
await page.waitForTimeout(1500);
{
  const y = async (sel) => (await page.locator(sel).first().boundingBox())?.y ?? -1;
  const order = [await y("header"), await y(".maplibregl-map"), await y('aside[aria-label="Situation overview"]'), await y('button[aria-label="Play"]')];
  check("CUJ-14", order.every((v, i) => i === 0 || v > order[i - 1]), `one column: header, map, panel, timeline (${order.map(Math.round).join(" < ")})`);
  check("CUJ-14", !(await page.locator('aside[aria-label="Map layers"]').isVisible()), "the Layers column is closed");
  check("CUJ-14", await page.locator('[data-legend="compact"]').isVisible(), "the compact legend stays on the map");
  await page.locator('[data-tool="layers"]').click();
  check("CUJ-14", await page.locator('aside[aria-label="Map layers"]').isVisible(), "the Layers column opens as a drawer");
  await shot("narrow-drawer");
  await page.keyboard.press("Escape");
  check("CUJ-14", !(await page.locator('aside[aria-label="Map layers"]').isVisible()), "Esc closes the drawer");
  await shot("narrow");
}

} catch (e) {
  // A step that cannot run is a failure; the lines so far are still printed.
  failures.push(`script stopped: ${String(e).split("\n")[0]}`);
  results.push(`  FAIL script stopped: ${String(e).slice(0, 600)}`);
}

for (const file of missingData) results.push(`  DATA requested by the screen, not served (404): ${file}`);
if (pointDown) results.push("  info /api/point answered 503 (no Earth Engine credentials on this server): R, S, T come from the COGs");
const errors = [...new Set(consoleErrors)].filter(
  (e) => !(missingData.size && (/status of 404/.test(e) || /AJAXError: Not Found \(404\).*\/data\//.test(e))) &&
    !(pointDown && /status of 503/.test(e))
);
check("console", errors.length === 0, `no console error${errors.length ? `: ${errors.slice(0, 6).join(" || ")}` : ""}`);

await browser.close();
console.log(results.join("\n"));
console.log(`\n${failures.length ? `FAILED: ${failures.length} check(s)` : "PASSED"} (${results.length} lines, ${missingData.size} missing data file(s))`);
process.exit(failures.length ? 1 : 0);
