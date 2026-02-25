export interface FileIconInfo {
  icon: string;
  color?: string;
  kind: "glyph" | "asset";
}

export type FileIconPackId = "classic" | "catppuccin" | "material" | "vscode";

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

function assetFrom(base: string, name: string): IconEntry {
  return { icon: `${base}/${name}.svg`, kind: "asset" };
}

function assetFolderPairFrom(base: string, closedName: string, openName: string): IconEntry {
  return {
    icon: `${base}/${closedName}.svg`,
    openIcon: `${base}/${openName}.svg`,
    kind: "asset",
  };
}

const CATPPUCCIN_BASE = "/vendor/catppuccin-icons/frappe";
const MATERIAL_BASE = "/vendor/material-icons";
const VSCODE_BASE = "/vendor/vscode-icons";

function catppuccinAsset(name: string): IconEntry {
  return assetFrom(CATPPUCCIN_BASE, name);
}

function catppuccinFolder(name: string): IconEntry {
  return assetFolderPairFrom(CATPPUCCIN_BASE, name, `${name}_open`);
}

function catppuccinFolderPair(closedName: string, openName: string): IconEntry {
  return assetFolderPairFrom(CATPPUCCIN_BASE, closedName, openName);
}

function materialAsset(name: string): IconEntry {
  return assetFrom(MATERIAL_BASE, name);
}

function materialFolder(name: string): IconEntry {
  return assetFolderPairFrom(MATERIAL_BASE, name, `${name}-open`);
}

function vscodeAsset(name: string): IconEntry {
  return assetFrom(VSCODE_BASE, name);
}

