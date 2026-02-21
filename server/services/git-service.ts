import { existsSync, statSync, readdirSync } from "fs";
import { resolve, dirname, basename } from "path";

const GIT_TIMEOUT = 30_000; // 30 seconds

export function validateCwd(cwd: string): { valid: boolean; error?: string } {
  const resolved = resolve(cwd);
  if (!existsSync(resolved)) {
    return { valid: false, error: `Path does not exist: ${cwd}` };
  }
  const stat = statSync(resolved);
  if (!stat.isDirectory()) {
    return { valid: false, error: `Path is not a directory: ${cwd}` };
  }
  return { valid: true };
}

async function runGit(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const proc = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
    timeout: GIT_TIMEOUT,
  });

  const [stdout, stderr] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  const exitCode = await proc.exited;
  return { stdout, stderr, exitCode };
}

export interface GitStatus {
  branch: string;
  staged: GitFileChange[];
  unstaged: GitFileChange[];
  untracked: string[];
}

export interface GitFileChange {
  path: string;
  status: string; // M, A, D, R, etc.
}

export async function getStatus(cwd: string): Promise<GitStatus> {
  const [branchResult, statusResult] = await Promise.all([
    runGit(cwd, ["branch", "--show-current"]),
    runGit(cwd, ["status", "--porcelain=v1"]),
  ]);

  const branch = branchResult.stdout.trim();
  const staged: GitFileChange[] = [];
  const unstaged: GitFileChange[] = [];
  const untracked: string[] = [];

  for (const line of statusResult.stdout.split("\n").filter(Boolean)) {
    const indexStatus = line[0];
    const workStatus = line[1];
    const filePath = line.slice(3);

    if (indexStatus === "?") {
      untracked.push(filePath);
    } else {
      if (indexStatus !== " " && indexStatus !== "?") {
        staged.push({ path: filePath, status: indexStatus });
      }
      if (workStatus !== " " && workStatus !== "?") {
        unstaged.push({ path: filePath, status: workStatus });
      }
    }
  }

  return { branch, staged, unstaged, untracked };
}

export async function getDiff(cwd: string, staged: boolean = false): Promise<string> {
  const args = staged ? ["diff", "--cached"] : ["diff"];
  const result = await runGit(cwd, args);
  return result.stdout;
}

export async function getFileDiff(cwd: string, filePath: string, staged: boolean = false): Promise<string> {
  const args = staged ? ["diff", "--cached", "--", filePath] : ["diff", "--", filePath];
  const result = await runGit(cwd, args);
  return result.stdout;
}

export async function stageFile(cwd: string, filePath: string): Promise<boolean> {
  const result = await runGit(cwd, ["add", filePath]);
  return result.exitCode === 0;
}

export async function unstageFile(cwd: string, filePath: string): Promise<boolean> {
  const result = await runGit(cwd, ["reset", "HEAD", "--", filePath]);
  return result.exitCode === 0;
}

export async function commit(cwd: string, message: string): Promise<{ ok: boolean; error?: string }> {
  const result = await runGit(cwd, ["commit", "-m", message]);
  if (result.exitCode !== 0) {
    return { ok: false, error: result.stderr };
  }
  return { ok: true };
}

export async function getLog(cwd: string, count: number = 20): Promise<string> {
  const result = await runGit(cwd, ["log", `--max-count=${count}`, "--oneline", "--decorate"]);
  return result.stdout;
}

export async function getAheadBehind(cwd: string): Promise<{ ahead: number; behind: number }> {
  const result = await runGit(cwd, ["rev-list", "--left-right", "--count", "@{u}...HEAD"]);
  if (result.exitCode !== 0) return { ahead: 0, behind: 0 };
  const [behind, ahead] = result.stdout.trim().split("\t").map(Number);
  return { ahead: ahead || 0, behind: behind || 0 };
}

export async function push(cwd: string): Promise<{ ok: boolean; error?: string }> {
  const result = await runGit(cwd, ["push"]);
  if (result.exitCode !== 0 && result.stderr.includes("no upstream")) {
    const branch = (await runGit(cwd, ["branch", "--show-current"])).stdout.trim();
    const retry = await runGit(cwd, ["push", "-u", "origin", branch]);
    return retry.exitCode === 0 ? { ok: true } : { ok: false, error: retry.stderr };
  }
  return result.exitCode === 0 ? { ok: true } : { ok: false, error: result.stderr };
}

export async function pull(cwd: string): Promise<{ ok: boolean; error?: string }> {
  const result = await runGit(cwd, ["pull"]);
  return result.exitCode === 0 ? { ok: true } : { ok: false, error: result.stderr };
}

export async function fetchRemotes(cwd: string): Promise<{ ok: boolean; error?: string }> {
  const result = await runGit(cwd, ["fetch", "--all", "--prune"]);
  return result.exitCode === 0 ? { ok: true } : { ok: false, error: result.stderr };
}

export async function listBranches(cwd: string): Promise<string[]> {
  const result = await runGit(cwd, ["branch", "--format=%(refname:short)"]);
  return result.stdout.trim().split("\n").filter(Boolean);
}

