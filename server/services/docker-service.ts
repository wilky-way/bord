export interface ComposeFile {
  path: string;
  dir: string;
  name: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  service: string;
  state: string; // running, exited, paused, etc.
  status: string; // human-readable status like "Up 2 hours"
}

/** Recursively find docker-compose.yml / compose.yml files (max depth 3). */
export async function discoverComposeFiles(workspacePaths: string[]): Promise<ComposeFile[]> {
  const results: ComposeFile[] = [];
  for (const base of workspacePaths) {
    try {
      const proc = Bun.spawn(
        ["find", base, "-maxdepth", "3", "-name", "docker-compose.yml", "-o", "-name", "docker-compose.yaml", "-o", "-name", "compose.yml", "-o", "-name", "compose.yaml"],
        { stdout: "pipe", stderr: "pipe" }
      );
      const text = await new Response(proc.stdout).text();
      await proc.exited;
      for (const line of text.trim().split("\n").filter(Boolean)) {
        const dir = line.substring(0, line.lastIndexOf("/"));
        const name = dir.split("/").pop() || dir;
        results.push({ path: line, dir, name });
      }
    } catch {
      // find may fail for nonexistent paths
    }
  }
  return results;
}

/** List containers for a compose file. */
export async function getContainers(composePath: string): Promise<ContainerInfo[]> {
  try {
    const proc = Bun.spawn(
      ["docker", "compose", "-f", composePath, "ps", "--format", "json", "-a"],
      { stdout: "pipe", stderr: "pipe" }
    );
    const text = await new Response(proc.stdout).text();
    await proc.exited;
    if (!text.trim()) return [];
    // docker compose ps --format json outputs one JSON object per line
    return text
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const obj = JSON.parse(line);
        return {
          id: obj.ID,
          name: obj.Name,
          service: obj.Service,
          state: obj.State,
          status: obj.Status,
        };
      });
  } catch {
    return [];
  }
}

/** Start services via docker compose up -d. */
export async function composeUp(composePath: string, service?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const args = ["docker", "compose", "-f", composePath, "up", "-d"];
    if (service) args.push(service);
    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    if (code !== 0) return { ok: false, error: stderr.trim() };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/** Stop services via docker compose down or stop <service>. */
export async function composeDown(composePath: string, service?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const args = service
      ? ["docker", "compose", "-f", composePath, "stop", service]
      : ["docker", "compose", "-f", composePath, "down"];
    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    const stderr = await new Response(proc.stderr).text();
    const code = await proc.exited;
    if (code !== 0) return { ok: false, error: stderr.trim() };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/** Get recent logs for a container. */
export async function getContainerLogs(containerId: string, tail = 50): Promise<string> {
  try {
    const proc = Bun.spawn(
      ["docker", "logs", "--tail", String(tail), containerId],
      { stdout: "pipe", stderr: "pipe" }
    );
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    await proc.exited;
    // Docker sends some log output to stderr
    return (stdout + stderr).trim();
  } catch {
    return "";
  }
}
