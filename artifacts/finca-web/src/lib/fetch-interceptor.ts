/**
 * Intercepts all global fetch requests to inject the Authorization header
 * from the Zustand persisted store.
 */
const originalFetch = window.fetch;

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

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : (input as Request).url;

  if (url.startsWith("/api")) {
    const headers = new Headers(init?.headers);
    const token = getToken();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    return originalFetch(input, { ...init, headers });
  }

  return originalFetch(input, init);
};

export {};
