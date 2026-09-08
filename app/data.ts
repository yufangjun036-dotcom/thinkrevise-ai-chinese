export type TopicId = "education-ai" | "university" | "technology" | "environment" | "custom";
export type LevelId = "beginner" | "intermediate" | "challenge";
export type HelpMode = "coach" | "model" | "rewrite";

export type VocabularyItem = {
  word: string;
  definition: string;
  collocation: string;
  example: string;
  topics: TopicId[];
  level: LevelId;
};

import { keywordTranslations } from "./vocabulary-translations.generated.js";

const vocabularyTranslationMap = keywordTranslations as Record<string, string>;

// Custom descriptions are interpreted by the live topic-understanding route.
// These neutral terms are only an offline fallback when that route is unavailable;
// they must never be presented as a classification of the learner's topic.
export const customFallbackWords = [
  "perspective", "context", "pattern", "factor", "influence", "interaction", "identity", "experience", "community", "evidence",
  "implication", "practice", "representation", "access", "perception", "behaviour", "relationship", "change", "consequence", "diversity",
  "participation", "policy", "meaning", "environment", "process", "condition", "response", "tension", "value", "development",
];

export const topics = [
  {
    id: "education-ai" as const,
    label: "教育与 AI",
    prompt: "大学学习中的 AI 使用与判断",
  },
  {
    id: "university" as const,
    label: "大学生活",
    prompt: "课程、学习与校园生活",
  },
  {
    id: "technology" as const,
    label: "科技与社会",
    prompt: "数字工具与社会生活",
  },
  {
    id: "environment" as const,
    label: "环境与未来",
    prompt: "校园行动与可持续生活",
  },
  {
    id: "custom" as const,
    label: "自定义主题",
    prompt: "描述你真正感兴趣的方向，观点由你自己确定。",
  },
];

export const levels = [
  { id: "beginner" as const, label: "基础", count: 6, description: "常用词与清晰句型" },
  { id: "intermediate" as const, label: "进阶", count: 8, description: "学术连接与论证" },
  { id: "challenge" as const, label: "挑战", count: 10, description: "更精确的学术表达" },
];

export const helpModes = [
  {
    id: "coach" as const,
    name: "自主诊断修改",
    english: "Diagnose My Draft",
    description: "全面定位问题并解释修改方向，由你完成第二稿，不提供替代句。",
    learning: "学习参与度最高",
  },
  {
    id: "model" as const,
    name: "AI 局部协作",
    english: "Local AI Support",
    description: "先查看完整诊断；需要时展开单句或短语示例，再由你完成全文修改。",
    learning: "适合获得局部支架",
  },
  {
    id: "rewrite" as const,
    name: "直接完整改写",
    english: "Rewrite for Me",
    description: "AI 直接生成学术化版本；速度最快，但学习参与度最低。",
    learning: "编辑模式",
  },
];

