// Shared transport boundary: at most one retry for a transient HTTP failure.
// Billing/auth errors are never retried, and the caller's deadline is retained.
export async function fetchCoachResponse(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, init);
    if (response.ok) {
      const data = await response.clone().json() as {status?: string};
      if (data.status && data.status !== "completed") throw new Error("AI_INCOMPLETE_RESPONSE");
      return response;
    }
    const detail = await response.clone().json().catch(() => ({})) as {error?: {code?: string; type?: string}};
    const code = detail.error?.code ?? detail.error?.type ?? "";
    const quota = /insufficient_quota|billing|credit|spend_limit/.test(code);
    const transient = [429, 500, 502, 503, 504].includes(response.status) && !quota;
    if (attempt === 0 && transient && !init.signal?.aborted) continue;
    throw new Error(quota ? "AI_QUOTA_UNAVAILABLE" : `AI_UPSTREAM_HTTP_${response.status}`);
  }
}

export function coachFailure(error: unknown, english: boolean) {
  const message = error instanceof Error ? error.message : "";
  const timeout = error instanceof Error && ["TimeoutError", "AbortError"].includes(error.name);
  const code = timeout ? "AI_TIMEOUT" : /AI_QUOTA_UNAVAILABLE/.test(message) ? "AI_QUOTA_UNAVAILABLE" : "AI_REVIEW_UNAVAILABLE";
  return {
    code,
    retryable: code !== "AI_QUOTA_UNAVAILABLE",
    error: english
      ? (timeout ? "The AI check timed out. Your draft is unchanged; please try again. No demo result has been substituted."
        : code === "AI_QUOTA_UNAVAILABLE" ? "AI credit is currently unavailable. Your draft is unchanged; please try again after service is restored."
        : "The AI check could not be completed reliably. Your draft is unchanged; please try again. No demo result has been substituted.")
      : (timeout ? "AI 检查等待超时，原稿已保留，请稍后重试。本次未使用演示结果替代真实反馈。"
        : code === "AI_QUOTA_UNAVAILABLE" ? "AI 服务额度暂不可用，原稿已保留，请在服务恢复后重试。"
        : "本次 AI 检查未能可靠完成，原稿已保留，请稍后重试。本次未使用演示结果替代真实反馈。"),
  };
}
