interface FileIconInfo {
  icon: string;
  color: string;
}

const DIR_ICON: FileIconInfo = { icon: "\u{1F4C1}", color: "var(--accent)" };
const DEFAULT_ICON: FileIconInfo = { icon: "\u00B7", color: "var(--text-secondary)" };

const EXT_MAP: Record<string, FileIconInfo> = {
  ".ts":   { icon: "TS", color: "#3178c6" },
  ".tsx":  { icon: "TX", color: "#3178c6" },
  ".js":   { icon: "JS", color: "#f7df1e" },
  ".jsx":  { icon: "JX", color: "#f7df1e" },
  ".json": { icon: "{}", color: "#cbcb41" },
  ".md":   { icon: "M\u2193", color: "#519aba" },
  ".css":  { icon: "#",  color: "#563d7c" },
  ".html": { icon: "<>", color: "#e34c26" },
  ".py":   { icon: "Py", color: "#3572a5" },
  ".rs":   { icon: "Rs", color: "#dea584" },
  ".go":   { icon: "Go", color: "#00add8" },
  ".sh":   { icon: "$",  color: "#89e051" },
  ".yaml": { icon: "Y",  color: "#cb171e" },
  ".yml":  { icon: "Y",  color: "#cb171e" },
  ".toml": { icon: "T",  color: "#9c4221" },
  ".sql":  { icon: "SQ", color: "#e38c00" },
  ".svg":  { icon: "\u25C7",  color: "#ffb13b" },
  ".png":  { icon: "\u25A3",  color: "#a074c4" },
  ".jpg":  { icon: "\u25A3",  color: "#a074c4" },
  ".lock": { icon: "\u{1F512}", color: "var(--text-secondary)" },
  ".env":  { icon: "\u2699",  color: "var(--warning)" },
};

export function getFileIcon(name: string, type: "file" | "dir" | "symlink"): FileIconInfo {
  if (type === "dir") return DIR_ICON;
  const ext = name.includes(".") ? "." + name.split(".").pop()!.toLowerCase() : "";
  return EXT_MAP[ext] ?? DEFAULT_ICON;
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
  const ext = name.includes(".") ? "." + name.split(".").pop()!.toLowerCase() : "";
  return EXT_LANG[ext] ?? "plaintext";
}