export const demoDrafts: Record<TopicId, string> = {
  "education-ai": "Nowadays, AI is really good for university students. It gives a lot of feedback and students can finish work fast. For example, a student can ask a chatbot to improve an essay in a few seconds. But sometimes students just use the answer and do not think about whether it is correct. They may also accept invented information. Many students is using AI without checking the answer careful, and teh feedback can be confusing. I think universities should teach students how to evaluate AI feedback because it is important. This teaching can help students use technology in a responsible way and still develop their own judgement.",
  university: "University courses are really important for students. Students recieve a lot of information, but they sometimes just remember it for an exam and do not think independently. Students was often depends on teachers and they does not reflect about their learning. Last year, some students did not understood why reflection matters. I think courses should include a bunch of projects and discussions because these activities are good. Projects can ask students to make decisions, while reflection can help them notice how they learn. However, teachers should give clear goals and useful feedback. In this way, courses can prepare students for future work and help them become more independent learners.",
  technology: "Nowadays, digital tools are useful because people can finish tasks fast. Students can find many informations, organise notes, and communicate through one device. However, many people check their phones all the time and do not focus on difficult work. People is often relying on notifications, and it make concentration more difficult. These tools definately help with some things, but users may choose the first answer without evaluating it. I think technology companies and universities should help users develop better digital habits. Digital tools can improve efficiency, but users also need time without screens so that they can think carefully and make independent decisions.",
  environment: "I think universities should do more for the enviroment. Campuses use a lot of energy, and students also create much waste every day. Universities can add recycling bins and encourage public transport becuase these actions are good. Universities should reduces waste, but many students does not changed their daily habit. Some students did not understood why small choices matter. New facilities alone may not change behaviour. Students need to see evidence and understand the wider impact on the community. A clear campus plan could therefore connect practical changes with education and help everyone live more sustainably.",
  custom: "This topic is really important because it can influence people's daily choices. Some people is discussing it becuase they have went through different experiences, but they often describe the issue with vague things and say it is simply good or bad. I think a stronger discussion should explain who is affected, what evidence is available, and which conditions may change the result. People should evaluate different views before making a conclusion. They should also use a specific example and explain why it supports their position. This approach can make the argument clearer while allowing the writer to keep an independent judgement.",
};

export const demoMainPoints: Record<Exclude<TopicId, "custom">, string> = {
  "education-ai": "大学应该教学生批判性评估 AI 反馈，以保留独立判断。",
  university: "大学课程应通过项目、讨论和反思，培养学生成为更独立的学习者。",
  technology: "数字工具能够提高效率，但需要配合良好的使用习惯，才能保护深度思考。",
  environment: "大学应把校园设施改进与环境教育结合起来，推动学生形成可持续的生活方式。",
};

/**
 * The four curated topics use intentionally subject-specific keyword banks.
 * They are kept as plain words so the draw logic can attach a difficulty
 * level and the UI can show the same definition/collocation/example shape as
 * the original hand-written entries.
 */
