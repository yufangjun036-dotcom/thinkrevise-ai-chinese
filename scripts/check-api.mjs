import assert from "node:assert/strict";

const baseUrl = process.env.PROTOTYPE_URL || "http://127.0.0.1:3001";
const endpoint = new URL("/api/coach", baseUrl);
const draft = "AI feedback can help university students improve their writing, but learners should evaluate suggestions carefully before using them.";

function categoryFamily(value) {
  if (/拼写|大小写/.test(value)) return "spelling";
  if (/主谓一致/.test(value)) return "agreement";
  if (/时态/.test(value)) return "tense";
  if (/词形|副词|动词形式/.test(value)) return "word-form";
  if (/冠词|单复数|不可数/.test(value)) return "noun-form";
  if (/学术|口语|非正式|个人化|绝对化|宽泛|强调/.test(value)) return "register";
  if (/句子完整|过长句|句法结构|连写句|标点|句子连接|逗号拼接/.test(value)) return "sentence-structure";
  return `other:${value.toLocaleLowerCase().trim()}`;
}

function assertNoSameErrorDuplicates(feedback, label) {
  for (let first = 0; first < feedback.length; first += 1) {
    for (let second = first + 1; second < feedback.length; second += 1) {
      const a = feedback[first].quote.toLocaleLowerCase().replace(/[^a-z0-9]+/gi, " ").trim();
      const b = feedback[second].quote.toLocaleLowerCase().replace(/[^a-z0-9]+/gi, " ").trim();
      const nested = a && b && (a.includes(b) || b.includes(a));
      const shorter = a.length <= b.length ? a : b;
      const longer = a.length <= b.length ? b : a;
      const eligibleNestedSpan = shorter.length >= 3;
      const substantiallySameSpan = nested && eligibleNestedSpan && shorter.length / longer.length >= 0.6;
      assert.ok(!(nested && eligibleNestedSpan && (categoryFamily(feedback[first].category) === categoryFamily(feedback[second].category) || substantiallySameSpan)), `${label} repeated the same error at a nested source span`);
    }
  }
}

function assertNoKnownObviousErrors(text, label) {
  const patterns = [
    /\b(teh|becuase|recieve|definately|alot|useing|informations)\b/i,
    /\b(students is|many student is|AI are|it help|they wants|did not understood|have went|should teaches)\b/i,
    /\bthis do not always improves\b/i,
    /\b(Nowadays|really good|very useful|a lot of|I think|In my opinion|obviously|Research proves|invented information)\b/i,
    /\bfinish (?:their )?(?:work|tasks) fast(?:er)?\b/i,
    /,\s+because\b/i,
    /\b(?:and|but|so|yet|because|although|while)\s+This discussion\b/,
    /[.!?]\s*[A-Za-z]\s*$/,
  ];
  assert.ok(patterns.every((pattern) => !pattern.test(text)), `${label} retained a known spelling, grammar, or academic-register problem`);
}

async function post(body, raw = false) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: raw ? body : JSON.stringify(body),
  });
  const data = await response.json();
  return { response, data };
}

