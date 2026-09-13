import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nextActionIds } from '../src/domain/next-actions.mjs';
const pack=JSON.parse(readFileSync(new URL('../evals/next-actions.synthetic.json',import.meta.url),'utf8'));
for (const c of pack.cases) test(c.id+' '+c.name,()=>assert.deepEqual(nextActionIds({...pack.base_context,...c.context}),c.expected_action_ids));
const base=pack.base_context;
for (const [name,patch] of [
  ['truthy string',{ownerVerified:'false'}],['unknown phase',{phase:'whatever'}],
  ['unknown mode',{mode:'LIVEISH'}],['unknown capability',{capabilities:['execute_sql']}],
  ['unknown key',{userId:'someone_else'}],['bad style count',{styleOptionCount:3}],
  ['bad catalog',{catalogKind:'public_scrape'}]
]) test('reject '+name,()=>assert.throws(()=>nextActionIds({...base,...patch}),TypeError));
test('input is not mutated',()=>{const c=structuredClone(base);const before=JSON.stringify(c);nextActionIds(c);assert.equal(JSON.stringify(c),before);});
test('all outputs have at most three unique actions',()=>{for(const c of pack.cases){const a=nextActionIds({...pack.base_context,...c.context});assert.ok(a.length<=3);assert.equal(new Set(a).size,a.length);}});
test('fixtures never claim model evaluation',()=>assert.ok(pack.cases.every(c=>c.model_review_status==='NOT_RUN')));
