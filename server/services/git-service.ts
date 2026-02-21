import { existsSync, statSync } from "fs";
import { resolve } from "path";

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
