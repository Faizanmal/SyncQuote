/** Schedule work after the current effect so setState is not synchronous. */
export function deferEffect(task: () => void | Promise<void>): () => void {
  const timer = window.setTimeout(() => {
    void task();
  }, 0);
  return () => window.clearTimeout(timer);
}
