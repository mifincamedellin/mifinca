/**
 * Global fetch interceptor.
 *
 * Responsibilities:
 * 1. Inject the Authorization header on all /api/* requests (both browser and desktop).
 * 2. In the Electron desktop shell: provide offline read-from-cache / write-to-queue
 *    behaviour when the device is not connected to the internet.
 */

const originalFetch = window.fetch.bind(window);

function getToken(): string | null {
  try {
    const raw = localStorage.getItem("finca-storage");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.token ?? null;
  } catch {
    return null;
  }
}

/** Normalise a URL to a path+search string (strips origin). */
function toPathAndSearch(rawUrl: string): string {
  try {
    const u = new URL(rawUrl, window.location.href);
    return u.pathname + u.search;
  } catch {
    return rawUrl;
  }
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const rawUrl =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;

  const isApiCall = rawUrl.startsWith("/api") || rawUrl.includes("/api/");
  if (!isApiCall) {
    return originalFetch(input, init);
  }

  // ── Build headers with auth token ─────────────────────────────────────────
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : {}),
  );
  const token = getToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();

  const desktop = window.miFincaDesktop;

  // ── Desktop offline path ───────────────────────────────────────────────────
  if (desktop?.isDesktop && !navigator.onLine) {
    const path = toPathAndSearch(rawUrl);

    if (method === "GET") {
      // Serve from the URL-keyed response cache; return [] as a safe fallback
      const cached = await desktop.getCachedResponse!(path).catch(() => null);
      const payload = cached !== null && cached !== undefined ? cached : [];
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Write (POST / PUT / PATCH / DELETE) — queue for later replay
    let bodyStr: string | null = null;
    if (init?.body) {
      bodyStr =
        typeof init.body === "string"
          ? init.body
          : init.body instanceof FormData
            ? null
            : JSON.stringify(init.body);
    } else if (input instanceof Request) {
      bodyStr = await input.clone().text().catch(() => null);
    }

    const queueId = await desktop.queueOfflineWrite!(method, path, bodyStr).catch(() => -1);
    const syntheticId = `offline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return new Response(
      JSON.stringify({ id: syntheticId, _offline: true, _queueId: queueId }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // ── Online path (browser and desktop) ────────────────────────────────────
  const response = await originalFetch(input, { ...init, headers });

  // Cache successful GET responses in desktop mode for later offline reads
  if (desktop?.isDesktop && method === "GET" && response.ok) {
    const path = toPathAndSearch(rawUrl);
    response
      .clone()
      .json()
      .then((data: unknown) => desktop.cacheResponse!(path, data))
      .catch(() => {});
  }

  return response;
};

export {};
