import { useSessionStore } from '../store/session';

export async function fetchBackend(endpoint: string, options: any = {}) {
  const { provider, apiKey, githubToken } = useSessionStore.getState();
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7860';

  const headers: any = {
    'X-User-Api-Key': apiKey,
    ...(githubToken ? { 'X-GitHub-Token': githubToken } : {}),
    ...options.headers,
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    // Safely parse error — backend may return JSON detail or HTML (e.g. Cloudflare 502)
    let message = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errorBody = await response.json();
      if (errorBody.detail) {
        message = Array.isArray(errorBody.detail)
          ? errorBody.detail.map((e: any) => e.msg).join(', ')
          : String(errorBody.detail);
      }
    } catch {
      // Non-JSON body (HTML gateway error, etc.) — fall back to plain text
      try {
        const text = await response.text();
        if (text) message = `Server error (${response.status}): ${text.slice(0, 200)}`;
      } catch { /* ignore */ }
    }
    throw new Error(message);
  }

  return response.json();
}

