export async function fetchApi<T>(
  url: string,
  options?: RequestInit,
): Promise<T> {
  const headers = new Headers(options?.headers);
  if (options?.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const contentType = res.headers.get("content-type") ?? "";
    const body = contentType.includes("application/json")
      ? await res.json().catch(() => ({}))
      : { error: await res.text().catch(() => "") };
    const method = options?.method ?? "GET";
    const reason = body.error ?? `Request failed: ${res.status} ${url}`;
    throw new Error(`[${method} ${url}] ${reason}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
