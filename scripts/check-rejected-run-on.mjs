import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const fixture=JSON.parse(read('benchmarks/accuracy/rejected-run-on.json'));
const code=['app/text-limits.ts','app/api/coach/upstream.ts','app/api/coach/route.ts'].map(read).join('\n').replace(/^import .*;\n/gm,'');
const box={exports:{}};
new Function('exports','require','module','NextResponse','readLimitedJson','requestBodyLimits','acquireAiRequest',ts.transpileModule(code,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(box.exports,require,box,{json:Response.json},async r=>({ok:true,value:await r.json()}),{coach:100000},async()=>({ok:true,release:async()=>{}}));
process.env.OPENAI_API_KEY='test-not-real'; delete process.env.SENTENCE_LANGUAGE_REVIEW;
delete process.env.THINKREVISE_DEMO_MODE; delete process.env.REVISIONCOACH_DEMO_MODE;
let calls=0;const originalFetch=globalThis.fetch;
try {
 globalThis.fetch=async()=>{calls++;assert.ok(calls<=2);return Response.json({output_text:JSON.stringify(calls===1?fixture.primary:fixture.review)});};
 const response=await box.exports.POST(new Request('http://localhost/api/coach',{method:'POST',body:JSON.stringify({mode:'coach',phase:'revision',draft:fixture.draft})}));
 const result=await response.json();
 assert.equal(response.status,200);assert.equal(calls,2);
 assert.equal(result.feedback.length,0,'A rejected run-on candidate must not return after independent review');
 assert.equal(result.modelRevision,fixture.draft);
 console.log('Captured live false-positive replay passed; no AI calls.');
} finally {globalThis.fetch=originalFetch;}
