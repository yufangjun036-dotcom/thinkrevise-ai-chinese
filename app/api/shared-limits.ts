import { createHash, randomUUID } from "node:crypto";

// Atomic across instances; reset at UTC+8 midnight. Leases expire on crashes.
export const ACQUIRE_SCRIPT = `
local t = redis.call('TIME')
local now = tonumber(t[1])
local day = math.floor((now + 28800) / 86400)
local ttl = 86400 - ((now + 28800) % 86400)
local p = KEYS[1]
local vd = p .. ':d:' .. day .. ':v:' .. ARGV[1]
local gd = p .. ':d:' .. day .. ':all'
local vm = p .. ':m:' .. math.floor(now / 60) .. ':v:' .. ARGV[1]
local va = p .. ':active:v:' .. ARGV[1]
local ga = p .. ':active:all'
redis.call('ZREMRANGEBYSCORE', va, '-inf', now)
redis.call('ZREMRANGEBYSCORE', ga, '-inf', now)
if tonumber(redis.call('GET', vd) or '0') >= tonumber(ARGV[3]) then return {1, ttl} end
if tonumber(redis.call('GET', gd) or '0') >= tonumber(ARGV[4]) then return {2, ttl} end
if tonumber(redis.call('GET', vm) or '0') >= tonumber(ARGV[5]) then return {3, 60 - (now % 60)} end
if redis.call('ZCARD', va) >= tonumber(ARGV[6]) then return {4, 5} end
if redis.call('ZCARD', ga) >= tonumber(ARGV[7]) then return {5, 5} end
redis.call('INCR', vd)
redis.call('EXPIRE', vd, ttl + 60)
redis.call('INCR', gd)
redis.call('EXPIRE', gd, ttl + 60)
redis.call('INCR', vm)
redis.call('EXPIRE', vm, 120)
redis.call('ZADD', va, now + 600, ARGV[2])
redis.call('EXPIRE', va, 660)
redis.call('ZADD', ga, now + 600, ARGV[2])
redis.call('EXPIRE', ga, 660)
return {0, 0}
`;
export const RELEASE_SCRIPT = `
redis.call('ZREM', KEYS[1] .. ':active:v:' .. ARGV[1], ARGV[2])
redis.call('ZREM', KEYS[1] .. ':active:all', ARGV[2])
return 1
`;
type Limits = { perDay: number; globalPerDay: number; perMinute: number; perVisitorConcurrent: number; globalConcurrent: number };
export async function acquireShared(visitor: string, limits: Limits, site: string) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token || !url.startsWith("https://")) throw new Error("Shared limiter unavailable");
  const environment = process.env.VERCEL_ENV === "production" ? "production" : "preview";
  const prefix = `thinkrevise:limits:v1:{${site}-${environment}}`;
  const hash = createHash("sha256").update(visitor).digest("hex");
  const lease = randomUUID();
  async function command(script: string, args: (string | number)[]) {
    const response = await fetch(url!, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(["EVAL", script, 1, prefix, ...args]),
      cache: "no-store", signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Shared limiter unavailable");
    const data = await response.json() as { result?: unknown; error?: string };
    if (data.error || data.result === undefined) throw new Error("Shared limiter unavailable");
    return data.result;
  }
  const result = await command(ACQUIRE_SCRIPT, [hash, lease, limits.perDay, limits.globalPerDay, limits.perMinute, limits.perVisitorConcurrent, limits.globalConcurrent]);
  if (!Array.isArray(result) || result.length !== 2 || !Number.isInteger(result[0]) || result[0] < 0 || result[0] > 5 || !Number.isInteger(result[1])) throw new Error("Invalid limiter response");
  let released = false;
  return {
    code: result[0] as number, retryAfter: result[1] as number,
    async release() {
      if (released || result[0] !== 0) return;
      released = true;
      try { await command(RELEASE_SCRIPT, [hash, lease]); }
      catch { console.warn("Shared limiter lease release failed; lease will expire."); }
    },
  };
}

