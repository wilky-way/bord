function isAbsolutePath(path: string): boolean {
  return path.startsWith("/");
}

export function normalizePath(path: string): string {
  if (!path) return path;

  const collapsed = path.replace(/\/+/g, "/");
  if (collapsed === "/") return "/";
  return collapsed.replace(/\/+$/, "") || "/";
}

export function isPathWithinRoot(rootPath: string, candidatePath: string): boolean {
  if (!rootPath || !candidatePath) return false;
  if (!isAbsolutePath(rootPath) || !isAbsolutePath(candidatePath)) return false;

  const root = normalizePath(rootPath);
  const candidate = normalizePath(candidatePath);

  if (root === "/") return true;
  if (candidate === root) return true;
  return candidate.startsWith(`${root}/`);
}

export function shellSingleQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

export function buildCdCommand(path: string): string {
  return `cd -- ${shellSingleQuote(path)}\n`;
}
