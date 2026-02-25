import { describe, expect, test } from "bun:test";
import { buildCdCommand, isPathWithinRoot, normalizePath, shellSingleQuote } from "./workspace-paths";

describe("workspace-paths", () => {
  test("normalizePath trims duplicate and trailing slashes", () => {
    expect(normalizePath("/Users/wilky///Developer/bord/"))
      .toBe("/Users/wilky/Developer/bord");
    expect(normalizePath("/"))
      .toBe("/");
  });

  test("isPathWithinRoot handles root and nested directories", () => {
    expect(isPathWithinRoot("/Users/wilky/Developer/bord", "/Users/wilky/Developer/bord"))
      .toBe(true);
    expect(isPathWithinRoot("/Users/wilky/Developer/bord", "/Users/wilky/Developer/bord/src/components"))
      .toBe(true);
    expect(isPathWithinRoot("/Users/wilky/Developer/bord", "/Users/wilky/Developer/other"))
      .toBe(false);
  });

  test("isPathWithinRoot rejects lookalike prefixes", () => {
    expect(isPathWithinRoot("/tmp/app", "/tmp/application"))
      .toBe(false);
  });

  test("shellSingleQuote escapes single quotes", () => {
    expect(shellSingleQuote("/tmp/O'Reilly/app"))
      .toBe("'/tmp/O'\"'\"'Reilly/app'");
  });

  test("buildCdCommand includes -- and trailing newline", () => {
    expect(buildCdCommand("/Users/wilky/Developer/bord"))
      .toBe("cd -- '/Users/wilky/Developer/bord'\n");
  });
});
