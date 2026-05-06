export function getApiErrorMessage(error: unknown, fallback: string) {
  const anyError = error as any;
  return anyError?.response?.data?.detail ?? anyError?.message ?? fallback;
}
