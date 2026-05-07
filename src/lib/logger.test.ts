import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { getLogger, setLogLevel, _resetLogCounters, _logCounters } from "./logger";

describe("logger", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  let error: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    _resetLogCounters();
    setLogLevel("debug");
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    error = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
  });

  it("warnOnce loga apenas a primeira vez por chave", () => {
    const log = getLogger("test");
    log.warnOnce("redis-down", "primeira");
    log.warnOnce("redis-down", "segunda");
    log.warnOnce("redis-down", "terceira");
    expect(warn).toHaveBeenCalledTimes(1);
    const counters = _logCounters();
    const entry = counters.get("test:redis-down");
    expect(entry?.count).toBe(3);
  });

  it("warnOnce diferencia chaves distintas", () => {
    const log = getLogger("test");
    log.warnOnce("a", "msg a");
    log.warnOnce("b", "msg b");
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("respeita LOG_LEVEL", () => {
    const log = getLogger("test");
    setLogLevel("error");
    log.warn("should not appear");
    log.info("should not appear");
    log.error("should appear");
    expect(warn).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
  });

  it("inclui meta JSON", () => {
    const log = getLogger("test");
    log.warn("hello", { key: "v", n: 1 });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('{"key":"v","n":1}'));
  });
});
