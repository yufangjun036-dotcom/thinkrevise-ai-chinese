"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import Image from "next/image";
import Link from "next/link";
import { buildDemoDraft, buildFastDemoDraft, cleanDemoDraft, getDemoMainPoint, helpModes, levels, pickVocabulary, topics, type HelpMode, type LevelId, type TopicId, type VocabularyItem } from "./data";
import { mediaConfig } from "./site-config";
import { countNonWhitespaceCharacters, limitNonWhitespaceCharacters, MAX_RAW_DRAFT_CHARACTERS } from "./text-limits";

type Path = "practice" | "revision";
type Stage = "home" | "setup" | "draft" | "feedback" | "revise" | "reflect";
type RevisionStatus = "remaining" | "changed" | "supplemental";
type FeedbackItem = { category: string; quote: string; why: string; correction?: string; question?: string; hints?: string[]; suggestion?: string; confidence: "高" | "中" | "低"; revisionStatus?: RevisionStatus };
type RevisionComparison = { initialCount: number; resolved: Array<Pick<FeedbackItem, "category" | "quote">>; remainingCount: number; changedCount: number; supplementalCount: number };
type CoachResponse = { summary: string; feedback: FeedbackItem[]; modelRevision: string; overview: string[]; meaningRisk: string; provider: "openai" | "demo"; fallbackNotice?: string; revisionComparison?: RevisionComparison };
type CustomTopicResult = { inferredDirection: string; words: Array<Pick<VocabularyItem, "word" | "definition" | "collocation" | "example">>; provider: "openai" };

function isCoachResponse(value: unknown): value is CoachResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<CoachResponse>;
  return typeof candidate.summary === "string"
    && Array.isArray(candidate.feedback)
    && typeof candidate.modelRevision === "string"
    && (candidate.provider === "openai" || candidate.provider === "demo");
}

async function readJsonResponse<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    throw new Error("服务返回的内容格式异常，请重试；你的文章仍保留在当前页面。");
  }
}

