type RouteKind = "coach" | "custom-topic" | "demo-draft";

type VisitorState = {
  minuteStartedAt: number;
  minuteCount: number;
  dayStartedAt: number;
  dayCount: number;
  active: number;
  lastSeenAt: number;
};

type SecurityState = {
  visitors: Map<string, VisitorState>;
  globalDayStartedAt: number;
  globalDayCount: number;
  globalActive: number;
};

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

function numericSetting(name: string, fallback: number, minimum: number, maximum: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, Math.floor(value))) : fallback;
}

const limits = {
  perMinute: numericSetting("AI_RATE_LIMIT_PER_MINUTE", 5, 1, 60),
  perDay: numericSetting("AI_RATE_LIMIT_PER_DAY", 20, 1, 2_000),
  globalPerDay: numericSetting("AI_GLOBAL_DAILY_REQUEST_LIMIT", 100, 1, 100_000),
  perVisitorConcurrent: numericSetting("AI_CONCURRENT_PER_VISITOR", 1, 1, 4),
  globalConcurrent: numericSetting("AI_GLOBAL_CONCURRENT_LIMIT", 3, 1, 100),
};

const globalSecurity = globalThis as typeof globalThis & { __thinkReviseSecurity?: SecurityState };
const state = globalSecurity.__thinkReviseSecurity ?? {
  visitors: new Map<string, VisitorState>(),
  globalDayStartedAt: Date.now(),
  globalDayCount: 0,
  globalActive: 0,
};
globalSecurity.__thinkReviseSecurity = state;

function securityResponse(error: string, status: number, retryAfter?: number) {
  return Response.json({ error }, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...(retryAfter ? { "Retry-After": String(retryAfter) } : {}),
    },
  });
}

function visitorKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || forwarded;
  if (ip) return `ip:${ip.slice(0, 80)}`;
  const session = request.headers.get("x-thinkrevise-session")?.trim()
    || request.headers.get("x-revisioncoach-session")?.trim()
    || "";
  return /^[a-f0-9-]{20,64}$/i.test(session) ? `session:${session}` : "anonymous-local";
}

function resetExpiredCounters(visitor: VisitorState, now: number) {
  if (now - visitor.minuteStartedAt >= MINUTE_MS) {
    visitor.minuteStartedAt = now;
    visitor.minuteCount = 0;
  }
  if (now - visitor.dayStartedAt >= DAY_MS) {
    visitor.dayStartedAt = now;
    visitor.dayCount = 0;
  }
  if (now - state.globalDayStartedAt >= DAY_MS) {
    state.globalDayStartedAt = now;
    state.globalDayCount = 0;
  }
}

function cleanInactiveVisitors(now: number) {
  if (state.visitors.size < 2_000) return;
  for (const [key, visitor] of state.visitors) {
    if (visitor.active === 0 && now - visitor.lastSeenAt > DAY_MS) state.visitors.delete(key);
  }
}

export function acquireAiRequest(request: Request, route: RouteKind) {
  const now = Date.now();
  cleanInactiveVisitors(now);
  const key = visitorKey(request);
  const visitor = state.visitors.get(key) ?? {
    minuteStartedAt: now,
    minuteCount: 0,
    dayStartedAt: now,
    dayCount: 0,
    active: 0,
    lastSeenAt: now,
  };
  resetExpiredCounters(visitor, now);
  visitor.lastSeenAt = now;
  state.visitors.set(key, visitor);

  if (visitor.active >= limits.perVisitorConcurrent) {
    return { ok: false as const, response: securityResponse("上一项 AI 请求仍在处理中，请等待完成后再试。", 429, 2) };
  }
  if (state.globalActive >= limits.globalConcurrent) {
    return { ok: false as const, response: securityResponse("当前使用人数较多，请稍后重试；你的内容不会丢失。", 503, 5) };
  }
  if (visitor.minuteCount >= limits.perMinute) {
    const retryAfter = Math.max(1, Math.ceil((visitor.minuteStartedAt + MINUTE_MS - now) / 1000));
    return { ok: false as const, response: securityResponse("操作过于频繁，请稍后再试；你的内容仍保留在页面中。", 429, retryAfter) };
  }
  if (visitor.dayCount >= limits.perDay) {
    return { ok: false as const, response: securityResponse("今天的 AI 使用次数已达到当前体验上限，请明天再试。", 429, 3600) };
  }
  if (state.globalDayCount >= limits.globalPerDay) {
    return { ok: false as const, response: securityResponse("今日公共 AI 额度已用完；你仍可保留和编辑文章，稍后再试。", 503, 3600) };
  }

  visitor.minuteCount += 1;
  visitor.dayCount += 1;
  visitor.active += 1;
  state.globalDayCount += 1;
  state.globalActive += 1;
  let released = false;
  return {
    ok: true as const,
    route,
    release() {
      if (released) return;
      released = true;
      visitor.active = Math.max(0, visitor.active - 1);
      state.globalActive = Math.max(0, state.globalActive - 1);
      visitor.lastSeenAt = Date.now();
    },
  };
}

export async function readLimitedJson<T>(request: Request, maximumBytes: number): Promise<
  | { ok: true; value: T }
  | { ok: false; response: Response }
> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    return { ok: false, response: securityResponse("提交内容过大，请缩短后重试。", 413) };
  }
  if (!request.body) return { ok: false, response: securityResponse("请求内容为空。", 400) };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maximumBytes) {
      await reader.cancel();
      return { ok: false, response: securityResponse("提交内容过大，请缩短后重试。", 413) };
    }
    chunks.push(value);
  }
  const combined = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(combined)) as T };
  } catch {
    return { ok: false, response: securityResponse("请求格式无效。", 400) };
  }
}

export const requestBodyLimits = {
  coach: 320 * 1024,
  customTopic: 4 * 1024,
  demoDraft: 16 * 1024,
} as const;
