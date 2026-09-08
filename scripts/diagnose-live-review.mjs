// One explicitly opted-in call using a public synthetic regression fixture.
// Never use this diagnostic with private student text or print credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
if(process.env.RUN_LIVE_INCIDENT!=='1') throw new Error('Paid diagnostic requires opt-in.');
require('@next/env').loadEnvConfig(process.cwd());
assert.ok(process.env.OPENAI_API_KEY);
let source=fs.readFileSync(new URL('../app/api/coach/route.ts',import.meta.url),'utf8').replace(/^import .*;\n/gm,'');
source+='\nexport {reviewCandidateFeedback};';
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sandbox={exports:{}};
new Function('exports','require','module',compiled)(sandbox.exports,require,sandbox);
const fixture=JSON.parse(fs.readFileSync('reports/accuracy/boundaries-2026-09-08T11-48-30-519Z.json','utf8')).results.find(item=>item.id==='unsupported-universal');
assert.equal(fixture.data.feedback.length,1);
const realFetch=globalThis.fetch;
try {
  globalThis.fetch=async (...args)=>{
    const response=await realFetch(...args);
    const data=await response.clone().json();
    const text=data.output_text ?? (data.output??[]).flatMap(item=>item.content??[]).map(item=>item.text??'').join('');
    console.log(JSON.stringify({syntheticCase:fixture.id,status:response.status,decision:text}));
    return response;
  };
  const result=await sandbox.exports.reviewCandidateFeedback(fixture.data,fixture.draft,process.env.OPENAI_API_KEY,AbortSignal.timeout(45000));
  console.log(JSON.stringify({approved:result.feedback.length}));
} finally {globalThis.fetch=realFetch;}