export const curatedKeywordBank: Record<Exclude<TopicId, "custom">, string[]> = {
  "education-ai": `
    education learning learner teaching pedagogy curriculum classroom instructor student university assessment feedback tutoring literacy numeracy instruction coursework assignment seminar lecture workshop participation engagement motivation reflection revision knowledge concept reasoning comprehension retention mastery progress achievement attainment inclusion accessibility equity support scaffold guidance autonomy metacognition self-regulation collaboration discussion dialogue explanation questioning inquiry curiosity creativity critical-thinking problem-solving writing reading research citation plagiarism integrity authorship originality evaluation rubric grading moderation validity reliability formative summative diagnostic feedback-loop outcome competency proficiency benchmark intervention practice fluency misconception error correction translation language multilingual vocabulary grammar syntax pronunciation composition argument evidence source claim synthesis analysis inference discourse academic scholarly prompt chatbot algorithm artificial-intelligence machine-learning generative model language-model automation recommendation personalization adaptation prediction classification generation completion hallucination fabrication accuracy transparency explainability fairness bias discrimination privacy security consent governance accountability surveillance data dataset annotation calibration robustness safety misuse dependency overreliance agency judgement decision-making digital platform interface usability affordance notification dashboard analytics learning-analytics proctoring examination credential employability career lifelong open-education distance-learning blended online virtual asynchronous synchronous resource repository library tutor mentor peer community wellbeing workload culture policy institution administration stakeholder implementation training professional-development teacher educator facilitator ethics moral responsible equitable evidence-based human-centered co-design adoption resistance trust skepticism adaptive-learning instructional-design learning-objective peer-assessment learning-outcome
  `.trim().split(/\s+/),
  university: `
    campus undergraduate postgraduate degree major minor department faculty programme module course syllabus curriculum credit semester enrolment orientation freshman sophomore junior senior graduate lecturer professor tutor advisor supervisor registrar library laboratory dormitory residence accommodation scholarship tuition finance bursary internship placement career employability union society club volunteering leadership friendship wellbeing counselling healthcare accessibility disability inclusion diversity belonging identity community culture international exchange mobility migration language multilingual communication presentation seminar workshop lecture tutorial discussion debate project dissertation thesis research methodology literature-review framework hypothesis variable sample survey interview data analysis citation referencing plagiarism integrity ethics evidence argument conclusion reflection metacognition independent autonomy self-directed self-regulation time-management planning organisation workload deadline attendance participation engagement motivation procrastination concentration distraction device digital platform online hybrid asynchronous synchronous collaboration peer-review feedback revision draft writing reading comprehension vocabulary grammar fluency academic critical analytical creative problem-solving information-literacy media-literacy numeracy assessment examination grade mark rubric criteria formative summative diagnostic progression attainment retention completion dropout access equity social-mobility opportunity disadvantage deprivation support mentoring coaching induction transition adjustment resilience confidence stress anxiety burnout balance routine sleep nutrition exercise transport sustainability housing safety security policy governance administration stakeholder funding resource facility infrastructure innovation entrepreneurship enterprise workplace networking portfolio credential accreditation professional vocation citizenship civic global intercultural perspective worldview responsibility quality-assurance student-services research-impact community-engagement
  `.trim().split(/\s+/),
  technology: `
    technology digital software hardware computer device smartphone tablet network internet website platform application interface usability accessibility algorithm automation artificial-intelligence machine-learning model dataset database cloud server storage bandwidth protocol encryption authentication password privacy security cybersecurity malware phishing identity consent surveillance tracking data metadata analytics metric dashboard notification attention concentration distraction productivity efficiency convenience innovation adoption diffusion infrastructure broadband connectivity digital-divide access affordability inequality inclusion literacy competence skill training workforce employment labour occupation displacement reskilling entrepreneurship enterprise marketplace commerce consumption advertising marketing recommendation personalization filter ranking moderation misinformation disinformation propaganda polarization echo-chamber virality engagement audience creator influencer content media journalism copyright authorship plagiarism open-source licensing interoperability standard regulation governance accountability transparency explainability fairness bias discrimination ethics responsibility sustainability energy electricity carbon emissions e-waste lifecycle repair recycling datacenter cooling resource resilience reliability robustness scalability latency performance testing debugging deployment maintenance update version compatibility integration architecture design prototype experiment evidence evaluation validity impact consequence risk harm benefit wellbeing habit behaviour dependency overreliance autonomy agency judgement decision creativity reasoning learning education healthcare finance transport agriculture manufacturing robotics sensor internet-of-things wearable biometric geolocation telework remote virtual augmented immersive simulation blockchain cryptocurrency smart-contract quantum privacy-preserving anonymization pseudonymization consent-management datafication computational digitalization transformation participation community democracy citizenship public-service policy legislation compliance audit procurement stakeholder trust skepticism algorithmic accountability
  `.trim().split(/\s+/),
  environment: `
    environment sustainability sustainable climate weather warming greenhouse carbon emissions pollution air-quality water-quality wastewater contamination waste recycling reuse reduction landfill plastic packaging consumption production resource scarcity conservation biodiversity ecosystem habitat species wildlife forest woodland deforestation reforestation afforestation soil erosion agriculture farming irrigation drought flood wildfire disaster resilience adaptation mitigation renewable solar wind hydroelectric geothermal bioenergy electricity efficiency transport mobility vehicle cycling walking public-transit infrastructure building campus garden landscape urban rural city community household behaviour lifestyle awareness education stewardship policy governance regulation legislation compliance justice equity environmental-justice impact footprint lifecycle supply-chain circular-economy economy finance investment greenwashing certification standard indicator monitoring measurement data evidence research science model scenario projection target strategy action initiative programme campaign participation engagement stakeholder partnership cooperation treaty agreement vulnerability exposure risk hazard public-health wellbeing disease heat temperature rainfall sea-level ocean marine coastal coral wetland river watershed groundwater freshwater desalination salinity fisheries food-security nutrition compost organic pesticide fertilizer soil-health pollinator insect animal welfare ecosystem-services natural-capital restoration rewilding protected-area reserve national-park citizen-science indigenous knowledge culture ethics responsibility accountability transparency access affordability inequality transition decarbonization electrification net-zero carbon-neutral sequestration capture storage methane nitrous-oxide fossil-fuel coal oil gas battery grid demand food-system land-use biodiversity-loss climate-policy adaptation-planning carbon-budget climate-resilience ecosystem-fragmentation habitat-loss environmental-monitoring water-conservation renewable-generation
  `.trim().split(/\s+/),
};

