"use client";

import { useEffect, useMemo, useRef } from "react";
import { locateRevisedPassage } from "./revision-location";

type LinkedIssue = { index: number; quote: string; sourceStart?: number } | null;

export default function LinkedRevisionEditor({ original, value, issue, navigationId, maxLength, onChange }: {
  original: string;
  value: string;
  issue: LinkedIssue;
  navigationId: number;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const lastNavigation = useRef(navigationId - 1);
  const quote = issue?.quote, sourceStart = issue?.sourceStart;
  const location = useMemo(() => quote ? locateRevisedPassage(original, value, quote, sourceStart) : null,
    [original, value, quote, sourceStart]);

  function syncScroll() {
    if (!inputRef.current || !mirrorRef.current) return;
    mirrorRef.current.scrollTop = inputRef.current.scrollTop;
    mirrorRef.current.scrollLeft = inputRef.current.scrollLeft;
  }

  useEffect(() => {
    const input = inputRef.current, mirror = mirrorRef.current;
    if (!input || !mirror) return;
    const resize = () => { mirror.style.width = `${input.clientWidth}px`; syncScroll(); };
    const observer = new ResizeObserver(resize);
    observer.observe(input);
    resize();
    return () => observer.disconnect();
  }, []);

  // Updating text moves the blue background, but never moves the caret,
  // selection or viewport. Only an explicit issue-navigation action reveals it.
  useEffect(() => {
    if (lastNavigation.current === navigationId) return;
    lastNavigation.current = navigationId;
    if (!location) return;
    const frame = requestAnimationFrame(() => {
      const input = inputRef.current, mirror = mirrorRef.current, mark = markRef.current;
      if (!input || !mirror || !mark || document.activeElement === input) return;
      input.scrollTop = Math.max(0, mark.offsetTop - input.clientHeight / 3);
      syncScroll();
      // The editor can be partly visible while its target line is hidden by
      // the page header (for example, after moving a final sentence to the top).
      const bounds = mark.getBoundingClientRect();
      if (bounds.top < 104 || bounds.top > window.innerHeight - 60) {
        shellRef.current?.scrollIntoView({ block: "center", behavior: "instant" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [navigationId, location]);

  return <>
    <p id="revision-location-status" className={`revision-location-status ${issue && !location ? "unmatched" : ""}`} role="status">
      {!issue ? "点击左侧问题或使用上一条／下一条，定位右侧对应文字。"
        : location ? `已定位第 ${issue.index + 1} 条反馈。蓝色仅表示对应位置，不代表仍有错误。`
          : "暂时无法可靠定位：该段可能已大幅改写、删除或重复，请与原稿手动对照。"}
    </p>
    <div className="linked-editor-shell" ref={shellRef}>
      <div className="linked-editor-mirror" ref={mirrorRef} aria-hidden="true">
        {location ? <>{value.slice(0, location.start)}<mark ref={markRef} className="linked-revision-mark">{value.slice(location.start, location.end)}</mark>{value.slice(location.end)}</> : value}{"\n"}
      </div>
      <textarea id="revision-draft-input" ref={inputRef} value={value} maxLength={maxLength}
        onChange={event => onChange(event.target.value)} onScroll={syncScroll}
        aria-label="修改后的英文文本" aria-describedby="revision-location-status" />
    </div>
  </>;
}
