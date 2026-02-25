import { describe, expect, test } from "bun:test";
import { FILE_ICON_PACKS, getFileIcon } from "./file-icons";

describe("file-icons", () => {
  test("exposes built-in icon packs", () => {
    expect(FILE_ICON_PACKS.map((pack) => pack.id)).toEqual(["classic", "catppuccin"]);
  });

  test("resolves file name matches before extension", () => {
    const icon = getFileIcon("package.json", "file", "classic");
    expect(icon.icon).toBe("{}");
    expect(icon.kind).toBe("glyph");
  });

  test("resolves multi-part extensions", () => {
    const icon = getFileIcon("index.d.ts", "file", "classic");
    expect(icon.icon).toBe("TS");
  });

  test("resolves folder-specific icons", () => {
    const icon = getFileIcon("node_modules", "dir", "catppuccin");
    expect(icon.kind).toBe("asset");
    expect(icon.icon).toContain("folder_node.svg");
  });

  test("uses open folder icon when expanded", () => {
    const icon = getFileIcon("src", "dir", "catppuccin", "src", { expanded: true });
    expect(icon.kind).toBe("asset");
    expect(icon.icon).toContain("folder_src_open.svg");
  });

  test("falls back to default icon for unknown files", () => {
    const icon = getFileIcon("notes.unknownext", "file", "catppuccin");
    expect(icon.kind).toBe("asset");
    expect(icon.icon).toContain("_file.svg");
  });
});