const genericKeywordBlacklist = new Set(["the", "a", "an", "happy"]);

function createExpandedVocabulary(): VocabularyItem[] {
  const generated: VocabularyItem[] = [];
  for (const [topic, rawWords] of Object.entries(curatedKeywordBank) as [Exclude<TopicId, "custom">, string[]][]) {
    const words = [...new Set(rawWords.map((word) => word.toLowerCase()).filter((word) => !genericKeywordBlacklist.has(word)))];
    words.forEach((word, index) => {
      const level: LevelId = index < 90 ? "beginner" : index < 160 ? "intermediate" : "challenge";
      generated.push({
        word,
        definition: vocabularyTranslationMap[word] ?? "中文释义暂缺",
        collocation: `${word} in ${topic === "education-ai" ? "education" : topic === "university" ? "higher education" : topic}`,
        example: `The analysis examines ${word} and its implications in ${topic === "education-ai" ? "educational settings" : topic === "university" ? "university life" : `${topic} policy and practice`}.`,
        topics: [topic],
        level,
      });
    });
  }
  return generated;
}

export const vocabulary: VocabularyItem[] = [
  { word: "evaluate", definition: "判断某事物的质量或价值", collocation: "evaluate feedback", example: "Researchers evaluate the method before using it.", topics: ["education-ai", "university", "technology"], level: "beginner" },
  { word: "evidence", definition: "支持观点的事实或信息", collocation: "provide evidence", example: "The report provides evidence for the claim.", topics: ["education-ai", "university", "technology", "environment"], level: "beginner" },
  { word: "improve", definition: "使某事物变得更好", collocation: "improve performance", example: "Regular practice can improve performance.", topics: ["education-ai", "university", "technology", "environment"], level: "beginner" },
  { word: "responsible", definition: "对行为与结果负责的", collocation: "responsible use", example: "Responsible use requires careful judgement.", topics: ["education-ai", "technology", "environment"], level: "beginner" },
  { word: "access", definition: "获得或使用某物的机会", collocation: "equal access", example: "Every learner should have equal access to support.", topics: ["education-ai", "university", "technology"], level: "beginner" },
  { word: "support", definition: "帮助某人或促进某事", collocation: "support learning", example: "Clear examples can support learning.", topics: ["education-ai", "university"], level: "beginner" },
  { word: "reduce", definition: "使数量或程度降低", collocation: "reduce waste", example: "The new policy aims to reduce waste.", topics: ["technology", "environment", "university"], level: "beginner" },
  { word: "impact", definition: "对某事产生的影响", collocation: "positive impact", example: "The programme had a positive impact on participation.", topics: ["education-ai", "university", "technology", "environment"], level: "beginner" },
  { word: "community", definition: "拥有共同地点或利益的一群人", collocation: "university community", example: "The initiative involved the whole university community.", topics: ["university", "environment"], level: "beginner" },
  { word: "engage", definition: "积极参与或投入", collocation: "engage in learning", example: "Students engage more deeply when tasks feel relevant.", topics: ["education-ai", "university"], level: "intermediate" },
  { word: "however", definition: "用于引出转折观点", collocation: "however, it is important", example: "The tool is convenient; however, it has limitations.", topics: ["education-ai", "university", "technology", "environment"], level: "intermediate" },
  { word: "therefore", definition: "用于说明结果或结论", collocation: "therefore, institutions should", example: "The evidence is limited; therefore, caution is needed.", topics: ["education-ai", "university", "technology", "environment"], level: "intermediate" },
  { word: "independent", definition: "能够不依赖他人完成任务的", collocation: "independent learner", example: "Reflection can help students become independent learners.", topics: ["education-ai", "university"], level: "intermediate" },
  { word: "limitation", definition: "限制效果或适用范围的因素", collocation: "a key limitation", example: "A key limitation is the small sample size.", topics: ["education-ai", "technology", "environment"], level: "intermediate" },
  { word: "sustainable", definition: "能够长期维持且减少环境伤害的", collocation: "sustainable practice", example: "Public transport supports more sustainable travel.", topics: ["environment", "university"], level: "intermediate" },
  { word: "participation", definition: "参加某项活动的行为", collocation: "student participation", example: "Flexible tasks may increase student participation.", topics: ["university", "education-ai", "environment"], level: "intermediate" },
  { word: "privacy", definition: "个人信息不被不当获取的状态", collocation: "protect privacy", example: "Institutions must protect privacy when collecting data.", topics: ["education-ai", "technology"], level: "intermediate" },
  { word: "facilitate", definition: "使过程更容易或更顺利", collocation: "facilitate discussion", example: "The activity can facilitate meaningful discussion.", topics: ["education-ai", "university", "technology"], level: "challenge" },
  { word: "overreliance", definition: "对某事物的过度依赖", collocation: "overreliance on technology", example: "Overreliance on prompts may weaken independent judgement.", topics: ["education-ai", "technology"], level: "challenge" },
  { word: "metacognition", definition: "对自己思考与学习过程的认识", collocation: "develop metacognition", example: "Self-explanation can develop metacognition.", topics: ["education-ai", "university"], level: "challenge" },
  { word: "equitable", definition: "考虑不同需要并保证公平机会的", collocation: "equitable access", example: "The university should provide equitable access to resources.", topics: ["education-ai", "university", "technology"], level: "challenge" },
  { word: "consequently", definition: "因此；作为某事的结果", collocation: "consequently, learners may", example: "The instructions were unclear; consequently, learners made different assumptions.", topics: ["education-ai", "university", "technology", "environment"], level: "challenge" },
  { word: "mitigate", definition: "减轻问题的严重程度", collocation: "mitigate risk", example: "Clear safeguards can mitigate risk.", topics: ["education-ai", "technology", "environment"], level: "challenge" },
  { word: "autonomy", definition: "独立做决定和采取行动的能力", collocation: "learner autonomy", example: "The design should preserve learner autonomy.", topics: ["education-ai", "university", "technology"], level: "challenge" },
  { word: "long-term", definition: "持续较长时间的", collocation: "long-term effect", example: "The long-term effect remains uncertain.", topics: ["education-ai", "university", "technology", "environment"], level: "challenge" },
  ...createExpandedVocabulary(),
];