try {
  const malformed = await post("{", true);
  assert.equal(malformed.response.status, 400);
  assert.equal(malformed.response.headers.get("cache-control"), "no-store");

  const tooShort = await post({ draft: "Too short", mode: "coach" });
  assert.equal(tooShort.response.status, 400);

  const invalidMode = await post({ draft, mode: "unlimited-help" });
  assert.equal(invalidMode.response.status, 400);

  const invalidPhase = await post({ draft, mode: "coach", phase: "third-draft" });
  assert.equal(invalidPhase.response.status, 400);

  const longGoal = await post({ draft, mode: "coach", goal: "x".repeat(201) });
  assert.equal(longGoal.response.status, 400);

  const longSelfCheck = await post({ draft, mode: "coach", selfCheck: { mainPoint: "x".repeat(501) } });
  assert.equal(longSelfCheck.response.status, 400);

  const longTaskPrompt = await post({ draft, mode: "coach", taskPrompt: "x".repeat(501) });
  assert.equal(longTaskPrompt.response.status, 400);

  const overNonWhitespaceLimit = await post({ draft: "a".repeat(6001), mode: "coach" });
  assert.equal(overNonWhitespaceLimit.response.status, 400);
  assert.match(overNonWhitespaceLimit.data.error, /非空白字符/);

  const whitespaceHeavyInput = await post({ draft: `${"a".repeat(20)}${" ".repeat(12000)}b`, mode: "coach" });
  assert.equal(whitespaceHeavyInput.response.status, 400);
  assert.match(whitespaceHeavyInput.data.error, /空格或换行/);

  for (const mode of ["coach", "model", "rewrite"]) {
    const { response, data } = await post({
      draft,
      mode,
      goal: "让中心观点更清楚",
      taskPrompt: "当前主题：教育与 AI",
      selfCheck: { mainPoint: "Students should evaluate AI feedback.", help: "Clarity" },
    });
    assert.equal(response.status, 200, `${mode} request failed`);
    assert.equal(response.headers.get("cache-control"), "no-store", `${mode} response may be cached`);
    assert.ok(Array.isArray(data.feedback) && data.feedback.length <= 36, `${mode} must return zero to thirty-six genuine issues`);
    assert.ok(data.feedback.every((item) => item.category !== "任务回应度"), `${mode} should diagnose writing rather than task compliance`);
    assertNoSameErrorDuplicates(data.feedback, mode);
    assert.ok(data.feedback.every((item) => item.hints === undefined || Array.isArray(item.hints)), `${mode} returned invalid optional hint data`);
    if (mode === "rewrite") {
      assert.ok(Boolean(data.modelRevision), `${mode} did not prepare a complete comparison version`);
      assertNoKnownObviousErrors(data.modelRevision, mode);
    } else {
      assert.equal(data.modelRevision, "", `${mode} should defer the hidden full rewrite until second-draft submission`);
    }
    assert.ok(["demo", "openai"].includes(data.provider), `${mode} returned an unknown provider`);
    if (mode === "coach") assert.ok(data.feedback.every((item) => !item.suggestion), "coach mode must not reveal replacement sentences");
    if (mode === "model") assert.ok(data.feedback.every((item) => item.suggestion), "every local-collaboration issue needs an optional example");
  }

  const stressDraft = "Nowadays, i think AI are really good and it help students alot. Many student is useing it becuase they wants to finish work fast. Last year, they did not understood the risks and have went to websites that gives many informations. In my opinion, you can just copy stuff, and this is obviously very important!!! Research proves it always improve every student, but there is no evidence or example. The university should teaches kids how to use AI careful, otherwise students does not learned nothing.";
  const stress = await post({
    draft: stressDraft,
    mode: "coach",
    goal: "全面检查",
    taskPrompt: "当前主题：教育与 AI",
    selfCheck: { mainPoint: "AI 可以帮助学生，但必须批判性使用。", help: "全面检查" },
  });
  assert.equal(stress.response.status, 200, "stress-test request failed");
  assert.ok(stress.data.feedback.length >= 12, "stress test returned too few distinct issues");
  assert.ok(stress.data.feedback.every((item) => item.correction?.trim()), "every issue needs an actionable correction");
  assert.ok(stress.data.feedback.every((item) => stressDraft.toLocaleLowerCase().includes(item.quote.toLocaleLowerCase())), "every quote must exist verbatim in the draft for highlighting");
  assertNoSameErrorDuplicates(stress.data.feedback, "stress diagnosis");
  if (stress.data.provider === "demo") {
    const returnedQuotes = stress.data.feedback.map((item) => item.quote.toLocaleLowerCase());
    for (const expected of ["alot", "useing", "becuase", "many student is", "did not understood", "have went", "informations", "in my opinion", "obviously", "research proves", "should teaches", "use ai careful"]) {
      assert.ok(returnedQuotes.includes(expected), `stress test did not identify: ${expected}`);
    }
  }

  const peerReflectionDraft = "I take this course about AI in education this semester, and it change my mind a lot. Before, I just think AI is only for chat and write homework quickly. But after many class discussion, I know AI is not a simple tool to finish assignment.\n\nIn class, we talk about how teacher can use AI to make different exercise for student. Some student learn slow, some learn fast, AI can give them different material. But I also find a big problem: if student depend too much on AI, they will lose the ability to think by themself. Many people just copy AI answer without reading, this make learning no meaning.\n\nI try to use AI to help me prepare lesson plan in our project. It save a lot time, but AI sometimes give wrong information. I need check every point carefully, can not trust all things it say. This is the most important thing I learn.\n\nAI will not replace teachers. Teacher can see student’s emotion, encourage them and guide their thinking. AI only help. In future, I want learn more to use AI wisely, not overuse it. We should control AI, not let AI control our study.";
  const peerReflection = await post({
    phase: "initial",
    draft: peerReflectionDraft,
    mode: "coach",
    goal: "优先检查明确的语法、词汇和句子结构错误，再检查实质学术问题",
    taskPrompt: "当前主题：AI 与教育课程反思",
    selfCheck: { mainPoint: "反思 AI 在教育中的用途与风险。", weakness: "需要全面核对语言准确性。", help: "全面检查" },
  });
  assert.equal(peerReflection.response.status, 200, "peer reflection request failed");
  assert.ok(peerReflection.data.feedback.every((item) => peerReflectionDraft.toLocaleLowerCase().includes(item.quote.toLocaleLowerCase())), "peer reflection contains an unlocatable quote");
  assertNoSameErrorDuplicates(peerReflection.data.feedback, "peer reflection diagnosis");
  if (peerReflection.data.provider === "demo") {
    const returnedQuotes = peerReflection.data.feedback.map((item) => item.quote.toLocaleLowerCase());
    for (const expected of [
      "it change", "before, i just think", "for chat and write homework", "many class discussion", "finish assignment",
      "teacher can use ai to make different exercise for student", "some student learn slow, some learn fast, ai can",
      "if student depend too much on ai", "by themself",
      "many people just copy ai answer without reading, this make learning no meaning", "prepare lesson plan",
      "it save", "a lot time", "ai sometimes give",
      "i need check every point carefully, can not trust all things it say",
      "teacher can see student’s emotion", "ai only help", "this is the most important thing i learn", "i want learn",
    ]) assert.ok(returnedQuotes.includes(expected), `peer reflection did not identify: ${expected}`);
    const languageFeedback = peerReflection.data.feedback.filter((item) => item.category.startsWith("语言"));
    assert.ok(languageFeedback.length >= 19, "peer reflection returned too few objective-language findings");
    assert.equal(languageFeedback.filter((item) => /\bit say\b/i.test(item.quote)).length, 1, "it say was reported more than once");
  }

  const blindCalibrationCases = [
    {
      id: "blind-2",
      draft: "AI change the way we study. I use ChatGPT last month to finish my essay, and it help me write paragraph very fast. But my professor say many student just paste AI text and skip thinking. When I submit my first draft, my teacher tell me my idea is shallow. I find AI sometimes make fake reference, the source not exist at all. I think student should know AI can lie. We can use AI for brainstorm, but cannot let it write whole paper.",
      expected: ["AI change the way", "I use ChatGPT last month", "it help me write paragraph", "my professor say", "many student", "my teacher tell me", "I find AI sometimes make fake reference, the source not exist at all", "student should know", "for brainstorm"],
    },
    {
      id: "blind-3",
      draft: "Many school start to use AI tutor in classroom. AI tutor can give quiz to student, and mark answer automatic. But there is a big risk: AI cannot notice student emotion. When student feel upset or confuse, AI will not comfort them. Last week, my classmate use AI to practice math. The AI give wrong answer for one hard question, and my class waste many time follow the wrong step. I believe AI can assist teaching, but human teacher still necessary.",
      expected: ["Many school start", "use AI tutor in classroom", "give quiz to student", "mark answer automatic", "student emotion", "When student feel upset or confuse", "my classmate use AI to practice math", "The AI give wrong answer", "my class waste many time follow the wrong step", "human teacher still necessary"],
    },
    {
      id: "blind-4",
      draft: "Some people argue AI will replace teacher in 10 year. I disagree this opinion. AI can only process data, it cannot understand personal story of each student. When I was in high school, my English teacher help me build confidence. No AI can do that. Also, AI training data have bias. If we only rely on AI, student may receive unfair information. We should set rule to limit overuse of AI in school.",
      expected: ["replace teacher in 10 year", "I disagree this opinion", "AI can only process data, it cannot understand", "personal story of each student", "my English teacher help me", "student may receive", "set rule to limit"],
    },
    {
      id: "blind-5",
      draft: "AI help teacher reduce boring work, like grade homework and make worksheet. But many student use AI to cheat on exam. Last semester, our school catch three student who copy AI answer during online quiz. The punishment is warning. I think school need clear rule about AI. Student must learn what is allowed and what is not. If student use AI properly, it become a good helper.",
      expected: ["AI help teacher reduce boring work", "like grade homework and make worksheet", "many student", "cheat on exam", "our school catch three student who copy AI answer", "The punishment is warning", "school need clear rule about AI", "Student must learn", "If student use AI properly, it become"],
    },
    {
      id: "blind-6",
      draft: "Learning with AI have both advantage and risk. AI can give instant feedback when student finish exercise. This save waiting time. But feedback from AI sometimes too simple, it cannot explain deep logic. When I practice writing, AI tell me my sentence is wrong, but not explain why. I think AI work best when student already have basic knowledge, and use AI to check mistake.",
      expected: ["Learning with AI have both advantage and risk", "when student finish exercise", "This save waiting time", "feedback from AI sometimes too simple, it cannot explain deep logic", "AI tell me", "but not explain why", "AI work best", "when student already have basic knowledge", "check mistake"],
    },
    {
      id: "blind-7",
      draft: "Many research prove AI improve student test score. I read a paper online: 80% student get higher score after using AI study tool. But the paper not list sample size, and no reference. I try AI tool to practice vocabulary, and my score raise 15 point in one month. So AI is good for all student.",
      expected: ["Many research prove", "AI improve student test score", "80% student get higher score", "using AI study tool", "the paper not list", "my score raise 15 point", "all student"],
    },
    {
      id: "blind-8",
      draft: "Teacher need learn how to use AI before bring it to classroom. If teacher do not understand AI limit, they will give wrong guide to student. Last term, our teacher use AI make worksheet, and AI put wrong math formula inside. Many student finish homework based on that wrong content. After that incident, our school hold workshop to teach teacher AI basic knowledge.",
      expected: ["Teacher need learn", "before bring it to classroom", "teacher do not understand AI limit", "wrong guide to student", "our teacher use AI make worksheet", "Many student", "our school hold workshop", "teach teacher AI basic knowledge"],
    },
    {
      id: "blind-9",
      draft: "AI can help student build self-learning skill. Student can ask AI question anytime, even at night. But AI can not judge whether student really understand the concept. Some student just ask AI give answer directly, and skip thinking process. I think school should teach digital literacy class, so student know how to use AI as learning partner, not answer machine.",
      expected: ["help student build self-learning skill", "Student can ask AI question", "AI can not judge whether student really understand", "Some student just ask AI give answer directly, and skip thinking process", "school should teach digital literacy class, so student know", "as learning partner, not answer machine"],
    },
    {
      id: "blind-10",
      draft: "AI technology in education grow very fast. A famous research say AI can cut student study time by 40%. The researcher claim this experiment test 2000 student, but I cannot find the original paper anywhere. When I use AI for my language study, my reading speed improve a lot. Therefore, all school should buy expensive AI learning system immediately.",
      expected: ["AI technology in education grow", "A famous research say", "cut student study time", "The researcher claim this experiment test 2000 student", "my reading speed improve a lot", "all school should buy expensive AI learning system"],
    },
    {
      id: "blind-11",
      draft: "Many educator now believe AI will change how we teach and learn in higher education. I join this AI education module this semester, and it open my eyes about the strength and danger of AI tools. At first, I use AI to draft weekly reflection, I thought it save plenty time and make writing easy. But after feedback from lecturer, I realize my writing lose personal voice and critical thinking.\n\nAI can generate explanation for hard concept and create practice task for different level learner. However, AI sometimes produce wrong fact, and student may accept those mistake without double check. Last month, my group work use AI to collect data summary. The AI invent some survey result that never exist. We almost put that fake information into our presentation.\n\nI learn that AI work best as assistant, not replacement. Teacher still need guide student to evaluate AI output and build digital judgement skill. We cannot fully trust AI answer. Student must keep practice independent thinking. If we ignore this risk, AI will slowly weaken our ability to analyse information on our own.",
      expected: ["Many educator now believe", "I join this AI education module this semester", "it open my eyes about", "At first, I use AI to draft weekly reflection, I thought it save plenty time and make writing easy", "I realize my writing lose personal voice and critical thinking", "AI can generate explanation for hard concept and create practice task for different level learner", "AI sometimes produce wrong fact, and student may accept those mistake without double check", "Last month, my group work use AI to collect data summary", "The AI invent some survey result that never exist", "I learn that AI work best as assistant, not replacement", "Teacher still need guide student to evaluate AI output and build digital judgement skill", "We cannot fully trust AI answer", "Student must keep practice independent thinking"],
    },
    {
      id: "blind-12",
      draft: "Using AI for language learning bring big benefit but also hidden trap. I study English writing with AI chatbot for two month. The bot correct my grammar mistake and suggest better word choice quickly. But I soon find a problem: AI always write sentence in a similar style, so my own writing become less unique. When I submit assignment, my tutor notice the unnatural pattern in my paragraph.\n\nAI can give instant feedback, but it cannot catch all subtle logic flaw. It also cannot tell us how to build deeper argument. Some of my classmate depend too heavily on AI. They ask AI rewrite every sentence, and no longer spend time revise by themself. This habit stop them from improve their real writing ability.\n\nIn my opinion, student should set clear rule when using AI. We can use AI to check grammar or brainstorm idea, but keep our own original thinking. The goal of learning language is to express our own thought. AI can help polish text, but it cannot replace our own voice.",
      expected: ["Using AI for language learning bring big benefit but also hidden trap", "I study English writing with AI chatbot for two month", "The bot correct my grammar mistake and suggest better word choice quickly", "But I soon find a problem", "AI always write sentence in a similar style, so my own writing become less unique", "When I submit assignment, my tutor notice the unnatural pattern in my paragraph", "all subtle logic flaw", "build deeper argument", "Some of my classmate depend too heavily on AI", "They ask AI rewrite every sentence, and no longer spend time revise by themself", "This habit stop them from improve their real writing ability", "student should set clear rule when using AI", "brainstorm idea", "The goal of learning language is to express our own thought"],
    },
  ];
  for (const test of blindCalibrationCases) {
    const checked = await post({ phase: "initial", draft: test.draft, mode: "coach" });
    assert.equal(checked.response.status, 200, `${test.id} request failed`);
    assert.ok(checked.data.feedback.every((item) => test.draft.toLocaleLowerCase().includes(item.quote.toLocaleLowerCase())), `${test.id} contains an unlocatable quote`);
    assertNoSameErrorDuplicates(checked.data.feedback, `${test.id} diagnosis`);
    if (checked.data.provider === "demo") {
      for (const expected of test.expected) {
        assert.ok(checked.data.feedback.some((item) => item.quote.toLocaleLowerCase() === expected.toLocaleLowerCase()), `${test.id} did not identify: ${expected}`);
      }
    }
  }

  const secondDraft = "AI feedback can support university writers when learners evaluate each suggestion. However, many student is still accepting vague claims without evidence.";
  const revisionCheck = await post({
    phase: "revision",
    draft: secondDraft,
    originalDraft: stressDraft,
    mode: "rewrite",
    goal: "复检第二稿中仍存在的问题",
    taskPrompt: "当前主题：教育与 AI",
    selfCheck: { mainPoint: "Students should evaluate AI feedback.", weakness: "语言准确性不足", help: "全面检查" },
    priorFeedback: stress.data.feedback.map(({ category, quote, why, correction, confidence }) => ({ category: category.slice(0, 500), quote: quote.slice(0, 500), why: why.slice(0, 500), correction: correction.slice(0, 500), confidence })),
  });
  assert.equal(revisionCheck.response.status, 200, "second-draft reanalysis failed");
  assert.ok(revisionCheck.data.revisionComparison, "second-draft response did not include a difference-aware comparison");
  assert.ok(Boolean(revisionCheck.data.modelRevision), "second-draft reanalysis did not generate a final version");
  assertNoKnownObviousErrors(revisionCheck.data.modelRevision, "second-draft final version");
  assert.ok(revisionCheck.data.feedback.every((item) => secondDraft.toLocaleLowerCase().includes(item.quote.toLocaleLowerCase())), "second-draft feedback must quote only the second draft");
  assert.notEqual(revisionCheck.data.modelRevision.trim(), stress.data.modelRevision.trim(), "final version must be generated from the second draft rather than reused from the original analysis");

  const minimallyChangedDraft = `${stressDraft} c`;
  const minimalRevisionCheck = await post({
    phase: "revision",
    draft: minimallyChangedDraft,
    originalDraft: stressDraft,
    mode: "rewrite",
    goal: "复检只发生微小变化的第二稿",
    taskPrompt: "当前主题：教育与 AI",
    selfCheck: { mainPoint: "AI 可以帮助学生，但必须批判性使用。", weakness: "语言准确性不足", help: "全面检查" },
    priorFeedback: stress.data.feedback.map(({ category, quote, why, correction, confidence }) => ({ category: category.slice(0, 500), quote: quote.slice(0, 500), why: why.slice(0, 500), correction: correction.slice(0, 500), confidence })),
  });
  assert.equal(minimalRevisionCheck.response.status, 200, "minimal-change second-draft reanalysis failed");
  assert.ok(minimalRevisionCheck.data.revisionComparison.initialCount > 0, "comparison lost every valid initial issue");
  assert.ok(minimalRevisionCheck.data.revisionComparison.initialCount <= stress.data.feedback.length, "comparison created extra baseline issues");
  assert.equal(minimalRevisionCheck.data.revisionComparison.resolved.length, 0, "adding a trailing character should not mark unchanged problems as resolved");
  assert.ok(minimalRevisionCheck.data.revisionComparison.changedCount >= 1, "the new trailing-character problem was not assigned to the changed-text group");
  assert.ok(minimalRevisionCheck.data.feedback.length >= minimalRevisionCheck.data.revisionComparison.initialCount, "a valid unchanged issue disappeared after a trivial edit");
  assert.ok(minimalRevisionCheck.data.feedback.some((item) => item.category.includes("句子完整性") && item.quote.trim().toLocaleLowerCase().endsWith("c")), "new trailing character was not diagnosed");
  assertNoKnownObviousErrors(minimalRevisionCheck.data.modelRevision, "minimal-change final version");
  assert.ok(minimalRevisionCheck.data.feedback.every((item) => minimallyChangedDraft.toLocaleLowerCase().includes(item.quote.toLocaleLowerCase())), "minimal-change feedback contains an unlocatable quote");
  assertNoSameErrorDuplicates(minimalRevisionCheck.data.feedback, "minimal-change second-draft diagnosis");

  const comparisonOriginal = "People is often unsure about this. Last year, I did not understood why it mattered. AI can save time, but one wrong hallucination can spread fast. teh biggest impact may be that students stop thinking hard, and this do not always improves learning.";
  const comparisonInitial = await post({
    phase: "initial",
    draft: comparisonOriginal,
    mode: "coach",
    goal: "全面检查",
    taskPrompt: "当前主题：教育与 AI",
    selfCheck: { mainPoint: "AI 可能帮助学习，也可能产生风险。", weakness: "语言准确性不足", help: "全面检查" },
  });
  assert.equal(comparisonInitial.response.status, 200, "single-correction initial diagnosis failed");
  const correctedPeople = comparisonOriginal.replace("People is", "People are");
  const comparisonRevision = await post({
    phase: "revision",
    draft: correctedPeople,
    originalDraft: comparisonOriginal,
    mode: "rewrite",
    goal: "独立复检并比较修改",
    taskPrompt: "当前主题：教育与 AI",
    selfCheck: { mainPoint: "AI 可能帮助学习，也可能产生风险。", weakness: "语言准确性不足", help: "全面检查" },
    priorFeedback: comparisonInitial.data.feedback.map(({ category, quote, why, correction, confidence }) => ({ category, quote, why, correction, confidence })),
  });
  assert.equal(comparisonRevision.response.status, 200, "single-correction revision diagnosis failed");
  assert.ok(comparisonRevision.data.revisionComparison.resolved.some((item) => item.quote.toLocaleLowerCase() === "people is"), "the corrected agreement issue was not recorded as resolved");
  assert.ok(!comparisonRevision.data.feedback.some((item) => item.quote.toLocaleLowerCase() === "people is"), "the corrected agreement issue remained in the second draft");
  assert.ok(!comparisonRevision.data.feedback.some((item) => item.category.includes("句子完整性") && item.quote.includes("did not understood")), "a complete sentence was mislabelled as incomplete");
  assert.ok(!comparisonRevision.data.feedback.some((item) => item.category.includes("句子过长") && item.quote.trim().split(/\s+/).length < 30), "a short sentence was mislabelled as overlong");
  assert.ok(!comparisonInitial.data.feedback.some((item) => item.category.includes("拼写") && item.quote.trim().split(/\s+/).length > 4), "a broad sentence was mislabelled as a spelling error");
  const correctedSentenceIssue = comparisonRevision.data.feedback.find((item) => item.quote.toLocaleLowerCase() === "people are often unsure about this.");
  if (correctedSentenceIssue) assert.equal(correctedSentenceIssue.revisionStatus, "supplemental", "a latent issue in an almost unchanged sentence was incorrectly blamed on the revision");
  assert.ok(comparisonRevision.data.feedback.every((item) => ["remaining", "changed", "supplemental"].includes(item.revisionStatus)), "a revision issue was not assigned to a comparison group");

  console.log(`API checks passed against ${baseUrl}, including stress diagnosis, independent second-draft analysis, difference-aware comparison, and minimal-edit consistency.`);
} catch (error) {
  console.error(`API check failed against ${baseUrl}. Start the prototype before running this check.`);
  throw error;
}
