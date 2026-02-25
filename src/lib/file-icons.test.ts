import { describe, expect, test } from "bun:test";
import { FILE_ICON_PACKS, getFileIcon } from "./file-icons";

describe("file-icons", () => {
  test("exposes built-in icon packs", () => {
    expect(FILE_ICON_PACKS.map((pack) => pack.id)).toEqual(["classic", "catppuccin", "material", "vscode"]);
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

  test("uses open folder icon when expanded in material pack", () => {
    const icon = getFileIcon("src", "dir", "material", "src", { expanded: true });
    expect(icon.kind).toBe("asset");
    expect(icon.icon).toContain("folder-src-open.svg");
  });

  test("uses open folder icon when expanded in vscode pack", () => {
    const icon = getFileIcon("src", "dir", "vscode", "src", { expanded: true });
    expect(icon.kind).toBe("asset");
    expect(icon.icon).toContain("folder_type_src_opened.svg");
  });

  test("resolves vscode typescript icon", () => {
    const icon = getFileIcon("index.ts", "file", "vscode");
    expect(icon.kind).toBe("asset");
    expect(icon.icon).toContain("file_type_typescript.svg");
  });

  test("falls back to default icon for unknown files", () => {
    const icon = getFileIcon("notes.unknownext", "file", "catppuccin");
    expect(icon.kind).toBe("asset");
    expect(icon.icon).toContain("_file.svg");
  });

  test("falls back to Material default file icon for unknown files", () => {
    const icon = getFileIcon("notes.unknownext", "file", "material");
    expect(icon.kind).toBe("asset");
    expect(icon.icon).toContain("document.svg");
  });
});
