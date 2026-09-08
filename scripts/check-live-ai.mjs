import assert from "node:assert/strict";

const baseUrl = process.env.PROTOTYPE_URL || "http://127.0.0.1:3001";
const endpoint = new URL("/api/coach", baseUrl);
const draft = "Nowadays, i think AI are really good and it help students alot. Many student is useing it becuase they wants to finish work fast. Last year, they did not understood the risks and have went to websites that gives many informations. In my opinion, you can just copy stuff, and this is obviously very important!";

const modes = (process.env.LIVE_AI_MODES || "coach,model,rewrite")
  .split(",")
  .map((mode) => mode.trim())
  .filter(Boolean);
const results = [];

function categoryFamily(value) {
  if (/拼写|大小写/.test(value)) return "spelling";
  if (/主谓一致/.test(value)) return "agreement";
  if (/时态/.test(value)) return "tense";
  if (/词形|副词|动词形式/.test(value)) return "word-form";
  if (/冠词|单复数|不可数/.test(value)) return "noun-form";
  if (/学术|口语|非正式|个人化|绝对化|宽泛|强调/.test(value)) return "register";
  if (/句子完整|过长句|句法结构/.test(value)) return "sentence-structure";
  return `other:${value.toLocaleLowerCase().trim()}`;
}

function assertNoSameErrorDuplicates(feedback, mode) {
  for (let first = 0; first < feedback.length; first += 1) {
    for (let second = first + 1; second < feedback.length; second += 1) {
      const a = feedback[first].quote.toLocaleLowerCase().replace(/[^a-z0-9]+/gi, " ").trim();
      const b = feedback[second].quote.toLocaleLowerCase().replace(/[^a-z0-9]+/gi, " ").trim();
      const nested = a && b && (a.includes(b) || b.includes(a));
      assert.ok(!(nested && categoryFamily(feedback[first].category) === categoryFamily(feedback[second].category)), `${mode} repeated the same error at a nested source span`);
    }
  }
}

function assertNoKnownObviousErrors(text, label) {
  const patterns = [
    /\b(teh|becuase|recieve|definately|alot|useing|informations)\b/i,
    /\b(students is|many student is|AI are|it help|they wants|did not understood|have went|should teaches)\b/i,
    /\b(Nowadays|really good|very useful|a lot of|I think|In my opinion|obviously|Research proves|invented information)\b/i,
    /\bfinish (?:their )?(?:work|tasks) fast(?:er)?\b/i,
    /,\s+because\b/i,
    /[.!?]\s*[A-Za-z]\s*$/,
  ];
  assert.ok(patterns.every((pattern) => !pattern.test(text)), `${label} retained a known spelling, grammar, or academic-register problem`);
}

for (const mode of modes) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      draft,
      mode,
      goal: "全面检查语言准确性和学术表达",
      taskPrompt: "当前主题：教育与 AI",
      selfCheck: {
        mainPoint: "大学应该帮助学生批判性使用人工智能。",
        help: "全面检查语言准确性和学术表达",
      },
    }),
  });

  const data = await response.json();
  assert.equal(response.status, 200, `Live-AI ${mode} request failed: ${JSON.stringify(data)}`);
  assert.equal(
    data.provider,
    "openai",
    `Expected live OpenAI output for ${mode}, but the prototype used ${data.provider}. ${data.fallbackNotice || "Check OPENAI_API_KEY and API billing."}`,
  );
  assert.ok(data.feedback.length >= 8, `${mode} returned too few issues for the deliberately error-heavy draft`);
  const unlocatableQuotes = data.feedback
    .map((item) => item.quote)
    .filter((quote) => !draft.toLocaleLowerCase().includes(quote.toLocaleLowerCase()));
  assert.deepEqual(unlocatableQuotes, [], `${mode} returned quotations that could not be located in the original draft: ${JSON.stringify(unlocatableQuotes)}`);
  assert.ok(data.feedback.every((item) => item.correction?.trim()), `${mode} returned feedback without an actionable correction`);
  assert.ok(data.feedback.every((item) => /\p{Script=Han}/u.test(item.category)), `${mode} returned a non-Chinese feedback category`);
  assertNoSameErrorDuplicates(data.feedback, mode);
  if (mode === "rewrite") {
    assert.ok(data.modelRevision?.trim(), `${mode} did not prepare a complete academic revision`);
    assert.notEqual(data.modelRevision.trim(), draft, `${mode} returned the original draft unchanged`);
    assertNoKnownObviousErrors(data.modelRevision, mode);
  } else {
    assert.equal(data.modelRevision, "", `${mode} should defer the full revision until second-draft submission`);
  }

  if (mode === "model") {
    assert.ok(data.feedback.every((item) => item.suggestion?.trim()), "Local-support mode must provide one optional expression for every issue");
  } else {
    assert.ok(data.feedback.every((item) => !item.suggestion), `${mode} must not expose local replacement suggestions`);
  }
  results.push(`${mode}: ${data.feedback.length}`);
}

console.log(`Live OpenAI checks passed (${results.join(", ")}) with exact, locatable quotations.`);
