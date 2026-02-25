export interface FileIconInfo {
  icon: string;
  color?: string;
  kind: "glyph" | "asset";
}

export type FileIconPackId = "classic" | "catppuccin";

export interface FileIconPackOption {
  id: FileIconPackId;
  label: string;
  description: string;
}

interface FileIconPack {
  defaultDirectory: IconEntry;
  defaultFile: IconEntry;
  folderNames: Record<string, IconEntry>;
  fileNames: Record<string, IconEntry>;
  fileExtensions: Record<string, IconEntry>;
}

interface IconEntry {
  icon: string;
  kind: "glyph" | "asset";
  color?: string;
  openIcon?: string;
}

export interface FileIconOptions {
  expanded?: boolean;
}

function glyph(icon: string, color: string): IconEntry {
  return { icon, color, kind: "glyph" };
}

const CATPPUCCIN_BASE = "/vendor/catppuccin-icons/frappe";

function asset(name: string): IconEntry {
  return { icon: `${CATPPUCCIN_BASE}/${name}.svg`, kind: "asset" };
}

function assetFolder(name: string): IconEntry {
  return {
    icon: `${CATPPUCCIN_BASE}/${name}.svg`,
    openIcon: `${CATPPUCCIN_BASE}/${name}_open.svg`,
    kind: "asset",
  };
}

function assetFolderPair(closedName: string, openName: string): IconEntry {
  return {
    icon: `${CATPPUCCIN_BASE}/${closedName}.svg`,
    openIcon: `${CATPPUCCIN_BASE}/${openName}.svg`,
    kind: "asset",
  };
}

export const FILE_ICON_PACKS: readonly FileIconPackOption[] = [
  {
    id: "classic",
    label: "Bord Classic",
    description: "Original compact Bord glyphs",
  },
  {
    id: "catppuccin",
    label: "Catppuccin (VS Code)",
    description: "Bundled Catppuccin VS Code icon set",
  },
] as const;

const CLASSIC_PACK: FileIconPack = {
  defaultDirectory: glyph("📁", "var(--accent)"),
  defaultFile: glyph("·", "var(--text-secondary)"),
  folderNames: {
    ".git": glyph("⎇", "#f1502f"),
    "node_modules": glyph("⬢", "#8cc84b"),
    "src": glyph("◉", "#89b4fa"),
    "docs": glyph("📚", "#94e2d5"),
    "scripts": glyph("⚙", "#89e051"),
  },
  fileNames: {
    "package.json": glyph("{}", "#cbcb41"),
    "package-lock.json": glyph("🔒", "var(--text-secondary)"),
    "bun.lock": glyph("🔒", "var(--text-secondary)"),
    "bun.lockb": glyph("🔒", "var(--text-secondary)"),
    "tsconfig.json": glyph("TSC", "#3178c6"),
    "vite.config.ts": glyph("⚡", "#646cff"),
    "dockerfile": glyph("🐳", "#2496ed"),
    ".gitignore": glyph("⎇", "#f1502f"),
    ".env": glyph("⚙", "var(--warning)"),
    "readme.md": glyph("📄", "#519aba"),
  },
  fileExtensions: {
    ".d.ts": glyph("TS", "#3178c6"),
    ".ts": glyph("TS", "#3178c6"),
    ".tsx": glyph("TX", "#3178c6"),
    ".js": glyph("JS", "#f7df1e"),
    ".jsx": glyph("JX", "#f7df1e"),
    ".mjs": glyph("JS", "#f7df1e"),
    ".cjs": glyph("JS", "#f7df1e"),
    ".json": glyph("{}", "#cbcb41"),
    ".md": glyph("MD", "#519aba"),
    ".css": glyph("#", "#563d7c"),
    ".html": glyph("<>", "#e34c26"),
    ".py": glyph("PY", "#3572a5"),
    ".rs": glyph("RS", "#dea584"),
    ".go": glyph("GO", "#00add8"),
    ".sh": glyph("$", "#89e051"),
    ".zsh": glyph("$", "#89e051"),
    ".yaml": glyph("Y", "#cb171e"),
    ".yml": glyph("Y", "#cb171e"),
    ".toml": glyph("T", "#9c4221"),
    ".sql": glyph("SQ", "#e38c00"),
    ".svg": glyph("◇", "#ffb13b"),
    ".png": glyph("▣", "#a074c4"),
    ".jpg": glyph("▣", "#a074c4"),
    ".jpeg": glyph("▣", "#a074c4"),
    ".gif": glyph("▣", "#a074c4"),
    ".webp": glyph("▣", "#a074c4"),
    ".lock": glyph("🔒", "var(--text-secondary)"),
    ".env": glyph("⚙", "var(--warning)"),
  },
};

