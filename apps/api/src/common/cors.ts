/**
 * CORS origin check. Entries are exact origins, or patterns with a single `*` wildcard such as
 * `https://*.vercel.app` (handy for Vercel preview deployments).
 */
export function originMatcher(allowed: string[]) {
  const patterns = allowed.map((entry) =>
    entry.includes('*')
      ? new RegExp(`^${entry.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[a-z0-9-]+')}$`, 'i')
      : entry.replace(/\/$/, ''),
  );
  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    if (!origin) return callback(null, true); // server-to-server, curl, health checks
    const ok = patterns.some((p) => (typeof p === 'string' ? p === origin : p.test(origin)));
    callback(null, ok);
  };
}
