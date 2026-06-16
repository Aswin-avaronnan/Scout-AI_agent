import { useSessionStore } from '../store/session';

export async function fetchBackend(endpoint: string, options: any = {}) {
  const { provider, apiKey, githubToken } = useSessionStore.getState();
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:7860';

  const headers = {
    'Content-Type': 'application/json',
    'X-User-Api-Key': apiKey,
    ...(githubToken ? { 'X-GitHub-Token': githubToken } : {}),
    ...options.headers,
  };

  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'API request failed');
  }

  return response.json();
}
