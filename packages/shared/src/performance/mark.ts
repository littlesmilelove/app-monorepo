export function perfMark(name: string, detail?: any) {
  if (!name) return;
  const g = globalThis as any;
  if (typeof g.__perfReportMark === 'function') {
    g.__perfReportMark({ name, detail });
    return;
  }

  // Buffer marks until reporter hooks are installed.
  // Timeline primarily uses absoluteTime, so buffering is acceptable.
  g.__perfMarkBuffer = g.__perfMarkBuffer || [];
  g.__perfMarkBuffer.push({
    name,
    detail,
    absoluteTime: Date.now(),
    timestamp:
      typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now(),
  });
}

export default {
  perfMark,
};