export async function checkout(cwd: string, branch: string): Promise<{ ok: boolean; error?: string }> {
  const result = await runGit(cwd, ["checkout", branch]);
  return result.exitCode === 0 ? { ok: true } : { ok: false, error: result.stderr };
}

export async function stageAll(cwd: string): Promise<boolean> {
  const result = await runGit(cwd, ["add", "-A"]);
  return result.exitCode === 0;
}

export async function unstageAll(cwd: string): Promise<boolean> {
  const result = await runGit(cwd, ["reset", "HEAD"]);
  return result.exitCode === 0;
}

// --- Repo hierarchy discovery ---

export interface RepoInfo {
  path: string;
  name: string;
  branch: string;
}

export interface RepoTree {
  current: RepoInfo;
  parent: RepoInfo | null;
  siblings: RepoInfo[];
  children: RepoInfo[];
}

export async function findGitRoot(cwd: string): Promise<string | null> {
  const result = await runGit(cwd, ["rev-parse", "--show-toplevel"]);
  if (result.exitCode !== 0) return null;
  return result.stdout.trim();
}

async function getRepoBranch(repoPath: string): Promise<string> {
  const result = await runGit(repoPath, ["branch", "--show-current"]);
  return result.stdout.trim() || "HEAD";
}

async function toRepoInfo(repoPath: string): Promise<RepoInfo> {
  return {
    path: repoPath,
    name: basename(repoPath),
    branch: await getRepoBranch(repoPath),
  };
}

export async function findParentRepo(gitRoot: string): Promise<RepoInfo | null> {
  const parentDir = dirname(gitRoot);
  const parentRoot = await findGitRoot(parentDir);
  if (!parentRoot || parentRoot === gitRoot) return null;
  return toRepoInfo(parentRoot);
}

function hasGitDir(dir: string): boolean {
  return existsSync(resolve(dir, ".git"));
}

function shouldSkipDir(name: string): boolean {
  return name.startsWith(".") || name === "node_modules" || name === "dist" || name === "build";
}

export function listSiblingRepos(gitRoot: string): string[] {
  const parentDir = dirname(gitRoot);
  try {
    return readdirSync(parentDir, { withFileTypes: true })
      .filter((e: { isDirectory(): boolean; name: string }) => e.isDirectory() && !shouldSkipDir(e.name) && resolve(parentDir, e.name) !== gitRoot)
      .map((e: { name: string }) => resolve(parentDir, e.name))
      .filter(hasGitDir);
  } catch {
    return [];
  }
}

export function listChildRepos(gitRoot: string): string[] {
  try {
    return readdirSync(gitRoot, { withFileTypes: true })
      .filter((e: { isDirectory(): boolean; name: string }) => e.isDirectory() && !shouldSkipDir(e.name))
      .map((e: { name: string }) => resolve(gitRoot, e.name))
      .filter(hasGitDir);
  } catch {
    return [];
  }
}

export async function getRepoTree(cwd: string): Promise<RepoTree | null> {
  const gitRoot = await findGitRoot(cwd);
  if (!gitRoot) return null;

  const [current, parent] = await Promise.all([
    toRepoInfo(gitRoot),
    findParentRepo(gitRoot),
  ]);

  const siblingPaths = listSiblingRepos(gitRoot);
  const childPaths = listChildRepos(gitRoot);

  const [siblings, children] = await Promise.all([
    Promise.all(siblingPaths.map(toRepoInfo)),
    Promise.all(childPaths.map(toRepoInfo)),
  ]);

  return { current, parent, siblings, children };
}

export async function getDiffStatsPerFile(cwd: string): Promise<{
  staged: Record<string, { insertions: number; deletions: number }>;
  unstaged: Record<string, { insertions: number; deletions: number }>;
}> {
  const [unstaged, staged] = await Promise.all([
    runGit(cwd, ["diff", "--numstat"]),
    runGit(cwd, ["diff", "--cached", "--numstat"]),
  ]);
  function parseNumstat(output: string) {
    const result: Record<string, { insertions: number; deletions: number }> = {};
    for (const line of output.split("\n").filter(Boolean)) {
      const [ins, del, ...pathParts] = line.split("\t");
      if (ins === "-" || del === "-") continue; // binary
      result[pathParts.join("\t")] = { insertions: parseInt(ins) || 0, deletions: parseInt(del) || 0 };
    }
    return result;
  }
  return { unstaged: parseNumstat(unstaged.stdout), staged: parseNumstat(staged.stdout) };
}

export async function getDiffStats(cwd: string): Promise<{ insertions: number; deletions: number }> {
  const [unstaged, staged] = await Promise.all([
    runGit(cwd, ["diff", "--numstat"]),
    runGit(cwd, ["diff", "--cached", "--numstat"]),
  ]);

  let insertions = 0;
  let deletions = 0;

  for (const output of [unstaged.stdout, staged.stdout]) {
    for (const line of output.split("\n").filter(Boolean)) {
      const [ins, del] = line.split("\t");
      if (ins !== "-") insertions += parseInt(ins) || 0;
      if (del !== "-") deletions += parseInt(del) || 0;
    }
  }

  return { insertions, deletions };
}
