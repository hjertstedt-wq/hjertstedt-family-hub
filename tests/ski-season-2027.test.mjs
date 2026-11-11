import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function load(file) {
  const source = readFileSync(new URL("../app/lib/" + file, import.meta.url), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const exports = {};
  new Function("exports", js)(exports);
  return exports;
}

const { seasonSuggestions, matchesSeasonSuggestion } = load("ski-season-2027.ts");
const { eligibleForPerson } = load("ski-eligibility.ts");
const suggestion = id => seasonSuggestions.find(event => event.id === id);

test("season proposals have distinct keys, dates, sources and the intended skier classes", () => {
  assert.equal(new Set(seasonSuggestions.map(event => event.id)).size, 10);
  for (const event of seasonSuggestions) {
    assert.ok(Date.parse(event.ends_at) > Date.parse(event.starts_at));
    assert.equal(new URL(event.url).protocol, "https:");
    assert.equal(event.category, "ski_candidate");
  }
  const lvc = suggestion("region5-lvc-final-2027");
  const fjater = suggestion("region5-fjater-fart-2027");
  assert.equal(eligibleForPerson(lvc.description, "Alva"), true);
  assert.equal(eligibleForPerson(lvc.description, "Elsa"), false);
  assert.equal(eligibleForPerson(fjater.description, "Alva"), true);
  assert.equal(eligibleForPerson(fjater.description, "Elsa"), true);
  for (const id of ["usm-final-2027-funasdalen", "funas-winter-opening-2027", "guldhjalmen-2027"]) {
    assert.equal(eligibleForPerson(suggestion(id).description, "Elsa"), true);
    assert.equal(eligibleForPerson(suggestion(id).description, "Alva"), false);
  }
});

test("existing staging rows and manual entries hide matching proposals only", () => {
  const usm = suggestion("usm-final-2027-funasdalen");
  assert.equal(matchesSeasonSuggestion({ ...usm, external_id: usm.external_id + "-family-id" }, usm), true);
  const fjater = suggestion("region5-fjater-fart-2027");
  const manual = {
    external_id: null, title: "Fartträning Fjätervålen", location: "Fjätervålen",
    starts_at: "2027-02-12T09:00:00+01:00", ends_at: "2027-02-12T13:00:00+01:00"
  };
  assert.equal(matchesSeasonSuggestion(manual, fjater), true);
  assert.equal(matchesSeasonSuggestion({ ...manual, starts_at: "2026-02-12T09:00:00+01:00", ends_at: "2026-02-12T13:00:00+01:00" }, fjater), false);
  const hammarby = suggestion("winter-games-hammarby-2027");
  assert.equal(matchesSeasonSuggestion({ ...hammarby, external_id: null, title: "Winter Games Åre", location: "Åre" }, hammarby), false);
});