export function pickVocabulary(topic: TopicId, level: LevelId) {
  const count = levels.find((item) => item.id === level)?.count ?? 8;
  const allowedLevels: LevelId[] =
    level === "beginner" ? ["beginner"] : level === "intermediate" ? ["beginner", "intermediate"] : ["beginner", "intermediate", "challenge"];
  if (topic === "custom") {
    const words = [...customFallbackWords].sort(() => Math.random() - 0.5);
    const customPool = words.map((word, index) => ({
      word,
      definition: vocabularyTranslationMap[word] ?? "中文释义暂缺",
      collocation: `the role of ${word}`,
      example: `The discussion examines the role of ${word} in this context.`,
      topics: ["custom" as const],
      level: index < 6 ? "beginner" as const : index < 8 ? "intermediate" as const : "challenge" as const,
    }));
    return customPool.filter((item) => allowedLevels.includes(item.level)).slice(0, count);
  }
  const pool = [...new Map(
    vocabulary
      .filter((item) => item.topics.includes(topic) && allowedLevels.includes(item.level))
      .map((item) => [item.word, item]),
  ).values()];
  // Every call starts a new independent draw. Previous rounds are deliberately
  // not passed in, so a later round may naturally contain earlier words again.
  return [...pool].sort(() => Math.random() - 0.5).slice(0, Math.min(count, pool.length));
}

