export function getProcessEnv(): Record<string, string | undefined> {
  const proc = (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process;
  return proc?.env ?? {};
}
