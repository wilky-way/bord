import { describe, expect, test } from "bun:test";
import {
  parseStatusPorcelain,
  parseNumstatOutput,
  parseAheadBehindOutput,
} from "./git-service";

describe("parseStatusPorcelain", () => {
  test("parses staged file (M in index)", () => {
    const result = parseStatusPorcelain("M  src/theme.css\n");
    expect(result.staged).toEqual([{ path: "src/theme.css", status: "M" }]);
    expect(result.unstaged).toEqual([]);
    expect(result.untracked).toEqual([]);
  });

  test("parses unstaged file (M in worktree)", () => {
    const result = parseStatusPorcelain(" M src/panel.ts\n");
    expect(result.staged).toEqual([]);
    expect(result.unstaged).toEqual([{ path: "src/panel.ts", status: "M" }]);
    expect(result.untracked).toEqual([]);
  });

  test("parses untracked file (??)", () => {
    const result = parseStatusPorcelain("?? notes/todo.md\n");
    expect(result.staged).toEqual([]);
    expect(result.unstaged).toEqual([]);
    expect(result.untracked).toEqual(["notes/todo.md"]);
  });

  test("parses both staged and unstaged (MM)", () => {
    const result = parseStatusPorcelain("MM src/app.ts\n");
    expect(result.staged).toEqual([{ path: "src/app.ts", status: "M" }]);
    expect(result.unstaged).toEqual([{ path: "src/app.ts", status: "M" }]);
  });

  test("parses added file (A in index)", () => {
    const result = parseStatusPorcelain("A  src/new-file.ts\n");
    expect(result.staged).toEqual([{ path: "src/new-file.ts", status: "A" }]);
  });

  test("parses deleted file (D in index)", () => {
    const result = parseStatusPorcelain("D  src/old-file.ts\n");
    expect(result.staged).toEqual([{ path: "src/old-file.ts", status: "D" }]);
  });

  test("handles empty output", () => {
    const result = parseStatusPorcelain("");
    expect(result.staged).toEqual([]);
    expect(result.unstaged).toEqual([]);
    expect(result.untracked).toEqual([]);
  });

  test("parses mixed status output", () => {
    const output = [
      "M  src/staged.ts",
      " M src/changed.ts",
      "?? new-file.md",
      "A  src/added.ts",
      "D  src/deleted.ts",
    ].join("\n");

    const result = parseStatusPorcelain(output);
    expect(result.staged).toHaveLength(3);
    expect(result.unstaged).toHaveLength(1);
    expect(result.untracked).toHaveLength(1);
    expect(result.staged.map((f) => f.status)).toEqual(["M", "A", "D"]);
  });
});

describe("parseNumstatOutput", () => {
  test("parses insertions and deletions", () => {
    const output = "10\t5\tsrc/app.ts\n3\t0\tsrc/utils.ts\n";
    const result = parseNumstatOutput(output);
    expect(result["src/app.ts"]).toEqual({ insertions: 10, deletions: 5 });
    expect(result["src/utils.ts"]).toEqual({ insertions: 3, deletions: 0 });
  });

  test("skips binary files (- -)", () => {
    const output = "-\t-\timage.png\n5\t2\tsrc/code.ts\n";
    const result = parseNumstatOutput(output);
    expect(result["image.png"]).toBeUndefined();
    expect(result["src/code.ts"]).toEqual({ insertions: 5, deletions: 2 });
  });

  test("handles empty output", () => {
    const result = parseNumstatOutput("");
    expect(Object.keys(result)).toHaveLength(0);
  });

  test("handles paths with tabs", () => {
    // Rename shows as "old\tnew" in the path part
    const output = "5\t3\told-name.ts\tnew-name.ts\n";
    const result = parseNumstatOutput(output);
    expect(result["old-name.ts\tnew-name.ts"]).toEqual({ insertions: 5, deletions: 3 });
  });
});

describe("parseAheadBehindOutput", () => {
  test("parses tab-separated counts", () => {
    expect(parseAheadBehindOutput("3\t5")).toEqual({ ahead: 5, behind: 3 });
  });

  test("handles zero values", () => {
    expect(parseAheadBehindOutput("0\t0")).toEqual({ ahead: 0, behind: 0 });
  });

  test("handles empty output", () => {
    expect(parseAheadBehindOutput("")).toEqual({ ahead: 0, behind: 0 });
  });

  test("handles whitespace-only output", () => {
    expect(parseAheadBehindOutput("   ")).toEqual({ ahead: 0, behind: 0 });
  });

  test("handles only ahead", () => {
    expect(parseAheadBehindOutput("0\t3")).toEqual({ ahead: 3, behind: 0 });
  });

  test("handles only behind", () => {
    expect(parseAheadBehindOutput("2\t0")).toEqual({ ahead: 0, behind: 2 });
  });
});