export function buildDemoDraft(topic: TopicId, words: VocabularyItem[]) {
  const base = topic === "custom"
    ? demoDrafts.custom
    : demoDrafts[topic];
  const vocabularyParagraph = words.map((item) => demoWordSentence(item.word)).join(" ");
  return cleanDemoDraft(vocabularyParagraph ? `${base}\n\n${vocabularyParagraph}` : base);
}

const fastDemoPhrases: Record<string, string> = {
  evaluate: "Readers should evaluate the feedback before accepting it.",
  evidence: "The argument should check the evidence behind each claim.",
  improve: "Careful revision can improve the quality of the result.",
  responsible: "Responsible use requires attention to possible consequences.",
  access: "Equal access can shape who benefits from the proposal.",
  support: "This form of support may strengthen independent thinking.",
  reduce: "A practical policy could reduce the problem over time.",
  impact: "The analysis should explain the wider impact on the community.",
  community: "The community may experience both benefits and pressures.",
  engage: "Relevant examples can help readers engage with the issue.",
  however: "However, the discussion should acknowledge an important limitation.",
  therefore: "Therefore, the conclusion should follow from the available evidence.",
  independent: "Reflection can help learners make an independent decision.",
  limitation: "A balanced paragraph should acknowledge one limitation.",
  sustainable: "The proposal should encourage a more sustainable practice.",
  participation: "Participation may change when people see that the issue matters.",
  privacy: "Any digital system must protect privacy during data collection.",
  facilitate: "A clear activity can facilitate more careful discussion.",
  overreliance: "Overreliance on a tool may weaken independent judgement.",
  metacognition: "Self-explanation can develop metacognition during revision.",
  equitable: "An equitable design should respond to different needs.",
  consequently: "Consequently, the final claim should be expressed with caution.",
  mitigate: "Clear safeguards can mitigate avoidable risks.",
  autonomy: "The learning process should preserve learner autonomy.",
  "long-term": "The long-term effects should be considered before a conclusion.",
  idol: "An idol can influence how young audiences understand identity.",
  stage: "The stage can become a space for cultural expression.",
  performance: "A performance may communicate values more powerfully than an explanation.",
  audience: "The audience interprets the message through its own experience.",
  influence: "This influence can affect attitudes and everyday choices.",
  habitat: "Protecting the habitat can support several vulnerable species.",
  species: "Each species responds differently to environmental pressure.",
  biodiversity: "Biodiversity can decline when a single land use dominates.",
  conservation: "Conservation requires cooperation between residents and institutions.",
  journey: "The journey provides a useful example of changing expectations.",
  destination: "The destination can shape how travellers understand local culture.",
  culture: "Culture influences how people interpret unfamiliar experiences.",
  experience: "A personal experience can motivate a broader question.",
};

const fastDemoFallbackTemplates = [
  (word: string) => `The article treats ${word} as one factor in the debate.`,
  (word: string) => `The writer links ${word} to the choices under discussion.`,
  (word: string) => `The available evidence should clarify how ${word} affects the outcome.`,
  (word: string) => `A limitation is that ${word} may differ across groups.`,
];

const fastDemoOpenings: Record<TopicId, string> = {
  "education-ai": "AI feedback can shape student learning.",
  university: "University courses shape student learning.",
  technology: "Digital tools shape everyday decisions.",
  environment: "Campus choices affect the environment.",
  custom: "This topic influences everyday choices.",
};