function apiRequestHeaders() {
  const key = "thinkrevise-anonymous-session";
  const legacyKey = "revisioncoach-anonymous-session";
  let session = window.sessionStorage.getItem(key) ?? window.sessionStorage.getItem(legacyKey);
  if (!session) {
    const bytes = new Uint8Array(16);
    if (window.crypto?.getRandomValues) window.crypto.getRandomValues(bytes);
    else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0"));
    session = `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
    window.sessionStorage.setItem(key, session);
  }
  if (!window.sessionStorage.getItem(key)) window.sessionStorage.setItem(key, session);
  return { "Content-Type": "application/json", "X-ThinkRevise-Session": session };
}

const revisionLoopSlides = [
  {
    label: "原始想法",
    sample: "Online learning is useful for university students...",
    note: "先写下自己的观点，不追求第一稿完美。",
  },
  {
    label: "AI 诊断",
    sample: "“useful” 的含义较宽泛，读者还不知道具体益处。",
    note: "AI 定位问题并解释原因，但不替你完成思考。",
  },
  {
    label: "学生修改",
    sample: "Online learning gives students more flexible access...",
    note: "根据反馈，用自己的语言把观点写得更具体。",
  },
  {
    label: "完成与反思",
    sample: "Online learning can widen access by reducing limits of time and place.",
    note: "比较修改前后，总结可以迁移到下次写作的原则。",
  },
] as const;

const DEFAULT_GOAL = "澄清并聚焦中心论点";
const DEFAULT_WEAKNESS = "";
const SESSION_RECOVERY_KEY = "thinkrevise-session-v1";
const LEGACY_SESSION_RECOVERY_KEY = "revisioncoach-session-v1";

type HighlightRange = { start: number; end: number; issueIndexes: number[] };

function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function limitWords(text: string, maximum: number) {
  const matches = Array.from(text.matchAll(/\S+/g));
  if (matches.length <= maximum) return text;
  const lastWord = matches[maximum - 1];
  return text.slice(0, (lastWord.index ?? 0) + lastWord[0].length);
}

function findHighlightRanges(text: string, feedback: FeedbackItem[]) {
  const lowerText = text.toLocaleLowerCase();
  const ranges: HighlightRange[] = [];

  feedback.forEach((item, issueIndex) => {
    const quote = item.quote.trim().replace(/^[“”"']+|[“”"']+$/g, "");
    if (quote.length < 2) return;
    const lowerQuote = quote.toLocaleLowerCase();
    let searchFrom = 0;
    while (searchFrom < lowerText.length) {
      const start = lowerText.indexOf(lowerQuote, searchFrom);
      if (start === -1) break;
      ranges.push({ start, end: start + quote.length, issueIndexes: [issueIndex] });
      searchFrom = start + Math.max(quote.length, 1);
    }
  });

  return ranges
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .reduce<HighlightRange[]>((merged, range) => {
      const previous = merged.at(-1);
      if (previous && range.start < previous.end) {
        previous.end = Math.max(previous.end, range.end);
        previous.issueIndexes = Array.from(new Set([...previous.issueIndexes, ...range.issueIndexes]));
      } else merged.push({ ...range, issueIndexes: [...range.issueIndexes] });
      return merged;
    }, []);
}

function HighlightedDraft({ text, feedback }: { text: string; feedback: FeedbackItem[] }) {
  const ranges = findHighlightRanges(text, feedback);
  if (ranges.length === 0) return <>{text}</>;

  const content: ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) content.push(text.slice(cursor, range.start));
    content.push(<mark className="draft-error-mark" key={`${range.start}-${range.end}`} title="AI 标记的问题位置">{text.slice(range.start, range.end)}</mark>);
    cursor = range.end;
  }
  if (cursor < text.length) content.push(text.slice(cursor));
  return <>{content}</>;
}

function InteractiveHighlightedDraft({
  text,
  feedback,
  activeIssue,
  pinnedIssue,
  onShowIssue,
  onPinIssue,
  onDismiss,
  issueRefs,
}: {
  text: string;
  feedback: FeedbackItem[];
  activeIssue: number | null;
  pinnedIssue: number | null;
  onShowIssue: (index: number | null) => void;
  onPinIssue: (index: number) => void;
  onDismiss: () => void;
  issueRefs: RefObject<Map<number, HTMLButtonElement>>;
}) {
  const ranges = findHighlightRanges(text, feedback);
  if (ranges.length === 0) return <>{text}</>;

  const content: ReactNode[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) content.push(text.slice(cursor, range.start));
    const issueIndex = range.issueIndexes.includes(activeIssue ?? -1) ? activeIssue! : range.issueIndexes[0];
    const item = feedback[issueIndex];
    const isOpen = activeIssue !== null && range.issueIndexes.includes(activeIssue);
    content.push(
      <span className="draft-error-wrap" key={`${range.start}-${range.end}`} onMouseEnter={() => { if (pinnedIssue === null) onShowIssue(range.issueIndexes[0]); }} onMouseLeave={() => { if (pinnedIssue === null) onShowIssue(null); }}>
        <button
          type="button"
          className={`draft-error-mark interactive ${isOpen ? "active" : ""}`}
          ref={(node) => {
            if (node) for (const index of range.issueIndexes) {
              if (!issueRefs.current.has(index)) issueRefs.current.set(index, node);
            }
          }}
          aria-label={`查看问题：${range.issueIndexes.map((index) => feedback[index].category).join("、")}`}
          aria-expanded={isOpen}
          onFocus={() => { if (pinnedIssue === null) onShowIssue(range.issueIndexes[0]); }}
          onBlur={() => { if (pinnedIssue === null) onShowIssue(null); }}
          onClick={() => onPinIssue(issueIndex)}
        >
          {text.slice(range.start, range.end)}
        </button>
        {isOpen && item && <span className="inline-issue-popover" role="dialog" aria-label={`问题 ${issueIndex + 1} 的修改提示`}>
          <span className="inline-issue-heading"><strong>问题 {issueIndex + 1} / {feedback.length} · {item.category}</strong><button type="button" onClick={onDismiss} aria-label="关闭修改提示">×</button></span>
          <span className="inline-issue-copy">{item.why}</span>
          <span className="inline-issue-label">修改方向</span>
          <span className="inline-issue-copy correction">{item.correction || "请根据诊断，用自己的语言完成修改。"}</span>
          {range.issueIndexes.length > 1 && <small>这一位置关联 {range.issueIndexes.length} 项问题；可用上方问题导航逐项查看。</small>}
          <em>{pinnedIssue === issueIndex ? "提示已固定，修改右侧文字时不会消失。" : "点击红线可固定此提示。"}</em>
        </span>}
      </span>,
    );
    cursor = range.end;
  }
  if (cursor < text.length) content.push(text.slice(cursor));
  return <>{content}</>;
}

function ArrowIcon({ back = false }: { back?: boolean }) {
  return <svg className={back ? "back-icon" : ""} viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" /></svg>;
}

function SparkIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8c.7 4.9 3.3 7.5 8.2 8.2-4.9.7-7.5 3.3-8.2 8.2-.7-4.9-3.3-7.5-8.2-8.2 4.9-.7 7.5-3.3 8.2-8.2Z" /></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>;
}

function Brand({ compact = false }: { compact?: boolean }) {
  return <button className="brand brand-button" type="button" onClick={() => { window.sessionStorage.removeItem(SESSION_RECOVERY_KEY); window.sessionStorage.removeItem(LEGACY_SESSION_RECOVERY_KEY); window.location.reload(); }} aria-label="返回首页并重新开始"><span className="brand-mark">T</span><span><strong>ThinkRevise</strong>{!compact && <small>AI 学术英语教练</small>}</span></button>;
}

function Progress({ stage, helpMode }: { stage: Stage; helpMode: HelpMode }) {
  if (helpMode === "rewrite") {
    const stages: Stage[] = ["setup", "draft", "revise"];
    const labels = ["选择模式", "填写初稿", "查看改写"];
    const index = Math.max(0, stages.indexOf(stage));
    return <div className="step-progress" aria-label={`当前步骤：${labels[index]}`}><div className="step-progress-copy"><span>编辑进度</span><strong>{index + 1} / 3 · {labels[index]}</strong></div><div className="step-progress-track"><span style={{ width: `${((index + 1) / 3) * 100}%` }} /></div></div>;
  }
  const stages: Stage[] = ["setup", "draft", "feedback", "revise", "reflect"];
  const labels = ["设置任务", "完成初稿", "理解反馈", "亲自修改", "复检反思"];
  const index = Math.max(0, stages.indexOf(stage));
  return <div className="step-progress" aria-label={`当前步骤：${labels[index]}`}><div className="step-progress-copy"><span>学习进度</span><strong>{index + 1} / 5 · {labels[index]}</strong></div><div className="step-progress-track"><span style={{ width: `${((index + 1) / 5) * 100}%` }} /></div></div>;
}

export default function CoachWorkspace() {
  const [stage, setStage] = useState<Stage>("home");
  const [path, setPath] = useState<Path>("practice");
  const [topic, setTopic] = useState<TopicId>("education-ai");
  const [customTopic, setCustomTopic] = useState("");
  const [customQuestion, setCustomQuestion] = useState("");
  const [customInterpretation, setCustomInterpretation] = useState<Pick<CustomTopicResult, "inferredDirection"> | null>(null);
  const [level, setLevel] = useState<LevelId>("intermediate");
  const [words, setWords] = useState<VocabularyItem[]>([]);
  const [openWord, setOpenWord] = useState<string | null>(null);
  const [helpMode, setHelpMode] = useState<HelpMode>("coach");
  const [goal, setGoal] = useState(DEFAULT_GOAL);
  const [draft, setDraft] = useState("");
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [isResolvingTopic, setIsResolvingTopic] = useState(false);
  const [demoNotice, setDemoNotice] = useState("");
  const lastDemo = useRef("");
  const demoRequest = useRef(0);
  const topicController = useRef<AbortController | null>(null);
  const demoDraftController = useRef<AbortController | null>(null);
  const feedbackController = useRef<AbortController | null>(null);
  const revisionController = useRef<AbortController | null>(null);
  const [selfCheck, setSelfCheck] = useState({ mainPoint: "", strongest: "", weakness: DEFAULT_WEAKNESS, help: DEFAULT_GOAL });
  const [response, setResponse] = useState<CoachResponse | null>(null);
  const [revisionResponse, setRevisionResponse] = useState<CoachResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);
  const [error, setError] = useState("");
  const [revisionError, setRevisionError] = useState("");
  const [revisedDraft, setRevisedDraft] = useState("");
  const [finalDraft, setFinalDraft] = useState("");
  const [reflection, setReflection] = useState("");
  const [recordCopied, setRecordCopied] = useState(false);
  const [activeIssue, setActiveIssue] = useState<number | null>(null);
  const [pinnedIssue, setPinnedIssue] = useState<number | null>(null);
  const [loopStep, setLoopStep] = useState(0);
  const loopDragStartX = useRef<number | null>(null);
  const draftRef = useRef("");
  const issueRefs = useRef(new Map<number, HTMLButtonElement>());
  const [recoveryReady, setRecoveryReady] = useState(false);

  const selectedTopic = topics.find((item) => item.id === topic) ?? topics[0];
  const activeTopicLabel = topic === "custom" ? customInterpretation?.inferredDirection || "自定义方向" : selectedTopic.label;
  const topicContext = topic === "custom"
    ? `学习者描述的主题：${customTopic.trim() || activeTopicLabel}。系统理解方向：${activeTopicLabel}`
    : `当前主题：${activeTopicLabel}`;
  const canContinueSetup = path !== "practice" || topic !== "custom" || Boolean(customTopic.trim());
  const draftWordCount = useMemo(() => countWords(draft), [draft]);
  const revisedWordCount = useMemo(() => countWords(revisedDraft), [revisedDraft]);
  const draftNonWhitespaceCount = useMemo(() => countNonWhitespaceCharacters(draft), [draft]);
  const revisedNonWhitespaceCount = useMemo(() => countNonWhitespaceCharacters(revisedDraft), [revisedDraft]);
  const usedWords = useMemo(() => new Set(words
    .filter((item) => new RegExp(`(^|[^A-Za-z])${item.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^A-Za-z]|$)`, "i").test(draft))
    .map((item) => item.word)), [draft, words]);

  function updateDraft(value: string) {
    const nextValue = path === "practice" ? limitWords(value, 300) : limitNonWhitespaceCharacters(value);
    draftRef.current = nextValue;
    setDraft(nextValue);
  }

  function updateRevisedDraft(value: string) {
    setRevisedDraft(path === "practice" ? limitWords(value, 300) : limitNonWhitespaceCharacters(value));
    setRevisionError("");
  }

  function showIssue(index: number, pin = false) {
    const normalized = response?.feedback.length ? (index + response.feedback.length) % response.feedback.length : 0;
    setActiveIssue(normalized);
    setPinnedIssue(pin ? normalized : null);
    window.requestAnimationFrame(() => {
      const mark = issueRefs.current.get(normalized);
      mark?.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      mark?.focus({ preventScroll: true });
    });
  }

  function dismissIssue() {
    setActiveIssue(null);
    setPinnedIssue(null);
  }

  function moveLoop(direction: -1 | 1) {
    setLoopStep((current) => (current + direction + revisionLoopSlides.length) % revisionLoopSlides.length);
  }

  function finishLoopDrag(clientX: number) {
    if (loopDragStartX.current === null) return;
    const distance = clientX - loopDragStartX.current;
    loopDragStartX.current = null;
    if (Math.abs(distance) < 42) return;
    moveLoop(distance < 0 ? 1 : -1);
  }

  useEffect(() => {
    let saved: Record<string, unknown> | null = null;
    try {
      const raw = window.sessionStorage.getItem(SESSION_RECOVERY_KEY)
        ?? window.sessionStorage.getItem(LEGACY_SESSION_RECOVERY_KEY);
      if (raw) saved = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      window.sessionStorage.removeItem(SESSION_RECOVERY_KEY);
      window.sessionStorage.removeItem(LEGACY_SESSION_RECOVERY_KEY);
    }
    window.queueMicrotask(() => {
      if (saved?.version === 1 && typeof saved.stage === "string" && saved.stage !== "home") {
          const savedDraft = typeof saved.draft === "string" ? limitNonWhitespaceCharacters(saved.draft) : "";
          const savedResponse = isCoachResponse(saved.response) ? saved.response : null;
          const savedRevisionResponse = isCoachResponse(saved.revisionResponse) ? saved.revisionResponse : null;
          const requestedStage = ["setup", "draft", "feedback", "revise", "reflect"].includes(saved.stage) ? saved.stage as Stage : "draft";
          const restoredStage = requestedStage === "reflect" && !savedRevisionResponse
            ? (savedResponse ? "revise" : "draft")
            : (requestedStage === "feedback" || requestedStage === "revise") && !savedResponse
              ? "draft"
              : requestedStage;
          draftRef.current = savedDraft;
          setDraft(savedDraft);
          if (saved.path === "practice" || saved.path === "revision") setPath(saved.path);
          if (topics.some((item) => item.id === saved.topic)) setTopic(saved.topic as TopicId);
          if (levels.some((item) => item.id === saved.level)) setLevel(saved.level as LevelId);
          if (helpModes.some((item) => item.id === saved.helpMode)) setHelpMode(saved.helpMode as HelpMode);
          setStage(restoredStage);
          if (typeof saved.customTopic === "string") setCustomTopic(saved.customTopic);
          if (typeof saved.customQuestion === "string") setCustomQuestion(saved.customQuestion);
          if (saved.customInterpretation && typeof saved.customInterpretation === "object") setCustomInterpretation(saved.customInterpretation as Pick<CustomTopicResult, "inferredDirection">);
          if (Array.isArray(saved.words)) setWords(saved.words as VocabularyItem[]);
          if (typeof saved.goal === "string") setGoal(saved.goal);
          if (saved.selfCheck && typeof saved.selfCheck === "object") setSelfCheck(saved.selfCheck as typeof selfCheck);
          setResponse(savedResponse);
          setRevisionResponse(savedRevisionResponse);
          if (typeof saved.revisedDraft === "string") setRevisedDraft(limitNonWhitespaceCharacters(saved.revisedDraft));
          if (typeof saved.finalDraft === "string") setFinalDraft(limitNonWhitespaceCharacters(saved.finalDraft));
          if (typeof saved.reflection === "string") setReflection(saved.reflection.slice(0, 1000));
          setDemoNotice("已恢复本标签页刷新前的写作进度。请核对内容后继续。");
      }
      setRecoveryReady(true);
    });
  }, []);

  useEffect(() => {
    if (!recoveryReady) return;
    if (stage === "home" && !draft && !revisedDraft) {
      window.sessionStorage.removeItem(SESSION_RECOVERY_KEY);
      return;
    }
    try {
      window.sessionStorage.setItem(SESSION_RECOVERY_KEY, JSON.stringify({
        version: 1, stage, path, topic, customTopic, customQuestion, customInterpretation,
        level, words, helpMode, goal, draft, selfCheck, response, revisionResponse,
        revisedDraft, finalDraft, reflection,
      }));
      window.sessionStorage.removeItem(LEGACY_SESSION_RECOVERY_KEY);
    } catch {
      // Storage can be disabled or full. The active page remains usable.
    }
  }, [recoveryReady, stage, path, topic, customTopic, customQuestion, customInterpretation, level, words, helpMode, goal, draft, selfCheck, response, revisionResponse, revisedDraft, finalDraft, reflection]);

  useEffect(() => () => {
    topicController.current?.abort();
    demoDraftController.current?.abort();
    feedbackController.current?.abort();
    revisionController.current?.abort();
  }, []);

  useEffect(() => {
    const modelContext = (document as Document & {
      modelContext?: {
        registerTool: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void>;
      };
    }).modelContext;
    if (!modelContext?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(modelContext.registerTool({
      name: "start_revision_session",
      title: "开始英语修改练习",
      description: "在当前页面开始主题写作练习或学术英语修改流程。",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string", enum: ["practice", "revision"] } },
        required: ["path"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input: unknown) {
        const value = input as { path?: unknown };
        if (value.path !== "practice" && value.path !== "revision") throw new Error("path 必须是 practice 或 revision");
        draftRef.current = "";
        setDraft("");
        setIsResolvingTopic(false);
        setSelfCheck({ mainPoint: "", strongest: "", weakness: DEFAULT_WEAKNESS, help: DEFAULT_GOAL });
        setWords([]);
        setCustomInterpretation(null);
        setOpenWord(null);
        setResponse(null);
        setRevisionResponse(null);
        setError("");
        setRevisionError("");
        setRevisedDraft("");
        setFinalDraft("");
        setReflection("");
        setRecordCopied(false);
        dismissIssue();
        issueRefs.current.clear();
        setPath(value.path);
        if (value.path === "practice") setHelpMode("coach");
        setStage("setup");
        window.scrollTo({ top: 0, behavior: "smooth" });
        return { status: "ready", path: value.path, visibleStage: "setup" };
      },
    }, { signal: lifecycle.signal })).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  function resetLearningWork() {
    demoRequest.current += 1;
    topicController.current?.abort();
    topicController.current = null;
    demoDraftController.current?.abort();
    demoDraftController.current = null;
    feedbackController.current?.abort();
    feedbackController.current = null;
    revisionController.current?.abort();
    revisionController.current = null;
    setIsLoading(false);
    setIsReanalyzing(false);
    setIsGeneratingDemo(false);
    setIsResolvingTopic(false);
    setDemoNotice("");
    lastDemo.current = "";
    setCustomInterpretation(null);
    updateDraft("");
    setSelfCheck({ mainPoint: "", strongest: "", weakness: DEFAULT_WEAKNESS, help: DEFAULT_GOAL });
    setWords([]);
    setOpenWord(null);
    setResponse(null);
    setRevisionResponse(null);
    setError("");
    setRevisionError("");
    setRevisedDraft("");
    setFinalDraft("");
    setReflection("");
    setRecordCopied(false);
    dismissIssue();
    issueRefs.current.clear();
  }

  function selectTopic(nextTopic: TopicId) {
    if (nextTopic !== topic) resetLearningWork();
    setTopic(nextTopic);
  }

  function selectLevel(nextLevel: LevelId) {
    if (nextLevel !== level) resetLearningWork();
    setLevel(nextLevel);
  }

  function updateCustomTopic(value: string) {
    if (draft || response) resetLearningWork();
    setCustomInterpretation(null);
    setCustomTopic(value);
  }

  function updateCustomQuestion(value: string) {
    if (draft || response) resetLearningWork();
    setCustomInterpretation(null);
    setCustomQuestion(value);
  }

  function startPath(nextPath: Path) {
    resetLearningWork();
    setPath(nextPath);
    if (nextPath === "practice") setHelpMode("coach");
    setStage("setup"); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function resolveCustomTopic() {
    if (topicController.current) return false;
    const description = customTopic.trim();
    if (description.length < 6) {
      setError("请至少用几句话描述你真正想写的方向。");
      return false;
    }
    const requestId = ++demoRequest.current;
    const controller = new AbortController();
    topicController.current = controller;
    setIsResolvingTopic(true);
    setError("");
    try {
      const result = await fetch("/api/custom-topic", {
        method: "POST",
        signal: controller.signal,
        headers: apiRequestHeaders(),
        body: JSON.stringify({ description, question: customQuestion.trim(), level, count: levels.find((item) => item.id === level)?.count ?? 8, variation: `request-${requestId}` }),
      });
      const data = await readJsonResponse<Partial<CustomTopicResult> & { error?: string }>(result);
      if (requestId !== demoRequest.current) return false;
      if (!result.ok) throw new Error(data.error || "暂时无法理解这个方向。");
      if (data.provider !== "openai" || typeof data.inferredDirection !== "string" || !Array.isArray(data.words)) {
        throw new Error("主题理解结果不完整，请重试。");
      }
      const mappedWords: VocabularyItem[] = data.words.map((item, index) => ({
        ...item,
        topics: ["custom" as const],
        level: index < 6 ? "beginner" as const : index < 8 ? "intermediate" as const : "challenge" as const,
      }));
      if (mappedWords.length < (levels.find((item) => item.id === level)?.count ?? 8)) throw new Error("主题目标词数量不足，请重试。");
      setCustomInterpretation({ inferredDirection: data.inferredDirection });
      setWords(mappedWords);
      return true;
    } catch (requestError) {
      if (requestId !== demoRequest.current) return false;
      if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "暂时无法理解这个方向，请稍后重试。");
      return false;
    } finally {
      if (topicController.current === controller) topicController.current = null;
      if (requestId === demoRequest.current) setIsResolvingTopic(false);
    }
  }

  async function beginDraft() {
    if (!canContinueSetup) return;
    setError("");
    if (path === "practice") {
      if (topic === "custom") {
        const understood = await resolveCustomTopic();
        if (!understood) return;
      } else {
        setWords(pickVocabulary(topic, level));
      }
    }
    setStage("draft");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function redrawWords() {
    if (topicController.current) return;
    demoRequest.current += 1;
    demoDraftController.current?.abort();
    demoDraftController.current = null;
    setIsGeneratingDemo(false);
    setError("");
    if (topic === "custom") {
      const understood = await resolveCustomTopic();
      if (!understood) return;
    } else {
      setWords(pickVocabulary(topic, level));
    }
    setOpenWord(null);
    setResponse(null);
    setRevisionResponse(null);
    setRevisedDraft("");
    setFinalDraft("");
    if (draft && draft === lastDemo.current) {
      updateDraft("");
      setSelfCheck({ mainPoint: "", strongest: "", weakness: DEFAULT_WEAKNESS, help: goal });
      setDemoNotice("目标词已更新，请再次填入演示初稿，生成匹配本轮的新文章。");
    } else {
      setDemoNotice(draft ? "目标词已更新，你编辑的初稿已保留；请核对新目标词，或再次填入演示初稿。" : "目标词已更新，可以开始写作或生成演示初稿。");
    }
  }

  async function fillDemoDraft() {
    if (demoDraftController.current) return;
    if (path !== "practice") {
      updateDraft(cleanDemoDraft(buildDemoDraft("education-ai", [])));
      if (helpMode !== "rewrite") setSelfCheck({ ...selfCheck, mainPoint: getDemoMainPoint("education-ai"), weakness: "多个方面均需要改进，希望进行综合诊断" });
      return;
    }
    const requestId = ++demoRequest.current;
    const previousAiDraft = lastDemo.current;
    const startingDraft = draftRef.current;
    const quickDraft = buildFastDemoDraft(topic, words);
    setResponse(null);
    setRevisionResponse(null);
    setRevisedDraft("");
    setFinalDraft("");
    setSelfCheck({ mainPoint: getDemoMainPoint(topic, customTopic), strongest: "", weakness: "多个方面均需要改进，希望进行综合诊断", help: goal });
    setDemoNotice("正在生成匹配当前方向与全部目标词的新演示稿……");
    setIsGeneratingDemo(true);
    setError("");
    const controller = new AbortController();
    demoDraftController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10_000);
    try {
      const result = await fetch("/api/demo-draft", {
        method: "POST", signal: controller.signal, headers: apiRequestHeaders(),
        body: JSON.stringify({ topic: `${topicContext}。请生成围绕这一主题背景、但允许学习者自由确定观点的英文演示初稿。`, words: words.map((word) => word.word), previousDraft: previousAiDraft }),
      });
      const data = await readJsonResponse<{ draft: string; mainPoint: string; error?: string }>(result);
      if (requestId !== demoRequest.current) return;
      if (!result.ok) throw new Error(data.error || "暂时无法生成演示稿，请重试。");
      if (draftRef.current !== startingDraft) return;
      updateDraft(data.draft); lastDemo.current = data.draft;
      setResponse(null);
      setRevisionResponse(null);
      setRevisedDraft("");
      setFinalDraft("");
      setSelfCheck({ mainPoint: data.mainPoint, strongest: "", weakness: "多个方面均需要改进，希望进行综合诊断", help: goal });
      setDemoNotice("已生成本轮新演示稿，包含全部目标词。稿中的错误是刻意设置的练习内容。");
    } catch {
      if (requestId !== demoRequest.current || draftRef.current !== startingDraft) return;
      updateDraft(quickDraft);
      lastDemo.current = quickDraft;
      setDemoNotice("真实 AI 本次未及时返回，已填入包含全部目标词的备用练习稿；你可以再次点击生成新稿。");
    } finally {
      window.clearTimeout(timeout);
      if (demoDraftController.current === controller) demoDraftController.current = null;
      if (requestId === demoRequest.current) setIsGeneratingDemo(false);
    }
  }

  async function requestFeedback() {
    if (feedbackController.current) return;
    demoRequest.current += 1;
    setError("");
    setRevisionError("");
    if (countNonWhitespaceCharacters(draft) < 20) { setError("请先输入一段至少 20 个非空白字符的英文初稿。你也可以使用演示初稿快速体验。"); return; }
    if (helpMode !== "rewrite" && (!selfCheck.mainPoint || !selfCheck.weakness || !selfCheck.help)) { setError("获得 AI 反馈前，请先完成核心论点、自我评估和希望获得帮助的检查。"); return; }
    setResponse(null);
    setRevisionResponse(null);
    setRecordCopied(false);
    dismissIssue();
    issueRefs.current.clear();
    const controller = new AbortController();
    feedbackController.current = controller;
    setIsLoading(true);
    try {
      const result = await fetch("/api/coach", { method: "POST", signal: controller.signal, headers: apiRequestHeaders(), body: JSON.stringify({ draft, mode: helpMode, goal, selfCheck, taskPrompt: path === "practice" ? topicContext : undefined }) });
      const data = await readJsonResponse<CoachResponse & { error?: string }>(result);
      if (controller.signal.aborted) return;
      if (!result.ok) throw new Error(data.error || "暂时无法分析这段文字。");
      setResponse(data);
      setRevisionResponse(null);
      setRevisedDraft(draft);
      setFinalDraft("");
      setStage(helpMode === "rewrite" ? "revise" : "feedback");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      if (!controller.signal.aborted) setError(requestError instanceof Error ? requestError.message : "暂时无法分析，请稍后重试；你的文章仍保留在当前页面。");
    } finally {
      if (feedbackController.current === controller) {
        feedbackController.current = null;
        setIsLoading(false);
      }
    }
  }

  async function reanalyzeSecondDraft() {
    if (revisionController.current) return;
    setRevisionError("");
    const trimmedRevision = revisedDraft.trim();
    if (countNonWhitespaceCharacters(trimmedRevision) < 20) {
      setRevisionError("请先完成一篇至少 20 个非空白字符的第二稿。");
      return;
    }
    if (trimmedRevision === draft.trim()) {
      setRevisionError("第二稿尚未发生变化。请先根据反馈完成至少一处修改，再提交复检。");
      return;
    }
    if (!response) return;
    setRevisionResponse(null);
    const controller = new AbortController();
    revisionController.current = controller;
    setIsReanalyzing(true);
    try {
      const result = await fetch("/api/coach", {
        method: "POST",
        signal: controller.signal,
        headers: apiRequestHeaders(),
        body: JSON.stringify({
          phase: "revision",
          draft: trimmedRevision,
          originalDraft: draft,
          mode: "rewrite",
          goal: "复检第二稿中仍存在的问题，并生成最终规范学术版本",
          selfCheck,
          taskPrompt: path === "practice" ? topicContext : undefined,
          priorFeedback: response.feedback.map(({ category, quote, why, correction, confidence }) => ({
            category: category.slice(0, 500),
            quote: quote.slice(0, 500),
            why: why.slice(0, 500),
            correction: (correction || "").slice(0, 500),
            confidence,
          })),
        }),
      });
      const data = await readJsonResponse<CoachResponse & { error?: string }>(result);
      if (controller.signal.aborted) return;
      if (!result.ok) throw new Error(data.error || "暂时无法重新分析第二稿。");
      const secondAnalysis = data as CoachResponse;
      setRevisionResponse(secondAnalysis);
      setFinalDraft(secondAnalysis.modelRevision || trimmedRevision);
      setStage("reflect");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (requestError) {
      if (!controller.signal.aborted) setRevisionError(requestError instanceof Error ? requestError.message : "暂时无法重新分析第二稿，请稍后重试；你的第二稿仍保留在当前页面。");
    } finally {
      if (revisionController.current === controller) {
        revisionController.current = null;
        setIsReanalyzing(false);
      }
    }
  }

  function goBack() {
    demoRequest.current += 1;
    topicController.current?.abort();
    topicController.current = null;
    demoDraftController.current?.abort();
    demoDraftController.current = null;
    feedbackController.current?.abort();
    feedbackController.current = null;
    revisionController.current?.abort();
    revisionController.current = null;
    setIsLoading(false);
    setIsReanalyzing(false);
    setIsGeneratingDemo(false);
    const previous: Record<Exclude<Stage, "home">, Stage> = { setup: "home", draft: "setup", feedback: "draft", revise: helpMode === "rewrite" ? "draft" : "feedback", reflect: "revise" };
    if (stage !== "home") setStage(previous[stage]);
  }

  if (stage === "home") {
    const loopSlide = revisionLoopSlides[loopStep];
    return <main className="site-shell">
      <header className="topbar"><Brand /><div className="prototype-badge"><span aria-hidden="true" /> 中文版候选版</div></header>
      <section className="hero" id="top"><div className="hero-copy"><p className="overline">为多语言大学生设计</p><h1>从写出第一稿，<span>到看见自己的进步。</span></h1><p className="hero-intro">先保留你的想法，再用恰到好处的 AI 支持发现问题、完成修改，并解释你真正学会了什么。</p><div className="learning-loop" aria-label="学习过程"><span>先思考</span><i /><span>再反馈</span><i /><span>自己修改</span></div></div>
      {mediaConfig.homeHeroImage ? <figure className="hero-image-card"><Image src={mediaConfig.homeHeroImage} alt={mediaConfig.homeHeroAlt} fill sizes="(max-width: 900px) 100vw, 38vw" priority /><figcaption>保留自己的观点，再决定如何使用 AI 反馈。</figcaption></figure> : <div className="progress-card" aria-label="四步修改循环，可左右滑动" onPointerDown={(event) => { loopDragStartX.current = event.clientX; }} onPointerUp={(event) => finishLoopDrag(event.clientX)} onPointerCancel={() => { loopDragStartX.current = null; }}><div className="progress-topline"><span>你的修改循环</span><strong>{loopStep + 1} / {revisionLoopSlides.length}</strong></div><div className="progress-track"><span style={{ width: `${((loopStep + 1) / revisionLoopSlides.length) * 100}%` }} /></div><div className="paper-preview" aria-live="polite"><span className="paper-label">{loopSlide.label}</span><p>{loopSlide.sample}</p><div className="feedback-line"><SparkIcon /><span>{loopSlide.note}</span></div></div><div className="loop-navigation"><button type="button" className="loop-arrow" onClick={() => moveLoop(-1)} aria-label="查看修改循环上一步"><ArrowIcon back /></button><div className="loop-dots" aria-label="选择修改循环步骤">{revisionLoopSlides.map((slide, index) => <button key={slide.label} type="button" className={index === loopStep ? "active" : ""} onClick={() => setLoopStep(index)} aria-label={`第 ${index + 1} 步：${slide.label}`} aria-current={index === loopStep ? "step" : undefined} />)}</div><button type="button" className="loop-arrow" onClick={() => moveLoop(1)} aria-label="查看修改循环下一步"><ArrowIcon /></button></div><p className="ownership-note">可左右滑动查看完整过程 · AI 不替你思考</p></div>}</section>
      <section className="mode-section" aria-labelledby="mode-title"><div className="section-heading"><div><p className="overline">选择一个入口</p><h2 id="mode-title">今天，你想怎样练习？</h2></div><p>两个入口使用同一套“初稿—反馈—修改—反思”学习循环。</p></div>
      <div className="mode-grid"><button className="mode-card practice-card" type="button" onClick={() => startPath("practice")}><span className="card-number">01</span><span className="card-kicker">从关键词开始</span><strong>主题写作练习</strong><span className="card-description">选择感兴趣的主题，获得适合当前水平的英文词汇，再用自己的观点完成一篇短文。</span><span className="word-cloud"><i>evidence</i><i>access</i><i>engage</i><i>reflect</i><i>however</i></span><span className="card-cta">进入写作练习 <ArrowIcon /></span></button>
      <button className="mode-card revision-card" type="button" onClick={() => startPath("revision")}><span className="card-number">02</span><span className="card-kicker">从你的初稿开始</span><strong>学术英语修改</strong><span className="card-description">粘贴不够正式或存在错误的英文，选择自主诊断、AI 局部协作或直接完整改写。</span><span className="revision-sample"><span className="sample-row muted">I think this result is really good...</span><span className="sample-connector" /><span className="sample-row improved">The findings indicate a positive outcome...</span></span><span className="card-cta">进入修改工作室 <ArrowIcon /></span></button></div></section>
      <footer><p>为学习而设计，而不是替你完成思考。</p><span>无需登录 · 演示内容不会自动公开 · <Link href="/privacy">隐私与 AI 使用说明</Link></span></footer>
    </main>;
  }

  return <main className="workspace-shell"><header className="workspace-header"><Brand compact /><Progress stage={stage} helpMode={helpMode} /><div className="prototype-badge"><span /> 中文版候选版</div></header><div className="workspace-body"><button className="back-button" type="button" onClick={goBack}><ArrowIcon back /> 返回上一步</button>
    {stage === "setup" && <section className="flow-panel setup-panel"><div className="flow-heading"><p className="overline">步骤 1 · 设置任务</p><h1>{path === "practice" ? "准备一次主题写作练习" : "这一次，你希望 AI 怎样帮助你？"}</h1><p>{path === "practice" ? "先选择一个主题背景，观点和文章角度由你自己确定；系统只据此筛选相关词汇。" : "帮助越直接，完成速度越快；但学习者亲自思考和修改的机会也会减少。"}</p></div>
      {path === "practice" ? <div className="setup-columns"><fieldset className="choice-fieldset"><legend>选择或描述你感兴趣的主题</legend><div className="topic-choices">{topics.map((item) => <button key={item.id} type="button" aria-pressed={topic === item.id} className={topic === item.id ? "active" : ""} onClick={() => selectTopic(item.id)}><span>{item.label}</span><small>{item.prompt}</small></button>)}</div>{topic === "custom" && <div className="custom-topic-fields"><label><span>用中文描述你的方向 <em>必填</em></span><textarea value={customTopic} maxLength={200} onChange={(event) => updateCustomTopic(event.target.value)} placeholder="例如：我想讨论短视频推荐如何影响年轻人的审美、选择和社群关系。" /></label><label><span>补充你想讨论的角度 <em>选填</em></span><textarea value={customQuestion} maxLength={300} onChange={(event) => updateCustomQuestion(event.target.value)} placeholder="例如：我想比较个人选择与平台引导之间的关系。" /></label><small>可以用一到三句话描述任何场景、人物关系、经历或社会现象，不需要先给主题标签。系统会据此匹配英文目标词，但不会规定你必须回答哪一个问题。</small></div>}</fieldset><fieldset className="choice-fieldset"><legend>选择练习难度</legend><div className="level-choices">{levels.map((item) => <button key={item.id} type="button" aria-pressed={level === item.id} className={level === item.id ? "active" : ""} onClick={() => selectLevel(item.id)}><strong>{item.label}</strong><span>{item.count} 个目标词</span><small>{item.description}</small></button>)}</div></fieldset></div> : <><fieldset className="choice-fieldset"><legend>选择帮助程度</legend><div className="help-grid">{helpModes.map((item, index) => <button key={item.id} type="button" aria-pressed={helpMode === item.id} className={`${helpMode === item.id ? "active" : ""} ${item.id === "rewrite" ? "editing-mode" : ""}`} onClick={() => setHelpMode(item.id)}><span className="mode-index">0{index + 1}</span><strong>{item.name}</strong><p>{item.description}</p><em>{item.learning}</em></button>)}</div></fieldset>{helpMode === "rewrite" && <div className="integrity-notice"><SparkIcon /><div><strong>这是编辑模式，不是学习模式</strong><p>AI 会直接改写全文，但不会覆盖原稿，也不会添加原稿中不存在的事实、数据或引用。请遵守课程的 AI 使用规定。</p></div></div>}</>}
      {error && <p className="error-message" role="alert">{error}</p>}<button className="primary-button wide-action" type="button" onClick={beginDraft} disabled={!canContinueSetup || isResolvingTopic}>{isResolvingTopic ? "正在理解你的写作方向……" : "继续填写初稿"} <ArrowIcon /></button></section>}

    {stage === "draft" && <section className="flow-panel draft-panel"><div className="flow-heading compact-heading"><p className="overline">步骤 2 · 你的初稿</p><h1>{path === "practice" ? "围绕当前方向自由写作" : "粘贴你自己的英文初稿"}</h1><p>{path === "practice" ? `当前方向：${activeTopicLabel}，你可以自由确定文章观点。建议写 80–150 词，目标词要自然使用。` : "请删除姓名、学号和其他个人信息。原稿不会被 AI 自动覆盖。"}</p></div>
      {path === "practice" && <div className="vocabulary-panel"><div className="panel-title-row"><div><span>本轮目标词</span><strong>已使用 {usedWords.size} / {words.length} · 建议至少 {Math.min(6, words.length)} 个</strong></div><button type="button" onClick={redrawWords}>重新抽取</button></div><div className="vocabulary-list">{words.map((item) => <button key={item.word} type="button" className={`${openWord === item.word ? "open" : ""} ${usedWords.has(item.word) ? "used" : ""}`} onClick={() => setOpenWord(openWord === item.word ? null : item.word)}><span className="vocabulary-term"><strong>{item.word}</strong><small>{item.definition}</small></span><span>{openWord === item.word ? "收起" : usedWords.has(item.word) ? "已使用 ✓" : "查看提示"}</span>{openWord === item.word && <div><p><b>中文：</b>{item.definition}</p><p><b>搭配：</b>{item.collocation}</p><p><b>例句：</b>{item.example}</p></div>}</button>)}</div></div>}
      <label className="text-field draft-field"><span>英文初稿</span><textarea value={draft} readOnly={isGeneratingDemo} maxLength={path === "practice" ? 6000 : MAX_RAW_DRAFT_CHARACTERS} onChange={(event) => updateDraft(event.target.value)} placeholder="在这里输入或粘贴你的英文……" /><small className={(path === "practice" && draftWordCount >= 300) || (path === "revision" && draftNonWhitespaceCount >= 6000) ? "limit-reached" : ""}>{path === "practice" ? `${draftWordCount} / 300 词${draftWordCount >= 300 ? " · 已达到上限" : ""}` : `${draftWordCount} 词 · ${draftNonWhitespaceCount} / 6000 非空白字符${draftNonWhitespaceCount >= 6000 ? " · 已达到上限" : ""}`} · 内容仅用于本次反馈</small></label>
      <div className="draft-tools"><button className="secondary-button" type="button" disabled={isGeneratingDemo || isLoading} onClick={fillDemoDraft}>{isGeneratingDemo ? "正在生成匹配本轮目标词的新稿……" : path === "practice" ? "填入匹配当前方向的演示初稿（含全部目标词）" : "填入演示初稿"}</button></div>
      {demoNotice && <p className="demo-status" role="status">{demoNotice}</p>}
      {helpMode !== "rewrite" && <div className="self-check"><div><span className="mini-step">AI 分析前</span><h2>先对初稿进行简要自我评估</h2><p>你的判断会与 AI 诊断一起保留，帮助你比较自我评估与外部反馈，并观察修改能力的进步。点击上方演示按钮，也会填入匹配主题的示范内容。</p></div><label><span>请概括这段文字的核心论点。</span><input value={selfCheck.mainPoint} maxLength={500} onChange={(event) => setSelfCheck({ ...selfCheck, mainPoint: event.target.value })} placeholder="可用中文或英文简要概括" /></label><label><span>你认为初稿中表达最清晰、最有效的是哪一句？</span><input value={selfCheck.strongest} maxLength={500} onChange={(event) => setSelfCheck({ ...selfCheck, strongest: event.target.value })} placeholder="选填：可直接复制原稿中的句子" /></label><label><span>你认为当前初稿最需要改进的方面是什么？</span><select value={selfCheck.weakness} onChange={(event) => setSelfCheck({ ...selfCheck, weakness: event.target.value })}><option value="" disabled>请选择一项自我判断</option><option>中心论点尚未充分聚焦或明确</option><option>论证展开不足，缺少充分的理由或证据</option><option>篇章结构松散，段落之间的逻辑衔接不足</option><option>学术语域不够恰当，存在较多口语化表达</option><option>词汇范围有限，部分用词笼统或重复</option><option>语言准确性不足，存在较多拼写、语法或时态问题</option><option>多个方面均需要改进，希望进行综合诊断</option><option>尚不确定，希望通过 AI 诊断进一步确认</option></select></label><label><span>本轮希望 AI 重点提供哪一方面的支持？</span><select value={goal} onChange={(event) => { setGoal(event.target.value); setSelfCheck({ ...selfCheck, help: event.target.value }); }}><option>澄清并聚焦中心论点</option><option>增强篇章结构与段落间的逻辑衔接</option><option>提升学术语域与措辞的准确性</option><option>深化论证并完善证据阐释</option><option>检查拼写、语法与时态的准确性</option><option>对初稿进行全面综合诊断</option></select></label></div>}
      {error && <p className="error-message" role="alert">{error}</p>}<button className="primary-button wide-action" type="button" onClick={requestFeedback} disabled={isLoading || isGeneratingDemo}>{isLoading ? "正在分析文章问题……" : helpMode === "rewrite" ? "生成完整学术改写" : "分析并定位文章问题"}<ArrowIcon /></button></section>}

    {stage === "feedback" && response && <section className="flow-panel feedback-panel"><div className="flow-heading compact-heading"><p className="overline">步骤 3 · 文章整体诊断</p><h1>这篇文章需要修改什么？</h1><p>{response.summary}</p></div><ProviderBadge response={response} />{response.feedback.length === 0 ? <><div className="integrity-notice"><CheckIcon /><div><strong>暂未发现可可靠定位的问题</strong><p>这不代表文章绝对完美。你可以返回初稿继续完善内容，也可以结束本轮练习；系统不会为了凑数量虚构反馈。</p></div></div><div className="finish-actions"><button className="secondary-button" type="button" onClick={() => setStage("draft")}>返回初稿继续编辑</button><button className="primary-button" type="button" onClick={() => { resetLearningWork(); setStage("home"); }}>完成并返回首页 <ArrowIcon /></button></div></> : <><div className="feedback-grid">{response.feedback.map((item, index) => <article className="feedback-card" key={`${item.category}-${index}`}><div className="feedback-card-top"><span>问题 {index + 1}</span><em>AI 判断：{item.confidence}</em></div><h2>{item.category}</h2><blockquote>问题位置：{item.quote}</blockquote><h3>建议修改方向</h3><p>{item.why}</p><h3>正确用法／修改方法</h3><p className="correction-copy">{item.correction || "请根据上面的诊断，用自己的语言完成修改。"}</p>{helpMode === "model" && item.suggestion && <details className="local-example"><summary>查看这个问题的局部修改示例</summary><div><span>仅供参考，不是整篇替代稿</span><p>{item.suggestion}</p></div></details>}</article>)}</div><div className="integrity-notice"><SparkIcon /><div><strong>接下来由你完成全文修改</strong><p>{helpMode === "model" ? "局部示例只帮助你理解某一个问题，不会替你完成整篇文章。提交第二稿后，系统会保留三个版本供比较。" : "请根据上面的诊断修改文章。提交后，系统会生成一版完成这些修改的规范学术英语版本，并保留你的原稿与第二稿供比较。"}</p></div></div><button className="primary-button wide-action" type="button" onClick={() => setStage("revise")}>查看标记并开始自己修改 <ArrowIcon /></button></>}</section>}

    {stage === "revise" && response && helpMode === "rewrite" && <section className="flow-panel revise-panel direct-rewrite-panel"><div className="flow-heading compact-heading"><p className="overline">步骤 3 · 直接完整改写</p><h1>原稿与规范学术版本</h1><p>AI 已完成语言纠正与学术化表达。请核对改写是否保留了你的原意、事实和立场。</p></div><div className="comparison-grid"><div className="version-pane locked"><div><span>原稿</span><strong>{draftWordCount} 词</strong></div><aside className="draft-highlight-legend"><i />红色下划线表示已修改的位置</aside><p><HighlightedDraft text={draft} feedback={response.feedback} /></p></div><article className="version-pane final direct-result"><div><span>完整学术改写</span><strong>{response.modelRevision.trim().split(/\s+/).filter(Boolean).length} 词</strong></div><p>{response.modelRevision}</p></article></div><div className="ai-record editing-record"><div><SparkIcon /><span>编辑模式</span></div><p>此版本由 AI 直接生成，学习参与度最低。请根据课程规定说明 AI 的使用方式，并自行核对内容准确性。</p></div><div className="finish-actions"><button className="secondary-button" type="button" onClick={async () => { await navigator.clipboard.writeText(response.modelRevision); setRecordCopied(true); }}>{recordCopied ? "改写已复制" : "复制完整改写"}</button><button className="primary-button" type="button" onClick={() => { resetLearningWork(); setStage("home"); }}>完成并返回首页 <ArrowIcon /></button></div></section>}

    {stage === "revise" && response && helpMode !== "rewrite" && <section className="flow-panel revise-panel">
      <div className="flow-heading compact-heading"><p className="overline">步骤 4 · 自己修改</p><h1>把文章问题改成你自己的第二稿</h1><p>左侧原稿用红色下划线标出反馈对应的位置，右侧由你完成修改。{helpMode === "model" ? "需要时可返回上一页查看局部示例。" : "系统不会提前替你改写。"}</p></div>
      <ProviderBadge response={response} />
      <div className="comparison-grid revision-comparison"><div className="version-pane locked interactive-original"><div><span>带问题定位的原稿</span><strong>{draftWordCount} 词</strong></div><div className="issue-navigator" aria-label="逐项查看文章问题"><button type="button" onClick={() => showIssue((activeIssue ?? 0) - 1, true)} aria-label="查看上一个问题"><ArrowIcon back /></button><button type="button" className="issue-position" onClick={() => showIssue(activeIssue ?? 0, true)}>{activeIssue === null ? `查看全部 ${response.feedback.length} 项问题` : `问题 ${activeIssue + 1} / ${response.feedback.length} · ${response.feedback[activeIssue]?.category}`}</button><button type="button" onClick={() => showIssue((activeIssue ?? -1) + 1, true)} aria-label="查看下一个问题"><ArrowIcon /></button></div><aside className="draft-highlight-legend"><i />悬停查看提示；点击可固定，修改右侧时不会消失</aside><p className="interactive-draft-copy"><InteractiveHighlightedDraft text={draft} feedback={response.feedback} activeIssue={activeIssue} pinnedIssue={pinnedIssue} onShowIssue={setActiveIssue} onPinIssue={(index) => { if (pinnedIssue === index) dismissIssue(); else { setActiveIssue(index); setPinnedIssue(index); } }} onDismiss={dismissIssue} issueRefs={issueRefs} /></p></div><label className="version-pane editable"><div><span>你的第二稿</span><strong>{path === "practice" ? `${revisedWordCount} / 300 词` : `${revisedWordCount} 词 · ${revisedNonWhitespaceCount} / 6000 非空白字符`}</strong></div><textarea value={revisedDraft} maxLength={path === "practice" ? 6000 : MAX_RAW_DRAFT_CHARACTERS} onChange={(event) => updateRevisedDraft(event.target.value)} aria-label="修改后的英文文本" /></label></div>
      {revisionError && <p className="error-message" role="alert">{revisionError}</p>}
      <button className="primary-button wide-action" type="button" disabled={isReanalyzing || countNonWhitespaceCharacters(revisedDraft) < 20} onClick={reanalyzeSecondDraft}>{isReanalyzing ? "正在重新分析第二稿……" : "提交第二稿并重新分析"} <ArrowIcon /></button>
      <p className="second-check-note">系统会重新检查第二稿中仍存在的问题，并以第二稿为基础生成最终规范版本。</p>
    </section>}

    {stage === "reflect" && response && revisionResponse && <section className="flow-panel reflection-panel">
      <div className="completion-mark"><CheckIcon /></div>
      <div className="flow-heading centered"><p className="overline">步骤 5 · 第二稿复检与最终版本</p><h1>AI 已重新分析你的第二稿</h1><p>最终版本以你的第二稿为基础，只处理复检后仍然存在的问题，不会退回第一次分析时预先生成的文章。</p></div>
      <ProviderBadge response={revisionResponse} />
      <div className={`revision-audit ${revisionResponse.feedback.length === 0 ? "clear" : "remaining"}`}>
        {revisionResponse.revisionComparison ? <div className="revision-audit-grid">
          <div><span>原稿首次诊断</span><strong>{revisionResponse.revisionComparison.initialCount}</strong><small>项</small></div>
          <div className="resolved"><span>本轮未再检出</span><strong>{revisionResponse.revisionComparison.resolved.length}</strong><small>项</small></div>
          <div><span>原问题仍存在</span><strong>{revisionResponse.revisionComparison.remainingCount}</strong><small>项</small></div>
          <div><span>修改位置仍需注意</span><strong>{revisionResponse.revisionComparison.changedCount}</strong><small>项</small></div>
          <div><span>复检补充发现</span><strong>{revisionResponse.revisionComparison.supplementalCount}</strong><small>项</small></div>
        </div> : <div className="revision-audit-grid legacy"><div><span>原稿首次诊断</span><strong>{response.feedback.length}</strong><small>项</small></div><div><span>第二稿复检</span><strong>{revisionResponse.feedback.length}</strong><small>项</small></div></div>}
        <p>{revisionResponse.feedback.length === 0 ? "本轮独立复检未发现可可靠定位的问题；最终版本仍需由你核对原意和事实。" : "第二稿已按与初稿相同的标准独立检测；下方标签说明问题来自原问题、修改位置，还是复检补充发现。"}</p>
      </div>
      {revisionResponse.revisionComparison?.resolved.length ? <div className="resolved-issue-list"><h2>本轮未再检出的原问题</h2>{revisionResponse.revisionComparison.resolved.map((item, index) => <span key={`${item.category}-${item.quote}-${index}`}><CheckIcon />{item.category}：{item.quote}</span>)}</div> : null}
      {revisionResponse.feedback.length > 0 && <div className="revision-review-list"><h2>第二稿仍需注意的问题</h2>{revisionResponse.feedback.map((item, index) => <article key={`${item.category}-${index}`}><div className="revision-issue-title"><strong>{index + 1}. {item.category}</strong>{item.revisionStatus && <span className={`revision-status ${item.revisionStatus}`}>{item.revisionStatus === "remaining" ? "原问题仍存在" : item.revisionStatus === "changed" ? "修改位置仍需注意" : "复检补充发现"}</span>}</div><blockquote>{item.quote}</blockquote><p>{item.correction}</p></article>)}</div>}
      <div className="final-version-stack">
        <article className="version-pane locked"><div><span>原稿</span><strong>{draftWordCount} 词</strong></div><p>{draft}</p></article>
        <article className="version-pane locked"><div><span>你的第二稿</span><strong>{revisedWordCount} 词</strong></div>{revisionResponse.feedback.length > 0 && <aside className="draft-highlight-legend"><i />红色下划线表示第二稿复检后仍存在的问题</aside>}<p><HighlightedDraft text={revisedDraft} feedback={revisionResponse.feedback} /></p></article>
        <article className="version-pane final"><div><span>基于第二稿生成的最终规范版本</span><strong>{finalDraft.trim().split(/\s+/).filter(Boolean).length} 词</strong></div><p>{finalDraft}</p></article>
      </div>
      <div className="reflection-fields"><label><span>学习反思</span><strong>比较原稿、第二稿与最终版本，这一次你学到的最重要修改原则是什么？</strong><textarea value={reflection} maxLength={1000} onChange={(event) => setReflection(event.target.value)} placeholder="可以用中文或英文回答……" /></label></div>
      <div className="ai-record"><div><SparkIcon /><span>AI 贡献记录</span></div><p>AI 首先诊断原稿；学习者独立完成第二稿；AI 随后重新分析第二稿并处理仍存在的问题。最终文本仍需由学习者核对事实、立场与课程规定。</p></div>
      <div className="finish-actions"><button className="secondary-button" type="button" disabled={!reflection.trim()} onClick={async () => { const comparison = revisionResponse.revisionComparison; await navigator.clipboard.writeText(`ThinkRevise AI 学习记录\n${path === "practice" ? `练习主题：${activeTopicLabel}\n` : ""}初稿自我评估：${selfCheck.weakness}\n本轮目标：${goal}\n原稿首次诊断：${response.feedback.length} 项\n${comparison ? `本轮未再检出：${comparison.resolved.length} 项\n原问题仍存在：${comparison.remainingCount} 项\n修改位置仍需注意：${comparison.changedCount} 项\n复检补充发现：${comparison.supplementalCount} 项` : `第二稿复检：${revisionResponse.feedback.length} 项仍需注意`}\n原稿：${draft}\n第二稿：${revisedDraft}\n最终规范版本：${finalDraft}\n反思：${reflection}`); setRecordCopied(true); }}>{recordCopied ? "学习记录已复制" : "复制学习记录"}</button><button className="primary-button" type="button" disabled={!reflection.trim()} onClick={() => { resetLearningWork(); setStage("home"); }}>完成并返回首页 <ArrowIcon /></button></div>
    </section>}
  </div></main>;
}

function ProviderBadge({ response }: { response: CoachResponse }) {
  return <div className={`provider-status ${response.provider}`}><span /><strong>{response.provider === "openai" ? "实时 AI 反馈" : "演示反馈模式"}</strong><p>{response.fallbackNotice || (response.provider === "openai" ? "AI 判断可能出错，请由学习者核对。" : "无需 API 密钥，适合现场试用与故障备用。")}</p></div>;
}
