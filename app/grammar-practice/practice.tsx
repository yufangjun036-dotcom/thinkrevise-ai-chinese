"use client";

import { useId, useState } from "react";
import { addHistory, checkAttempt, HISTORY_KEY, matchRules, readHistory, selectQuestions, type Feedback, type Selected } from "./engine";

type LocalQuestion = Selected & { ruleNameZh?: string; explanationZh?: string };

export default function GrammarPractice({ initial, recheck }: { initial: Feedback[]; recheck: Feedback[] }) {
  const [questions, setQuestions] = useState<LocalQuestion[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [hidden, setHidden] = useState(true);
  const panelId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [storageNotice, setStorageNotice] = useState("");
  async function start() {
    if (loading) return;
    setLoading(true); setError("");
    try {
      // Load only on request; no AI call or change to the original diagnosis.
      const bank = (await import("./bank.json")).default;
      let history: string[] = [];
      try { history = readHistory(localStorage.getItem(HISTORY_KEY)); } catch { setStorageNotice("当前浏览器无法读取近期练习记录，题目可能重复。"); }
      const selected = selectQuestions(bank, matchRules(initial, recheck, bank), history);
      setQuestions(selected); setAnswers({}); setRevealed(false);
      if (selected.length) try { localStorage.setItem(HISTORY_KEY, JSON.stringify(addHistory(history, selected.map(q => q.id)))); } catch { setStorageNotice("近期练习记录未能保存，下次可能抽到相同题目。"); }
    } catch { setError("练习题暂时无法加载，你可以重试，也可以直接跳过。"); }
    finally { setLoading(false); }
  }
  return <section className="grammar-practice" aria-label="可选语法小练习">
    <div className="grammar-practice-heading"><div><p className="overline">选做 · 完成文章修改后</p><h2>想巩固一下这次遇到的语法问题吗？</h2><p className="grammar-practice-note">根据本次反馈，选做最多 3 道小练习。可以跳过，不影响保存和结束。</p></div><button type="button" className="secondary-button" aria-expanded={!hidden} aria-controls={panelId} disabled={hidden && loading} onClick={() => { setHidden(!hidden); if (hidden && questions === null && !loading) void start(); }}>{hidden ? (loading ? "正在加载…" : questions === null ? "开始小练习" : "继续小练习") : "收起练习"}</button></div>
    <div id={panelId} hidden={hidden}>
    {!hidden && <>
      <p>练习只对应本次反馈中可可靠匹配的语言问题，不包含学术或风格建议，也不会修改你的文章。</p>
      <p className="grammar-practice-note">不调用 AI，也不计算总分。仅对明确未改正的目标错误作本地提示；其他改写请结合参考答案自行核对。</p>
      {loading && <p role="status">正在加载练习…</p>}
      {!questions && error && <button type="button" className="secondary-button" disabled={loading} onClick={start}>重新加载练习</button>}
      {error && <p role="alert">{error}</p>}
      {storageNotice && <p role="status">{storageNotice}</p>}
      {questions?.length === 0 && <p role="status">本次反馈暂时没有可可靠匹配的练习题。这不代表文章没有错误，你可以直接结束本轮修改。</p>}
      {!!questions?.length && <form onSubmit={e => { e.preventDefault(); if (questions.every(q => answers[q.id]?.trim())) setRevealed(true); }}>
        <p>每句修改一处目标语言问题，尽量保留原意和其他文字。完成作答后再查看参考答案。</p>
        {questions.map((q, index) => { const status = checkAttempt(q, answers[q.id] || ""); return <article className={`grammar-practice-question${revealed ? ` attempt-${status}` : ""}`} key={q.id}>
          <p className="grammar-practice-note">{index + 1} / {questions.length} · {q.source === "recheck" ? "对应复检反馈" : "巩固初稿中的问题"}</p>
          <blockquote>{q.prompt}</blockquote>
          <label htmlFor={`practice-${q.id}`}>请写出修改后的英文句子</label>
          <textarea id={`practice-${q.id}`} value={answers[q.id] || ""} maxLength={1000} required disabled={revealed} onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })} />
          {revealed && <div className="grammar-practice-answer"><p className="practice-attempt-status" role="status"><strong>{status === "needs-revision" ? "仍需修改 · 目标错误仍然存在" : status === "reference" ? "与参考答案一致" : "请核对你的改写 · 不直接判错"}</strong></p><strong>参考答案</strong><p>{q.referenceAnswer}</p><p>本题修改：<b>{q.target.original || "（缺少的词）"}</b> → <b>{q.target.replacement}</b></p><p>练习重点：{q.ruleNameZh || "语言形式与句子结构"}</p><p>{q.explanationZh || "请对照目标修改，保留原句的意思和时间信息。"}</p>{q.acceptedAlternativeAnswers.length > 0 && <p>其他参考写法：{q.acceptedAlternativeAnswers.join(" / ")}</p>}<p>参考答案不一定是唯一正确写法。不同于参考答案，不等于一定有错。</p></div>}
        </article>; })}
        {!revealed ? <button className="primary-button" type="submit" disabled={!questions.every(q => answers[q.id]?.trim())}>查看参考答案</button> : <p role="status">请结合颜色提示核对。本地检查不能判断所有可能的改写，也不能据此认定你已完全掌握。</p>}
      </form>}
    </>}
    </div>
  </section>;
}