export function buildFastDemoDraft(topic: TopicId, words: VocabularyItem[]) {
  const base = topic === "custom" ? demoDrafts.custom : demoDrafts[topic];
  const sentences = base.match(/[^.!?]+[.!?]/g) ?? [base];
  const openingParts: string[] = [];
  let openingWords = 0;
  // Eight-word intermediate drafts can be just as long as ten-word challenge
  // drafts when the selected terms need longer explanatory phrases.
  const openingLimit = words.length >= 8 ? 12 : 42;
  for (const sentence of sentences) {
    const sentenceWords = sentence.trim().split(/\s+/).length;
    if (openingParts.length > 0 && openingWords + sentenceWords > openingLimit) break;
    openingParts.push(sentence.trim());
    openingWords += sentenceWords;
  }
  const opening = words.length >= 8 ? fastDemoOpenings[topic] : openingParts.join(" ");
  const clauses = words.map(({ word }, index) => fastDemoPhrases[word] ?? fastDemoFallbackTemplates[index % fastDemoFallbackTemplates.length](word));
  const compactTargetParagraph = `${clauses.join(" ")} However, this plan is really good, so one lesson may solve the problem. People is unsure. Last year, I did not understood why. The answer can sound academic, but teh conclusion is not checked.`;
  return cleanDemoDraft(`${opening} ${compactTargetParagraph}`);
}

function demoWordSentence(word: string) {
  const sentences: Record<string, string> = {
    evidence: "The writer should use evidence to support each central claim.",
    access: "The discussion should explain how access affects different learners.",
    engage: "Relevant examples can help readers engage with the issue.",
    evaluate: "Readers should evaluate the reliability of each claim.",
    improve: "Clear feedback can improve the quality of the final decision.",
    reduce: "Practical action may reduce the problem over time.",
    support: "This approach can support more informed choices.",
    responsible: "Responsible practice requires attention to consequences.",
    participation: "Participation can change when people feel that the topic matters.",
    impact: "The analysis should explain the wider impact on people and communities.",
    community: "The community may experience both benefits and pressures.",
    privacy: "Privacy should be protected when personal information is involved.",
    independent: "The goal is to help learners make independent judgements.",
    limitation: "A balanced paragraph should acknowledge at least one limitation.",
    sustainable: "A sustainable approach considers long-term effects.",
    autonomy: "Learner autonomy grows when people can justify their own decisions.",
    overreliance: "The discussion should also recognise the risk of overreliance on technology.",
    metacognition: "Reflection can develop metacognition and improve future learning.",
    facilitate: "Well-designed activities can facilitate careful discussion.",
    mitigate: "Clear safeguards can mitigate avoidable risks.",
    equitable: "An equitable solution should respond to different needs.",
    consequently: "Consequently, the conclusion should follow from the evidence.",
    therefore: "Therefore, the final claim should be expressed with appropriate caution.",
    however: "However, a strong discussion should acknowledge an alternative perspective.",
    "long-term": "The long-term effects should be considered before a conclusion is reached.",
    idol: "An idol can shape how young audiences understand identity.",
    stage: "The stage can become a space for cultural expression.",
    performance: "A performance may communicate values more powerfully than an explanation.",
    audience: "The audience interprets the message through its own experience.",
    influence: "This influence can affect attitudes and everyday choices.",
    fandom: "Fandom can create belonging while also encouraging strong group expectations.",
    industry: "The industry sets commercial conditions for creative work.",
    representation: "Representation affects whose experiences are visible in public culture.",
  };
  return sentences[word] ?? `The discussion should also explain the role of ${word} in this context.`;
}

export function cleanDemoDraft(draft: string) {
  return draft
    .replace(/\n{1,2}Key terms for this draft (?:are|include):[\s\S]*$/i, "")
    .replace(/\n{1,2}目标词[^\n]*：?[\s\S]*$/i, "")
    .trim();
}

export function getDemoMainPoint(topic: TopicId, customDescription = "") {
  if (topic !== "custom") return demoMainPoints[topic];
  return customDescription.trim()
    ? `这个主题会影响人们的选择和经验，文章将从不同角度分析它的影响与意义。`
    : "这篇文章将提出一个清楚的中心观点，并用原因和例子支持它。";
}