const CATPPUCCIN_PACK: FileIconPack = {
  defaultDirectory: assetFolderPair("_folder", "_folder_open"),
  defaultFile: asset("_file"),
  folderNames: {
    ".git": assetFolder("folder_git"),
    ".github": assetFolder("folder_github"),
    ".vscode": assetFolder("folder_vscode"),
    "src": assetFolder("folder_src"),
    "server": assetFolder("folder_server"),
    "dist": assetFolder("folder_dist"),
    "docs": assetFolder("folder_docs"),
    "doc": assetFolder("folder_docs"),
    "node_modules": assetFolder("folder_node"),
    "scripts": assetFolder("folder_scripts"),
    "script": assetFolder("folder_scripts"),
    "assets": assetFolder("folder_assets"),
    "components": assetFolder("folder_components"),
    "lib": assetFolder("folder_lib"),
    "themes": assetFolder("folder_themes"),
    "routes": assetFolder("folder_routes"),
    "public": assetFolder("folder_public"),
    "config": assetFolder("folder_config"),
    "src-tauri": assetFolder("folder_tauri"),
    "workflows": assetFolder("folder_workflows"),
    "images": assetFolder("folder_images"),
    "image": assetFolder("folder_images"),
    "styles": assetFolder("folder_styles"),
    "style": assetFolder("folder_styles"),
    "utils": assetFolder("folder_utils"),
    "util": assetFolder("folder_utils"),
    "types": assetFolder("folder_types"),
    "typings": assetFolder("folder_types"),
    "hooks": assetFolder("folder_hooks"),
    "plugins": assetFolder("folder_plugins"),
    "middleware": assetFolder("folder_middleware"),
    "packages": assetFolder("folder_packages"),
    "private": assetFolder("folder_private"),
    "tests": assetFolder("folder_tests"),
    "test": assetFolder("folder_tests"),
    "e2e": assetFolder("folder_tests"),
    "test-results": assetFolder("folder_tests"),
    "playwright-report": assetFolder("folder_tests"),
    "cert": assetFolder("folder_config"),
  },
  fileNames: {
    "package.json": asset("npm"),
    "package-lock.json": asset("lock"),
    "yarn.lock": asset("lock"),
    "pnpm-lock.yaml": asset("lock"),
    "bun.lock": asset("bun-lock"),
    "bun.lockb": asset("bun-lock"),
    "cargo.lock": asset("lock"),
    "cargo.toml": asset("toml"),
    "bunfig.toml": asset("toml"),
    "tsconfig.json": asset("typescript-config"),
    "tsconfig.base.json": asset("typescript-config"),
    "vite.config.ts": asset("vite"),
    "vite.config.js": asset("vite"),
    "dockerfile": asset("docker"),
    "docker-compose.yml": asset("docker"),
    "docker-compose.yaml": asset("docker"),
    ".gitignore": asset("git"),
    ".gitattributes": asset("git"),
    "readme.md": asset("readme"),
  },
  fileExtensions: {
    ".d.ts": asset("typescript-def"),
    ".ts": asset("typescript"),
    ".tsx": asset("typescript-react"),
    ".js": asset("javascript"),
    ".jsx": asset("javascript-react"),
    ".mjs": asset("javascript"),
    ".cjs": asset("javascript"),
    ".json": asset("json"),
    ".md": asset("markdown"),
    ".mdx": asset("markdown"),
    ".rs": asset("rust"),
    ".go": asset("go"),
    ".sh": asset("bash"),
    ".zsh": asset("bash"),
    ".bash": asset("bash"),
    ".toml": asset("toml"),
    ".html": asset("html"),
    ".htm": asset("html"),
    ".css": asset("css"),
    ".scss": asset("css"),
    ".sass": asset("css"),
    ".less": asset("css"),
    ".yaml": asset("yaml"),
    ".yml": asset("yaml"),
    ".lock": asset("lock"),
  },
};

const PACKS: Record<FileIconPackId, FileIconPack> = {
  classic: CLASSIC_PACK,
  catppuccin: CATPPUCCIN_PACK,
};

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function getBaseName(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments[segments.length - 1] || normalized;
}

function extensionCandidates(name: string): string[] {
  const dotSegments = name.split(".");
  if (dotSegments.length < 2) return [];

  const out: string[] = [];
  for (let i = 1; i < dotSegments.length; i += 1) {
    out.push(`.${dotSegments.slice(i).join(".")}`);
  }
  return out;
}

function getPack(packId: FileIconPackId): FileIconPack {
  return PACKS[packId] ?? CLASSIC_PACK;
}

function resolveEntry(entry: IconEntry, expanded: boolean | undefined): FileIconInfo {
  if (entry.kind === "asset") {
    return {
      kind: "asset",
      icon: expanded && entry.openIcon ? entry.openIcon : entry.icon,
    };
  }

  return {
    kind: "glyph",
    icon: entry.icon,
    color: entry.color,
  };
}

export function getFileIcon(
  name: string,
  type: "file" | "dir" | "symlink",
  packId: FileIconPackId = "classic",
  pathHint?: string,
  options?: FileIconOptions,
): FileIconInfo {
  const pack = getPack(packId);
  const sourceName = normalizeName(getBaseName(pathHint ?? name));
  const expanded = options?.expanded;

  if (type === "dir") {
    return resolveEntry(pack.folderNames[sourceName] ?? pack.defaultDirectory, expanded);
  }

  const byName = pack.fileNames[sourceName];
  if (byName) return resolveEntry(byName, false);

  const extensionMatches = extensionCandidates(sourceName);
  for (const ext of extensionMatches) {
    const match = pack.fileExtensions[ext];
    if (match) return resolveEntry(match, false);
  }

  return resolveEntry(pack.defaultFile, false);
}

const EXT_LANG: Record<string, string> = {
  ".ts": "typescript", ".tsx": "typescript", ".js": "javascript", ".jsx": "javascript",
  ".json": "json", ".md": "markdown", ".css": "css", ".html": "html",
  ".py": "python", ".rs": "rust", ".go": "go", ".sh": "bash",
  ".yaml": "yaml", ".yml": "yaml", ".toml": "toml", ".sql": "sql",
  ".xml": "xml", ".svg": "xml", ".java": "java", ".rb": "ruby",
  ".php": "php", ".c": "c", ".cpp": "cpp", ".swift": "swift",
};

export function getLanguage(name: string): string {
  const fileName = normalizeName(getBaseName(name));
  const candidates = extensionCandidates(fileName);
  for (const ext of candidates) {
    const lang = EXT_LANG[ext];
    if (lang) return lang;
  }
  return "plaintext";
}
