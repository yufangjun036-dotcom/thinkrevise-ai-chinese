export type EditAudit = { quote: string; edit: string; kind: "punctuation" | "wording"; status: "applied" | "alternative_applied" | "still_reported" | "alternative_reported" | "not_reconfirmed" | "unmapped" };
export type SuggestedChange = { label: string; kind: "punctuation" | "wording"; coordinatorComma?: boolean };

export function SuggestedChanges({ items, english = false }: { items?: SuggestedChange[]; english?: boolean }) {
  if (!items?.length) return null;
  const label = (text: string) => english ? text.replace(/在“([^”]+)”后补入“([^”]+)”/g, 'after “$1”, insert “$2”').replace(/在句首补入“([^”]+)”/g, 'at the start, insert “$1”').replace(/删除“([^”]+)”/g, 'remove “$1”') : text;
  return <span style={{display:"block"}}>{items.map((item,index)=><span key={index} style={{display:"block"}}><strong>{english ? item.kind === "punctuation" ? "Punctuation: " : "Word/grammar edit: " : item.kind === "punctuation" ? "标点改动：" : "词语／语法改动："}</strong>{label(item.label)}</span>)}
    {items.some(x=>x.coordinatorComma) && <span style={{display:"block"}}>{english ? "Convention: when and joins two independent clauses, formal writing normally uses a comma before it. Short, clear clauses may omit it; this convention is distinct from verb agreement." : "规范说明：and 连接两个独立分句时，正式写作通常在其前加逗号；简短、清楚的分句可以省略。这项规范与主谓一致错误分开看待。"} <a href="https://owl.purdue.edu/owl/general_writing/punctuation/commas/index.html" target="_blank" rel="noreferrer">Purdue OWL</a> · <a href="https://style.mla.org/commas-conj-mods/" target="_blank" rel="noreferrer">MLA</a></span>}
  </span>;
}

export default function RevisionEditAudit({ items, english = false }: { items?: EditAudit[]; english?: boolean }) {
  if (!items?.length) return null;
  const status = english ? {
    applied: "Original suggested edit applied",
    alternative_applied: "Another corresponding repair has been applied",
    still_reported: "Still reported on recheck",
    alternative_reported: "Same issue remains; recheck offers another repair",
    not_reconfirmed: "Not applied as suggested; not reconfirmed on recheck",
    unmapped: "Passage changed; cannot reliably compare this edit",
  } : {
    applied: "已完成首次建议的这一改动",
    alternative_applied: "已采用另一种对应改法",
    still_reported: "复检仍提出这一改动",
    alternative_reported: "同一问题仍存在；本轮给出另一种改法",
    not_reconfirmed: "未按原建议修改；本轮未再次确认",
    unmapped: "原句发生变化，暂不能可靠核对这一改动",
  };
  const label = (text: string) => english ? text.replace(/在“([^”]+)”后补入“([^”]+)”/g, 'after “$1”, insert “$2”').replace(/在句首补入“([^”]+)”/g, 'at the start, insert “$1”').replace(/删除“([^”]+)”/g, 'remove “$1”') : text;
  return <details className="revision-review-list"><summary>{english ? "Check each original suggested edit" : "逐项核对首次建议的改动"}</summary>
    <p>{english ? "This records text changes, not a new AI judgement. Punctuation conventions are listed separately. An unconfirmed suggestion is neither a confirmed remaining error nor proof that it was corrected." : "这里核对实际文字变化，不新增 AI 判断。标点规范单独列出；未再次确认的建议不计为已修正，也不直接认定为仍然有错。"}</p>
    {items.map((item, index) => <article key={index}><div><strong>{english ? item.kind === "punctuation" ? "Punctuation" : "Word or grammar edit" : item.kind === "punctuation" ? "标点改动" : "词语或语法改动"}</strong><p>{label(item.edit)}</p><p>{status[item.status]}</p></div><blockquote>{item.quote}</blockquote></article>)}
  </details>;
}
