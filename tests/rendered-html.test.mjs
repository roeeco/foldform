import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server renders the Foldform parametric editor", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /Foldform Studio/);
  assert.match(html, /Parametric dieline editor/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/);
});

test("core model keeps project parameters authoritative", async () => {
  const source = await readFile(new URL("../app/lib/dieline.ts", import.meta.url), "utf8");
  const editorSource = await readFile(new URL("../app/Editor.tsx", import.meta.url), "utf8");
  const storeSource = await readFile(new URL("../app/lib/store.ts", import.meta.url), "utf8");
  assert.match(source, /type Micrometres/);
  assert.match(source, /generateTuckCarton/);
  assert.match(source, /generateBoxWithLid/);
  assert.match(source, /generateMatchBox/);
  assert.match(source, /generateCrashLockCarton/);
  assert.match(source, /generateAutoLockCarton/);
  assert.match(source, /generateCakeSliceBox/);
  assert.match(source, /generateTrapezoidBox/);
  assert.match(source, /generateBag/);
  assert.match(source, /generateEnvelope/);
  assert.match(source, /generatePillowPack/);
  assert.match(source, /topFold/);
  assert.match(source, /roundedTipCommands/);
  assert.match(source, /fold-over-tuck/);
  assert.match(source, /fold-over-lock/);
  assert.match(source, /generateProjectScene/);
  assert.match(source, /assertSceneIntegrity/);
  assert.match(source, /stable ID|Duplicate semantic path ID/);
  assert.doesNotMatch(source, /Math\.random|Date\.now/);
  assert.match(editorSource, /active-parameter-glow/);
  assert.match(editorSource, /Decrease \$\{label\} by 1 millimetre/);
  assert.doesNotMatch(editorSource, /dimension-popover|data-layer="dimensions"|activationToken/);
  assert.match(storeSource, /id === "box-with-lid" \|\| id === "cake-slice-box" \|\| id === "trapezoid-box"/);
  assert.match(storeSource, /: 90_000/);
});
