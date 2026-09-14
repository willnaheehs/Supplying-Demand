export function catalogUser(
  request: Request,
  development = false,
): string | null {
  const id = request.headers.get('oai-authenticated-user-id')?.trim();
  if (id) return id;
  // The production build removes this branch's caller flag. Local preview only.
  if (
    development &&
    ['localhost', '127.0.0.1', '[::1]'].includes(new URL(request.url).hostname)
  )
    return 'local-development';
  return null;
}
export function sameOriginMutation(request: Request): boolean {
  const origin = request.headers.get('origin');
  return (
    origin === new URL(request.url).origin &&
    request.headers.get('content-type')?.split(';')[0].trim() ===
      'application/json'
  );
}
