import { describe, expect, test } from "bun:test";
import {
  buildResumeCommand,
  getProviderFromCommand,
  getResumeSessionId,
} from "./providers";

describe("provider command helpers", () => {
  test("builds provider-specific resume commands", () => {
    expect(buildResumeCommand("claude", "claude-id")).toEqual(["claude", "--resume", "claude-id"]);
    expect(buildResumeCommand("codex", "codex-id")).toEqual(["codex", "resume", "codex-id"]);
    expect(buildResumeCommand("opencode", "open-id")).toEqual(["opencode", "--session", "open-id"]);
  });

  test("detects providers from command binaries", () => {
    expect(getProviderFromCommand(["claude"])).toBe("claude");
    expect(getProviderFromCommand(["CODEX"])).toBe("codex");
    expect(getProviderFromCommand(["/usr/local/bin/codex"])).toBe("codex");
    expect(getProviderFromCommand(["C:\\tools\\codex.cmd"])).toBe("codex");
    expect(getProviderFromCommand(["C:\\tools\\opencode.exe"])).toBe("opencode");
    expect(getProviderFromCommand(undefined)).toBeUndefined();
  });

  test("extracts resume session IDs by provider", () => {
    expect(getResumeSessionId(["claude", "--resume", "claude-session"])).toBe("claude-session");
    expect(getResumeSessionId(["codex", "resume", "codex-session"])).toBe("codex-session");
    expect(getResumeSessionId(["opencode", "--session", "open-session"])).toBe("open-session");
    expect(getResumeSessionId(["opencode", "--session=open-inline"])).toBe("open-inline");
    expect(getResumeSessionId(["opencode", "-s", "open-short"])).toBe("open-short");
  });

  test("supports unknown binaries with legacy --resume", () => {
    expect(getResumeSessionId(["custom-cli", "--resume", "legacy-id"])).toBe("legacy-id");
    expect(getResumeSessionId(["codex", "resume", "--last"])).toBeUndefined();
  });
});
