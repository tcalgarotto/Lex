import { afterEach, describe, expect, it } from "vitest";
import {
  readJustosN8nServiceToken,
  readJustosN8nWebhookSecret,
  readJustosN8nWebhookUrl,
} from "@/lib/justos/env";

const env = process.env;

afterEach(() => {
  process.env = { ...env };
});

describe("justos env aliases", () => {
  it("prefere JUSTOS_* sobre LEX_*", () => {
    process.env["JUSTOS_N8N_WEBHOOK_URL"] = "http://justos.example/webhook";
    process.env["LEX_N8N_WEBHOOK_URL"] = "http://lex.example/webhook";
    expect(readJustosN8nWebhookUrl()).toBe("http://justos.example/webhook");
  });

  it("fallback LEX_* quando JUSTOS ausente", () => {
    delete process.env["JUSTOS_N8N_SERVICE_TOKEN"];
    process.env["LEX_N8N_SERVICE_TOKEN"] = "token-lex";
    expect(readJustosN8nServiceToken()).toBe("token-lex");
  });

  it("secret com fallback", () => {
    delete process.env["JUSTOS_N8N_WEBHOOK_SECRET"];
    process.env["LEX_N8N_WEBHOOK_SECRET"] = "sec";
    expect(readJustosN8nWebhookSecret()).toBe("sec");
  });
});
