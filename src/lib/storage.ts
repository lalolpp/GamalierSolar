const PREFIX = "gamaliersolar:v2:";

const LEGACY_KEYS: Record<string, string[]> = {};

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(PREFIX + key);
  } catch {
    return null;
  }
}

export function readStorage<T>(key: string, fallback: T): T {
  let raw = readRaw(key);
  if (raw === null) {
    for (const legacyKey of LEGACY_KEYS[key] ?? []) {
      try {
        const legacy = window.localStorage.getItem(legacyKey);
        if (legacy !== null) {
          raw = legacy;
          writeStorage(key, JSON.parse(legacy) as T);
          window.localStorage.removeItem(legacyKey);
          break;
        }
      } catch {
        break;
      }
    }
  }
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorage<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    return;
  }
}

export function removeStorage(key: string): void {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    return;
  }
}