function vscodeFolder(name: string): IconEntry {
  return assetFolderPairFrom(VSCODE_BASE, name, `${name}_opened`);
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
  {
    id: "material",
    label: "Material Icon Theme",
    description: "Bundled Material Icon Theme assets",
  },
  {
    id: "vscode",
    label: "vscode-icons",
    description: "Bundled official vscode-icons assets",
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
  defaultDirectory: catppuccinFolderPair("_folder", "_folder_open"),
  defaultFile: catppuccinAsset("_file"),
  folderNames: {
    ".git": catppuccinFolder("folder_git"),
    ".github": catppuccinFolder("folder_github"),
    ".vscode": catppuccinFolder("folder_vscode"),
    "src": catppuccinFolder("folder_src"),
    "server": catppuccinFolder("folder_server"),
    "dist": catppuccinFolder("folder_dist"),
    "docs": catppuccinFolder("folder_docs"),
    "doc": catppuccinFolder("folder_docs"),
    "node_modules": catppuccinFolder("folder_node"),
    "scripts": catppuccinFolder("folder_scripts"),
    "script": catppuccinFolder("folder_scripts"),
    "assets": catppuccinFolder("folder_assets"),
    "components": catppuccinFolder("folder_components"),
    "lib": catppuccinFolder("folder_lib"),
    "themes": catppuccinFolder("folder_themes"),
    "routes": catppuccinFolder("folder_routes"),
    "public": catppuccinFolder("folder_public"),
    "config": catppuccinFolder("folder_config"),
    "src-tauri": catppuccinFolder("folder_tauri"),
    "workflows": catppuccinFolder("folder_workflows"),
    "images": catppuccinFolder("folder_images"),
    "image": catppuccinFolder("folder_images"),
    "styles": catppuccinFolder("folder_styles"),
    "style": catppuccinFolder("folder_styles"),
    "utils": catppuccinFolder("folder_utils"),
    "util": catppuccinFolder("folder_utils"),
    "types": catppuccinFolder("folder_types"),
    "typings": catppuccinFolder("folder_types"),
    "hooks": catppuccinFolder("folder_hooks"),
    "plugins": catppuccinFolder("folder_plugins"),
    "middleware": catppuccinFolder("folder_middleware"),
    "packages": catppuccinFolder("folder_packages"),
    "private": catppuccinFolder("folder_private"),
    "tests": catppuccinFolder("folder_tests"),
    "test": catppuccinFolder("folder_tests"),
    "e2e": catppuccinFolder("folder_tests"),
    "test-results": catppuccinFolder("folder_tests"),
    "playwright-report": catppuccinFolder("folder_tests"),
    "cert": catppuccinFolder("folder_config"),
  },
  fileNames: {
    "package.json": catppuccinAsset("npm"),
    "package-lock.json": catppuccinAsset("lock"),
    "yarn.lock": catppuccinAsset("lock"),
    "pnpm-lock.yaml": catppuccinAsset("lock"),
    "bun.lock": catppuccinAsset("bun-lock"),
    "bun.lockb": catppuccinAsset("bun-lock"),
    "cargo.lock": catppuccinAsset("lock"),
    "cargo.toml": catppuccinAsset("toml"),
    "bunfig.toml": catppuccinAsset("toml"),
    "tsconfig.json": catppuccinAsset("typescript-config"),
    "tsconfig.base.json": catppuccinAsset("typescript-config"),
    "vite.config.ts": catppuccinAsset("vite"),
    "vite.config.js": catppuccinAsset("vite"),
    "dockerfile": catppuccinAsset("docker"),
    "docker-compose.yml": catppuccinAsset("docker"),
    "docker-compose.yaml": catppuccinAsset("docker"),
    ".gitignore": catppuccinAsset("git"),
    ".gitattributes": catppuccinAsset("git"),
    "readme.md": catppuccinAsset("readme"),
  },
  fileExtensions: {
    ".d.ts": catppuccinAsset("typescript-def"),
    ".ts": catppuccinAsset("typescript"),
    ".tsx": catppuccinAsset("typescript-react"),
    ".js": catppuccinAsset("javascript"),
    ".jsx": catppuccinAsset("javascript-react"),
    ".mjs": catppuccinAsset("javascript"),
    ".cjs": catppuccinAsset("javascript"),
    ".json": catppuccinAsset("json"),
    ".md": catppuccinAsset("markdown"),
    ".mdx": catppuccinAsset("markdown"),
    ".rs": catppuccinAsset("rust"),
    ".go": catppuccinAsset("go"),
    ".sh": catppuccinAsset("bash"),
    ".zsh": catppuccinAsset("bash"),
    ".bash": catppuccinAsset("bash"),
    ".toml": catppuccinAsset("toml"),
    ".html": catppuccinAsset("html"),
    ".htm": catppuccinAsset("html"),
    ".css": catppuccinAsset("css"),
    ".scss": catppuccinAsset("css"),
    ".sass": catppuccinAsset("css"),
    ".less": catppuccinAsset("css"),
    ".yaml": catppuccinAsset("yaml"),
    ".yml": catppuccinAsset("yaml"),
    ".lock": catppuccinAsset("lock"),
  },
};

const MATERIAL_PACK: FileIconPack = {
  defaultDirectory: materialFolder("folder-base"),
  defaultFile: materialAsset("document"),
  folderNames: {
    ".git": materialFolder("folder-git"),
    ".github": materialFolder("folder-github"),
    ".vscode": materialFolder("folder-vscode"),
    "src": materialFolder("folder-src"),
    "server": materialFolder("folder-server"),
    "dist": materialFolder("folder-dist"),
    "docs": materialFolder("folder-docs"),
    "doc": materialFolder("folder-docs"),
    "node_modules": materialFolder("folder-node"),
    "scripts": materialFolder("folder-scripts"),
    "script": materialFolder("folder-scripts"),
    "assets": materialFolder("folder-images"),
    "components": materialFolder("folder-components"),
    "lib": materialFolder("folder-lib"),
    "themes": materialFolder("folder-theme"),
    "routes": materialFolder("folder-routes"),
    "public": materialFolder("folder-public"),
    "config": materialFolder("folder-config"),
    "src-tauri": materialFolder("folder-src-tauri"),
    "workflows": materialFolder("folder-github"),
    "images": materialFolder("folder-images"),
    "image": materialFolder("folder-images"),
    "styles": materialFolder("folder-css"),
    "style": materialFolder("folder-css"),
    "utils": materialFolder("folder-utils"),
    "util": materialFolder("folder-utils"),
    "types": materialFolder("folder-typescript"),
    "typings": materialFolder("folder-typescript"),
    "hooks": materialFolder("folder-components"),
    "plugins": materialFolder("folder-components"),
    "middleware": materialFolder("folder-middleware"),
    "packages": materialFolder("folder-packages"),
    "private": materialFolder("folder-private"),
    "tests": materialFolder("folder-test"),
    "test": materialFolder("folder-test"),
    "e2e": materialFolder("folder-test"),
    "test-results": materialFolder("folder-test"),
    "playwright-report": materialFolder("folder-test"),
    "cert": materialFolder("folder-config"),
  },
  fileNames: {
    "package.json": materialAsset("npm"),
    "package-lock.json": materialAsset("lock"),
    "yarn.lock": materialAsset("yarn"),
    "pnpm-lock.yaml": materialAsset("pnpm"),
    "bun.lock": materialAsset("bun"),
    "bun.lockb": materialAsset("bun"),
    "cargo.lock": materialAsset("lock"),
    "cargo.toml": materialAsset("toml"),
    "bunfig.toml": materialAsset("bun"),
    "tsconfig.json": materialAsset("tsconfig"),
    "tsconfig.base.json": materialAsset("tsconfig"),
    "vite.config.ts": materialAsset("vite"),
    "vite.config.js": materialAsset("vite"),
    "dockerfile": materialAsset("docker"),
    "docker-compose.yml": materialAsset("docker"),
    "docker-compose.yaml": materialAsset("docker"),
    ".gitignore": materialAsset("git"),
    ".gitattributes": materialAsset("git"),
    "readme.md": materialAsset("readme"),
    ".env": materialAsset("settings"),
    ".env.local": materialAsset("settings"),
    ".editorconfig": materialAsset("settings"),
  },
  fileExtensions: {
    ".d.ts": materialAsset("typescript-def"),
    ".ts": materialAsset("typescript"),
    ".tsx": materialAsset("react_ts"),
    ".js": materialAsset("javascript"),
    ".jsx": materialAsset("react"),
    ".mjs": materialAsset("javascript"),
    ".cjs": materialAsset("javascript"),
    ".json": materialAsset("json"),
    ".md": materialAsset("markdown"),
    ".mdx": materialAsset("markdown"),
    ".rs": materialAsset("rust"),
    ".go": materialAsset("go"),
    ".sh": materialAsset("bashly"),
    ".zsh": materialAsset("bashly"),
    ".bash": materialAsset("bashly"),
    ".toml": materialAsset("toml"),
    ".html": materialAsset("html"),
    ".htm": materialAsset("html"),
    ".css": materialAsset("css"),
    ".scss": materialAsset("sass"),
    ".sass": materialAsset("sass"),
    ".less": materialAsset("sass"),
    ".yaml": materialAsset("yaml"),
    ".yml": materialAsset("yaml"),
    ".lock": materialAsset("lock"),
    ".xml": materialAsset("xml"),
    ".svg": materialAsset("svg"),
    ".png": materialAsset("image"),
    ".jpg": materialAsset("image"),
    ".jpeg": materialAsset("image"),
    ".gif": materialAsset("image"),
    ".webp": materialAsset("image"),
  },
};

const VSCODE_PACK: FileIconPack = {
  defaultDirectory: assetFolderPairFrom(VSCODE_BASE, "default_folder", "default_folder_opened"),
  defaultFile: vscodeAsset("default_file"),
  folderNames: {
    ".git": vscodeFolder("folder_type_git"),
    ".github": vscodeFolder("folder_type_github"),
    ".vscode": vscodeFolder("folder_type_vscode"),
    "src": vscodeFolder("folder_type_src"),
    "server": vscodeFolder("folder_type_server"),
    "dist": vscodeFolder("folder_type_dist"),
    "docs": vscodeFolder("folder_type_docs"),
    "doc": vscodeFolder("folder_type_docs"),
    "node_modules": vscodeFolder("folder_type_node"),
    "scripts": vscodeFolder("folder_type_script"),
    "script": vscodeFolder("folder_type_script"),
    "assets": vscodeFolder("folder_type_images"),
    "components": vscodeFolder("folder_type_component"),
    "lib": vscodeFolder("folder_type_library"),
    "themes": vscodeFolder("folder_type_theme"),
    "routes": vscodeFolder("folder_type_route"),
    "public": vscodeFolder("folder_type_public"),
    "config": vscodeFolder("folder_type_config"),
    "src-tauri": vscodeFolder("folder_type_tauri"),
    "workflows": vscodeFolder("folder_type_github"),
    "images": vscodeFolder("folder_type_images"),
    "image": vscodeFolder("folder_type_images"),
    "styles": vscodeFolder("folder_type_style"),
    "style": vscodeFolder("folder_type_style"),
    "utils": vscodeFolder("folder_type_helper"),
    "util": vscodeFolder("folder_type_helper"),
    "types": vscodeFolder("folder_type_typescript"),
    "typings": vscodeFolder("folder_type_typescript"),
    "hooks": vscodeFolder("folder_type_hook"),
    "plugins": vscodeFolder("folder_type_plugin"),
    "middleware": vscodeFolder("folder_type_middleware"),
    "packages": vscodeFolder("folder_type_package"),
    "private": vscodeFolder("folder_type_private"),
    "tests": vscodeFolder("folder_type_test"),
    "test": vscodeFolder("folder_type_test"),
    "e2e": vscodeFolder("folder_type_e2e"),
    "test-results": vscodeFolder("folder_type_test"),
    "playwright-report": vscodeFolder("folder_type_test"),
    "cert": vscodeFolder("folder_type_config"),
  },
  fileNames: {
    "package.json": vscodeAsset("file_type_npm"),
    "package-lock.json": vscodeAsset("file_type_npm"),
    "yarn.lock": vscodeAsset("file_type_yarn"),
    "pnpm-lock.yaml": vscodeAsset("file_type_pnpm"),
    "bun.lock": vscodeAsset("file_type_bun"),
    "bun.lockb": vscodeAsset("file_type_bun"),
    "cargo.lock": vscodeAsset("file_type_cargo"),
    "cargo.toml": vscodeAsset("file_type_toml"),
    "bunfig.toml": vscodeAsset("file_type_bunfig"),
    "tsconfig.json": vscodeAsset("file_type_tsconfig"),
    "tsconfig.base.json": vscodeAsset("file_type_tsconfig"),
    "vite.config.ts": vscodeAsset("file_type_vite"),
    "vite.config.js": vscodeAsset("file_type_vite"),
    "dockerfile": vscodeAsset("file_type_docker"),
    "docker-compose.yml": vscodeAsset("file_type_docker"),
    "docker-compose.yaml": vscodeAsset("file_type_docker"),
    ".gitignore": vscodeAsset("file_type_git"),
    ".gitattributes": vscodeAsset("file_type_git"),
    "readme.md": vscodeAsset("file_type_markdown"),
    ".env": vscodeAsset("file_type_dotenv"),
    ".env.local": vscodeAsset("file_type_dotenv"),
    ".editorconfig": vscodeAsset("file_type_config"),
  },
  fileExtensions: {
    ".d.ts": vscodeAsset("file_type_typescriptdef"),
    ".ts": vscodeAsset("file_type_typescript"),
    ".tsx": vscodeAsset("file_type_reactts"),
    ".js": vscodeAsset("file_type_js"),
    ".jsx": vscodeAsset("file_type_reactjs"),
    ".mjs": vscodeAsset("file_type_js"),
    ".cjs": vscodeAsset("file_type_js"),
    ".json": vscodeAsset("file_type_json"),
    ".md": vscodeAsset("file_type_markdown"),
    ".mdx": vscodeAsset("file_type_mdx"),
    ".rs": vscodeAsset("file_type_rust"),
    ".go": vscodeAsset("file_type_go"),
    ".sh": vscodeAsset("file_type_shell"),
    ".zsh": vscodeAsset("file_type_shell"),
    ".bash": vscodeAsset("file_type_shell"),
    ".toml": vscodeAsset("file_type_toml"),
    ".html": vscodeAsset("file_type_html"),
    ".htm": vscodeAsset("file_type_html"),
    ".css": vscodeAsset("file_type_css"),
    ".scss": vscodeAsset("file_type_scss"),
    ".sass": vscodeAsset("file_type_sass"),
    ".less": vscodeAsset("file_type_sass"),
    ".yaml": vscodeAsset("file_type_yaml"),
    ".yml": vscodeAsset("file_type_yaml"),
    ".xml": vscodeAsset("file_type_xml"),
    ".svg": vscodeAsset("file_type_svg"),
    ".png": vscodeAsset("file_type_image"),
    ".jpg": vscodeAsset("file_type_image"),
    ".jpeg": vscodeAsset("file_type_image"),
    ".gif": vscodeAsset("file_type_image"),
    ".webp": vscodeAsset("file_type_image"),
  },
};

const PACKS: Record<FileIconPackId, FileIconPack> = {
  classic: CLASSIC_PACK,
  catppuccin: CATPPUCCIN_PACK,
  material: MATERIAL_PACK,
  vscode: VSCODE_PACK,
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
