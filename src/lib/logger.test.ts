import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import {
  getLogger,
  setLogLevel,
  scrubSecrets,
  _resetLogCounters,
  _logCounters,
} from "./logger";

describe("logger.warnOnce + level", () => {
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

  it("inclui meta JSON quando os campos não são sensíveis", () => {
    const log = getLogger("test");
    log.warn("hello", { stage: "boot", n: 1 });
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('{"stage":"boot","n":1}'),
    );
  });
});

describe("logger.scrubSecrets — anti vazamento de credencial", () => {
  it("mascara chaves de credencial direto no objeto raiz", () => {
    const out = scrubSecrets({
      password: "p@ss",
      token: "abc",
      secret: "shh",
      authorization: "Bearer x.y.z",
      cookie: "lex=1; sb=eyJh.eyJh.eyJh",
      apiKey: "sk_live_abcdef",
      access_token: "eyJh.eyJh.eyJh",
      refresh_token: "v1.refresh",
    }) as Record<string, unknown>;
    expect(out["password"]).toBe("***");
    expect(out["token"]).toBe("***");
    expect(out["secret"]).toBe("***");
    expect(out["authorization"]).toBe("***");
    expect(out["cookie"]).toBe("***");
    expect(out["apiKey"]).toBe("***");
    expect(out["access_token"]).toBe("***");
    expect(out["refresh_token"]).toBe("***");
  });

  it("mascara chaves de credencial em camadas nested", () => {
    const out = scrubSecrets({
      user: { id: "u1", profile: { token: "abc" }, password: "p" },
      headers: { Authorization: "Bearer x" },
    }) as { user: { id: string; profile: { token: string }; password: string }; headers: { Authorization: string } };
    expect(out.user.id).toBe("u1");
    expect(out.user.profile.token).toBe("***");
    expect(out.user.password).toBe("***");
    expect(out.headers.Authorization).toBe("***");
  });

  it("mascara PII brasileiro (cpf, cnpj, oab, email, phone)", () => {
    const out = scrubSecrets({
      cpf: "111.222.333-44",
      cnpj: "11.222.333/0001-44",
      oab: "OAB/SP 123456",
      email: "x@y.com",
      phone: "+55 11 99999-0000",
      telefone: "11999990000",
    }) as Record<string, string>;
    expect(out["cpf"]).toBe("***");
    expect(out["cnpj"]).toBe("***");
    expect(out["oab"]).toBe("***");
    expect(out["email"]).toBe("***");
    expect(out["phone"]).toBe("***");
    expect(out["telefone"]).toBe("***");
  });

  it("reescreve URL com password embutido", () => {
    const out = scrubSecrets({
      url: "rediss://default:supersecret@host.upstash.io:6379",
    }) as { url: string };
    expect(out.url).toContain("rediss://default:***@host.upstash.io");
    expect(out.url).not.toContain("supersecret");
  });

  it("mascara JWT em strings sem chave sensível", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6IjEifQ.k1qF7Y3X9aZc2bLqJh7LqJh7LqJh7LqJh7LqJh7LqJ8";
    const out = scrubSecrets({
      raw: `Got token ${jwt} from request`,
    }) as { raw: string };
    expect(out.raw).toContain("***JWT***");
    expect(out.raw).not.toContain(jwt);
  });

  it("mascara Bearer em strings", () => {
    const out = scrubSecrets({
      header: "Authorization: Bearer abc.def.ghi",
    }) as { header: string };
    expect(out.header).toContain("Bearer ***");
    expect(out.header).not.toContain("abc.def.ghi");
  });

  it("não quebra com referência circular", () => {
    const a: Record<string, unknown> = { name: "a" };
    a["self"] = a;
    expect(() => scrubSecrets(a)).not.toThrow();
    const out = scrubSecrets(a) as { name: string; self: unknown };
    expect(out.name).toBe("a");
    expect(out.self).toBe("[circular]");
  });

  it("trata Error com message/stack passando pelo scrub", () => {
    const e = new Error("token=eyJh.eyJh.eyJh");
    const out = scrubSecrets(e) as { name: string; message: string; stack?: string };
    expect(out.name).toBe("Error");
    expect(out.message).toContain("***JWT***");
    expect(out.message).not.toContain("eyJh.eyJh.eyJh");
  });

  it("trunca strings absurdamente longas", () => {
    const big = "a".repeat(20_000);
    const out = scrubSecrets(big);
    expect(typeof out).toBe("string");
    expect((out as string).length).toBeLessThan(5_000);
    expect(out).toContain("(truncated)");
  });
});

describe("logger output integration", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    _resetLogCounters();
    setLogLevel("debug");
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it("não vaza segredo em log com meta sensível", () => {
    const log = getLogger("auth");
    log.warn("login retried", {
      userId: "u1",
      password: "p@ssw0rd",
      headers: { Authorization: "Bearer eyJh.eyJh.eyJh" },
      session: { refresh_token: "v1.r.fghij" },
    });
    const out = (warn.mock.calls[0]?.[0] ?? "") as string;
    expect(out).toContain('"userId":"u1"');
    expect(out).toContain('"password":"***"');
    expect(out).toContain('"refresh_token":"***"');
    expect(out).not.toContain("p@ssw0rd");
    expect(out).not.toContain("v1.r.fghij");
  });
});
