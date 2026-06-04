export type FlatRecord = Record<string, unknown>;

export function flattenJson(obj: unknown, prefix = ''): FlatRecord {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return prefix ? { [prefix]: obj } : {};
  }
  const result: FlatRecord = {};
  for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val !== null && typeof val === 'object' && !Array.isArray(val)) {
      Object.assign(result, flattenJson(val, fullKey));
    } else {
      result[fullKey] = val;
    }
  }
  return result;
}

export function unflattenJson(obj: FlatRecord): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    const parts = key.split('.');
    let cur: Record<string, unknown> = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (cur[parts[i]] === undefined || typeof cur[parts[i]] !== 'object' || Array.isArray(cur[parts[i]])) {
        cur[parts[i]] = {};
      }
      cur = cur[parts[i]] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]] = val;
  }
  return result;
}
