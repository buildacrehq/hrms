// In-memory session cache — survives tab switches, cleared on app reload.
const store = new Map<string, unknown>();

export const cache = {
  get<T>(key: string): T | null {
    return (store.get(key) as T) ?? null;
  },
  set<T>(key: string, value: T) {
    store.set(key, value);
  },
};
