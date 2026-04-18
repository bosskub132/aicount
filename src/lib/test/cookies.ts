type CookieEntry = { name: string; value: string };

export function makeFakeCookies(entries: CookieEntry[] = []) {
  const store = new Map<string, string>(entries.map((e) => [e.name, e.value]));
  return {
    get(name: string) {
      const value = store.get(name);
      return value === undefined ? undefined : { name, value };
    },
    getAll() {
      return Array.from(store.entries()).map(([name, value]) => ({ name, value }));
    },
    set(name: string, value: string) {
      store.set(name, value);
    },
    delete(name: string) {
      store.delete(name);
    },
    _raw: store,
  };
}

export type FakeCookies = ReturnType<typeof makeFakeCookies>;
