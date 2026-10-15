/**
 * A03 PR #11 minimal deterministic regression checks for the editable prototype.
 * Run: node --test prototypes/prototype-contract.test.mjs
 * Scope: source parsing, alarm/fixture isolation, chart/table data model, EKL text mapping.
 * This is NOT a browser, screen-reader, layout, contrast, performance or FAB calculation test.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

const html = readFileSync(new URL("./fab-one-issue-9.html", import.meta.url), "utf8");
const script = html.split("<script>")[1]?.split("</script>")[0];
if (!script) throw new Error("The editable prototype no longer has its embedded script");
new Script(script, { filename: "fab-one-issue-9.inline.js" });

class FakeNode {
  constructor(name) {
    this.name = name;
    this.children = [];
    this.textContent = "";
    this.attributes = {};
    this.className = "";
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  appendChild(child) { this.children.push(child); return child; }
  replaceChildren(...children) { this.children = children; }
}
function makeDoc() {
  const nodes = {};
  return {
    nodes,
    getElementById(id) { return nodes[id] ??= new FakeNode(id); },
    createElement(name) { return new FakeNode(name); },
    createElementNS(_namespace, name) { return new FakeNode(name); }
  };
}
function extractBetween(start, end) {
  const a = script.indexOf(start), b = script.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error("Missing script boundary " + start);
  return script.slice(a, b);
}
const doc = makeDoc();
const fixtureSource = extractBetween("const DEMO_ALERTS =", "const screens =");
const { renderEvidence, DEMO_ALERTS, DEMO_FIXTURES, KNOWLEDGE_CONCEPTS } =
  new Function("document", fixtureSource +
    "return {renderEvidence,DEMO_ALERTS,DEMO_FIXTURES,KNOWLEDGE_CONCEPTS};")(doc);
const updateConcept = new Function("document", "KNOWLEDGE_CONCEPTS",
  extractBetween("function updateConcept(concept){", "function openInsight(trigger,concept){") +
  "return updateConcept;")(doc, KNOWLEDGE_CONCEPTS);

test("P1: second alert has no wrong-equipment fixture or active evidence button", () => {
  assert.equal(DEMO_ALERTS["AL-DEMO-001"].equipmentId, "ETCH-02");
  assert.equal(DEMO_ALERTS["AL-DEMO-002"].equipmentId, "ETCH-01");
  assert.equal(DEMO_ALERTS["AL-DEMO-002"].fixtureId, null);
  assert.match(html, /disabled aria-describedby="no-fixture-002"/);
  assert.equal(renderEvidence("AL-DEMO-001"), true);
  const currentTitle = doc.nodes["evidence-title"].textContent;
  assert.equal(currentTitle, "ETCH-02 · CH-B");
  assert.equal(renderEvidence("AL-DEMO-002"), false);
  assert.equal(doc.nodes["evidence-title"].textContent, currentTitle);
  assert.equal(renderEvidence("nonexistent-id"), false);
});

test("P1: all eight samples and two missing values are shared by SVG and table", () => {
  const points = DEMO_FIXTURES["SYN-ETCH-02-01"];
  assert.deepEqual(points.map(p=>p.time),["T0","T1","T2","T3","T4","T5","T6","T7"]);
  assert.deepEqual(points.map(p=>p.value),[42,44,47,46,null,null,57,80]);
  assert.equal(renderEvidence("AL-DEMO-001"), true);
  const rows = doc.nodes["fixture-rows"].children;
  assert.equal(rows.length, points.length);
  for (let i = 0; i < points.length; i++) {
    assert.equal(rows[i].children[0].textContent, points[i].time);
    assert.equal(rows[i].children[1].textContent,
      points[i].value === null ? "—" : String(points[i].value));
    assert.equal(rows[i].children[2].textContent,
      points[i].value === null ? "데이터 없음" : "수집됨");
  }
  const visual = doc.nodes["fixture-plot"].children;
  assert.equal(visual.filter(n=>n.name==="circle").length,6);
  assert.equal(visual.filter(n=>n.name==="path").length,2); // T3->T6 not interpolated
  assert.equal(doc.nodes["fixture-x-ticks"].children.length,8);
  assert.match(doc.nodes["trendDesc"].textContent,/T4: 결측; T5: 결측/);
  assert.match(html,/도식용 가상 한계선 · 통계적 관리한계 미검증/);
});

test("P1: L3 body/formula/cautions/source all change with concept", () => {
  assert.equal(updateConcept("control-limit"), true);
  assert.match(doc.nodes["deep-title"].textContent,/SPC 관리한계/);
  assert.match(doc.nodes["deep-body"].textContent,/UCL/);
  assert.match(doc.nodes["deep-formula"].textContent,/관리도 유형/);
  assert.doesNotMatch(doc.nodes["deep-formula"].textContent,/30 nm\/min/);
  assert.match(doc.nodes["deep-cautions"].textContent,/USL/);
  assert.match(doc.nodes["deep-source"].textContent,/SPC 규칙/);
  assert.equal(updateConcept("etch-rate"), true);
  assert.match(doc.nodes["deep-body"].textContent,/Etch Rate/);
  assert.match(doc.nodes["deep-formula"].textContent,/30 nm\/min/);
  assert.match(doc.nodes["deep-source"].textContent,/산술 예시/);
  assert.equal(updateConcept("unsupported"), false);
});

test("owner visual direction and independent replaceable image slots", () => {
  assert.match(html,/--canvas:#FFFFFF/);
  assert.match(html,/--card:#FFFFFF/);
  assert.match(html,/--clay-main:#16B88A/);
  assert.match(html,/const ASSET_OVERRIDES =/);
  assert.match(html,/"illustration.wafer.v1": ""/);
  assert.match(html,/"illustration.etch-chamber.v1": ""/);
  assert.equal((html.match(/class="fallback-art"/g)||[]).length,2);
  assert.match(html,/object-fit:contain/);
  assert.match(html,/img.onerror=/);
});
