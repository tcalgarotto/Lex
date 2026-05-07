import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { MemoryLRU } from "./memory-lru";

describe("MemoryLRU", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("set/get retorna valor antes do TTL", () => {
    const c = new MemoryLRU<string>(10);
    c.set("k", "v", 60);
    expect(c.get("k")).toBe("v");
  });

  it("expira após TTL", () => {
    const c = new MemoryLRU<string>(10);
    c.set("k", "v", 1);
    vi.advanceTimersByTime(2_000);
    expect(c.get("k")).toBeNull();
  });

  it("LRU evicta o mais antigo quando atinge limite", () => {
    const c = new MemoryLRU<string>(2);
    c.set("a", "1", 60);
    c.set("b", "2", 60);
    c.set("c", "3", 60);
    expect(c.get("a")).toBeNull();
    expect(c.get("b")).toBe("2");
    expect(c.get("c")).toBe("3");
  });

  it("get atualiza ordem (move-to-end)", () => {
    const c = new MemoryLRU<string>(2);
    c.set("a", "1", 60);
    c.set("b", "2", 60);
    c.get("a"); // a vira mais recente
    c.set("c", "3", 60);
    expect(c.get("a")).toBe("1");
    expect(c.get("b")).toBeNull(); // b foi evictado
  });

  it("clear esvazia o cache", () => {
    const c = new MemoryLRU<number>(5);
    c.set("x", 1, 60);
    c.clear();
    expect(c.get("x")).toBeNull();
    expect(c.size).toBe(0);
  });
});
