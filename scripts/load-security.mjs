import ts from "typescript";
import { readFile } from "node:fs/promises";
const encode = source => "data:text/javascript;base64," + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString("base64");
export async function loadSecurity() {
  const shared = encode(await readFile(new URL("../app/api/shared-limits.ts", import.meta.url), "utf8"));
  const security = (await readFile(new URL("../app/api/security.ts", import.meta.url), "utf8")).replace('"./shared-limits"', JSON.stringify(shared));
  return import(encode(security));
}
