/**
 * Intercepts all global fetch requests to inject the Authorization header
 * and handle common API concerns seamlessly with TanStack Query.
 */
const originalFetch = window.fetch;

window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  
  if (url.startsWith('/api')) {
    const headers = new Headers(init?.headers);
    const token = localStorage.getItem('finca_token');
    
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    
    // Default to JSON if not specified and not FormData
    if (!headers.has('Content-Type') && !(init?.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    return originalFetch(input, { ...init, headers });
  }

  return originalFetch(input, init);
};

export {};
