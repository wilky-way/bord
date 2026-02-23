import { resolve } from "path";

export const MAX_COMMIT_MESSAGE_LENGTH = 10240; // 10KB
export const MAX_CLIPBOARD_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Validate a git branch name.
 * Rejects dangerous characters, path traversal, and flag injection.
 */
export function validateBranchName(name: string): string {
  if (!name || !name.trim()) {
    throw new Error("Branch name must not be empty");
  }
  if (name.startsWith("-")) {
    throw new Error("Branch name must not start with '-'");
  }
  if (/[\s~^:?*\[\]\\]/.test(name)) {
    throw new Error("Branch name contains invalid characters");
  }
  if (name.includes("..")) {
    throw new Error("Branch name must not contain '..'");
  }
  // Reject control characters (0x00–0x1F, 0x7F)
  if (/[\x00-\x1f\x7f]/.test(name)) {
    throw new Error("Branch name must not contain control characters");
  }
  return name;
}

/**
 * Validate a docker compose file path.
 * Must be relative, no traversal, and end with a compose filename.
 */
export function validateComposePath(path: string): string {
  if (!path || !path.trim()) {
    throw new Error("Compose path must not be empty");
  }
  if (path.includes("../") || path.includes("..\\")) {
    throw new Error("Compose path must not contain path traversal");
  }
  if (path.startsWith("/")) {
    throw new Error("Compose path must not be absolute");
  }
  const validNames = [
    "docker-compose.yml",
    "docker-compose.yaml",
    "compose.yml",
    "compose.yaml",
  ];
  const basename = path.split("/").pop() ?? "";
  if (!validNames.includes(basename)) {
    throw new Error(
      "Compose path must end with docker-compose.yml, docker-compose.yaml, compose.yml, or compose.yaml",
    );
  }
  return path;
}

/**
 * Validate a Docker container ID or name.
 * Must match Docker's container ID/name format and not exceed 128 chars.
 */
export function validateContainerId(id: string): string {
  if (!id || !id.trim()) {
    throw new Error("Container ID must not be empty");
  }
  if (id.length > 128) {
    throw new Error("Container ID must not exceed 128 characters");
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(id)) {
    throw new Error("Container ID contains invalid characters");
  }
  return id;
}

/**
 * Validate that a file path is contained within the given cwd.
 * Prevents path traversal by resolving the path and checking the prefix.
 */
export function validateFilePath(cwd: string, file: string): string {
  if (!file || !file.trim()) {
    throw new Error("File path must not be empty");
  }
  const resolvedCwd = resolve(cwd);
  const resolvedFile = resolve(cwd, file);
  // Ensure resolved path starts with cwd (+ separator or exact match)
  if (
    resolvedFile !== resolvedCwd &&
    !resolvedFile.startsWith(resolvedCwd + "/")
  ) {
    throw new Error("File path escapes the working directory");
  }
  return resolvedFile;
}

/**
 * Clamp a value to an integer within [min, max], returning fallback if invalid.
 */
export function clampInteger(
  val: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof val !== "number" || !Number.isFinite(val)) {
    return fallback;
  }
  return Math.round(Math.min(max, Math.max(min, val)));
}
