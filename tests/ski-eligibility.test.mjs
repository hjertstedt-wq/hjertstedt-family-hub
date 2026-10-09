import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const source=readFileSync(new URL("../app/lib/ski-eligibility.ts",import.meta.url),"utf8");
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const module={exports:{}};
new Function("module","exports",js)(module,module.exports);
const {eligibleForAge,eligibleForPerson}=module.exports;
test("U14/U16 supports both children",()=>{
 assert.equal(eligibleForPerson("U14/U16 · GS","Alva Hjertstedt"),true);
 assert.equal(eligibleForPerson("U14/U16 · GS","Elsa Hjertstedt"),true);
});
test("only appropriate age group",()=>{
 assert.equal(eligibleForPerson("U14 · SL","Elsa Hjertstedt"),false);
 assert.equal(eligibleForPerson("U16 · SL","Alva Hjertstedt"),false);
});
test("unknown age or person cannot be approved",()=>{
 assert.equal(eligibleForPerson("Åldersklass ej verifierad","Alva Hjertstedt"),false);
 assert.equal(eligibleForPerson("U16","Okänd Person"),false);
 assert.equal(eligibleForAge("U160", "U16"),false);
});

test("word boundaries and case handling",()=>{
 assert.equal(eligibleForAge("u14 / u16","U14"),true);
 assert.equal(eligibleForAge("U14/U16","U16"),true);
 assert.equal(eligibleForAge("U140","U14"),false);
 assert.equal(eligibleForAge("U16X","U16"),false);
 assert.equal(eligibleForPerson(null,"Elsa Hjertstedt"),false);
 assert.equal(eligibleForPerson("U14","Magdalena Hjertstedt"),false);
});
