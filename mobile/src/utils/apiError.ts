function stringifyDetail(detail: unknown): string | null {
  if (detail == null) return null;
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'number' || typeof detail === 'boolean') return String(detail);

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'msg' in item) return String((item as any).msg);
        return null;
      })
      .filter(Boolean);
    if (messages.length > 0) return messages.join('\n');
  }

  if (typeof detail === 'object' && 'msg' in detail) return String((detail as any).msg);

  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  const anyError = error as any;
  return stringifyDetail(anyError?.response?.data?.detail)
    ?? stringifyDetail(anyError?.message)
    ?? fallback;
}
