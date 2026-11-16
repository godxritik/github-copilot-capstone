class MemoryStorage implements Storage {
  private store: Record<string, string> = {};
  get length() { return Object.keys(this.store).length; }
  clear() { this.store = {}; }
  getItem(key: string) { return this.store[key] ?? null; }
  setItem(key: string, value: string) { this.store[key] = String(value); }
  removeItem(key: string) { delete this.store[key]; }
  key(index: number) { return Object.keys(this.store)[index] ?? null; }
}

const storage = new MemoryStorage();
const memorySessionStorage = new MemoryStorage();
Object.defineProperty(window, 'localStorage', {
  value: storage,
  writable: true,
});
Object.defineProperty(globalThis, 'localStorage', {
  value: storage,
  writable: true,
});
Object.defineProperty(window, 'sessionStorage', {
  value: memorySessionStorage,
  writable: true,
});
Object.defineProperty(globalThis, 'sessionStorage', {
  value: memorySessionStorage,
  writable: true,
});