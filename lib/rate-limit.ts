import "server-only";

/**
 * 轻量内存限流（按实例生效，多实例部署时每实例独立计数，
 * 对这个体量的站点足够；如需全局一致可换 Redis）。
 */

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// 定期清理过期桶，避免 Map 无限增长（最多每 10 分钟扫一次）。
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 10 * 60 * 1000) return;
  lastSweep = now;
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key);
  });
}

/** 返回 true 表示放行；false 表示已超限。 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  sweep(now);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= limit;
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim() || "unknown";
  return request.headers.get("x-real-ip") || "unknown";
}
