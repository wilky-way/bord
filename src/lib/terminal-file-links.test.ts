import { describe, expect, test } from "bun:test";
import { createTerminalFileLinkProvider, parseTerminalFileLink } from "./terminal-file-links";

describe("parseTerminalFileLink", () => {
  test("parses file:// links", () => {
    const parsed = parseTerminalFileLink("file:///Users/wilky/Developer/bord/src/App.tsx");
    expect(parsed).toEqual({ path: "/Users/wilky/Developer/bord/src/App.tsx", line: undefined, column: undefined });
  });

  test("parses suffix and hash positions", () => {
    const fromSuffix = parseTerminalFileLink("file:///Users/wilky/Developer/bord/src/App.tsx:42:7");
    expect(fromSuffix).toEqual({ path: "/Users/wilky/Developer/bord/src/App.tsx", line: 42, column: 7 });

    const fromHash = parseTerminalFileLink("file:///Users/wilky/Developer/bord/src/App.tsx#L20C3");
    expect(fromHash).toEqual({ path: "/Users/wilky/Developer/bord/src/App.tsx", line: 20, column: 3 });
  });

  test("parses editor links", () => {
    const parsed = parseTerminalFileLink("cursor://file/Users/wilky/Developer/bord/src/App.tsx?line=9&column=2");
    expect(parsed).toEqual({ path: "/Users/wilky/Developer/bord/src/App.tsx", line: 9, column: 2 });
  });

  test("rejects non-local links", () => {
    expect(parseTerminalFileLink("https://example.com/file.ts")).toBeNull();
    expect(parseTerminalFileLink("vscode://repo/Users/wilky/Developer/bord/src/App.tsx")).toBeNull();
    expect(parseTerminalFileLink("file://example.com/Users/wilky/Developer/bord/src/App.tsx")).toBeNull();
  });
});

function createLine(text: string, ids: number[]) {
  return {
    length: text.length,
    translateToString: () => text,
    getCell(x: number) {
      if (x < 0 || x >= text.length) return undefined;
      return {
        getHyperlinkId: () => ids[x] ?? 0,
      };
    },
  };
}

function createMockTerminal(text: string, ids: number[], uriMap: Record<number, string | null>) {
  return {
    buffer: {
      active: {
        getLine: (row: number) => row === 0 ? createLine(text, ids) : undefined,
      },
    },
    wasmTerm: {
      getHyperlinkUri: (id: number) => uriMap[id] ?? null,
    },
  };
}

describe("createTerminalFileLinkProvider", () => {
  test("opens OSC8 local links", () => {
    const opened: string[] = [];
    const terminal = createMockTerminal(
      " abc ",
      [0, 1, 1, 1, 0],
      { 1: "file:///Users/wilky/Developer/bord/src/App.tsx:10:2" },
    );
    const provider = createTerminalFileLinkProvider(terminal as any, (link) => {
      opened.push(link.path);
    });

    let links: any[] | undefined;
    provider.provideLinks(0, (result) => {
      links = result;
    });

    expect(links).toHaveLength(1);
    expect(links![0].range.start).toEqual({ x: 1, y: 0 });
    expect(links![0].range.end).toEqual({ x: 3, y: 0 });

    let prevented = false;
    let stopped = false;
    links![0].activate({
      button: 0,
      preventDefault: () => {
        prevented = true;
      },
      stopPropagation: () => {
        stopped = true;
      },
    });

    expect(opened).toEqual(["/Users/wilky/Developer/bord/src/App.tsx"]);
    expect(prevented).toBe(true);
    expect(stopped).toBe(true);
  });

  test("detects plain relative file references in row text", () => {
    const opened: string[] = [];
    const terminal = createMockTerminal(
      "See `src/lib/ws.ts:58` and ignore https://example.com",
      [],
      {},
    );
    const provider = createTerminalFileLinkProvider(
      terminal as any,
      (link) => {
        opened.push(link.path);
      },
      () => "/Users/wilky/Developer/bord",
    );

    let links: any[] | undefined;
    provider.provideLinks(0, (result) => {
      links = result;
    });

    expect(links).toHaveLength(1);
    expect(links![0].text).toBe("/Users/wilky/Developer/bord/src/lib/ws.ts");

    links![0].activate({
      button: 0,
      preventDefault: () => {},
      stopPropagation: () => {},
    });

    expect(opened).toEqual(["/Users/wilky/Developer/bord/src/lib/ws.ts"]);
  });

  test("detects file path wrapped by tool labels like Update(...) ", () => {
    const terminal = createMockTerminal("Update(e2e/page-objects/file-panel.po.ts)", [], {});
    const provider = createTerminalFileLinkProvider(
      terminal as any,
      () => {},
      () => "/Users/wilky/Developer/bord",
    );

    let links: any[] | undefined;
    provider.provideLinks(0, (result) => {
      links = result;
    });

    expect(links).toHaveLength(1);
    expect(links![0].text).toBe("/Users/wilky/Developer/bord/e2e/page-objects/file-panel.po.ts");
  });

  test("ignores non-file tokens", () => {
    const terminal = createMockTerminal("README.md:1 https://example.com", [], {});
    const provider = createTerminalFileLinkProvider(terminal as any, () => {}, () => "/Users/wilky/Developer/bord");

    let links: any[] | undefined;
    provider.provideLinks(0, (result) => {
      links = result;
    });

    expect(links).toBeUndefined();
  });
});
