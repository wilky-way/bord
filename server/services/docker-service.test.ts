import { describe, test, expect, mock, spyOn, beforeEach, afterEach } from "bun:test";
import type { Subprocess } from "bun";
import {
  discoverComposeFiles,
  getContainers,
  composeUp,
  composeDown,
  composeRestart,
  composePull,
  getContainerLogs,
} from "./docker-service";

// Helper to create a fake Bun.spawn result
function fakeProc(stdout: string, stderr: string, exitCode: number): Subprocess {
  return {
    stdout: new Response(stdout).body!,
    stderr: new Response(stderr).body!,
    exited: Promise.resolve(exitCode),
    pid: 1234,
    killed: false,
    exitCode: null,
    signalCode: null,
    kill: () => {},
    ref: () => {},
    unref: () => {},
    stdin: undefined as any,
    resourceUsage: () => undefined as any,
    readable: undefined as any,
    [Symbol.asyncDispose]: async () => {},
  } as unknown as Subprocess;
}

let spawnSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  spawnSpy = spyOn(Bun, "spawn");
});

afterEach(() => {
  spawnSpy.mockRestore();
});

describe("discoverComposeFiles", () => {
  test("finds docker-compose.yml files in paths", async () => {
    spawnSpy.mockReturnValue(
      fakeProc("/project/docker-compose.yml\n/project/sub/compose.yml\n", "", 0),
    );
    const result = await discoverComposeFiles(["/project"]);
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe("/project/docker-compose.yml");
    expect(result[0].dir).toBe("/project");
    expect(result[0].name).toBe("project");
    expect(result[1].path).toBe("/project/sub/compose.yml");
    expect(result[1].dir).toBe("/project/sub");
    expect(result[1].name).toBe("sub");
  });

  test("handles multiple paths", async () => {
    spawnSpy
      .mockReturnValueOnce(fakeProc("/a/docker-compose.yml\n", "", 0))
      .mockReturnValueOnce(fakeProc("/b/compose.yml\n", "", 0));
    const result = await discoverComposeFiles(["/a", "/b"]);
    expect(result).toHaveLength(2);
    expect(result[0].path).toBe("/a/docker-compose.yml");
    expect(result[1].path).toBe("/b/compose.yml");
  });

  test("returns empty array when none found", async () => {
    spawnSpy.mockReturnValue(fakeProc("", "", 0));
    const result = await discoverComposeFiles(["/empty"]);
    expect(result).toEqual([]);
  });

  test("handles spawn failure gracefully", async () => {
    spawnSpy.mockImplementation(() => {
      throw new Error("spawn failed");
    });
    const result = await discoverComposeFiles(["/bad"]);
    expect(result).toEqual([]);
  });
});

describe("getContainers", () => {
  test("parses JSON docker compose ps output", async () => {
    const line1 = JSON.stringify({
      ID: "abc123",
      Name: "web-1",
      Service: "web",
      State: "running",
      Status: "Up 2 hours",
    });
    const line2 = JSON.stringify({
      ID: "def456",
      Name: "db-1",
      Service: "db",
      State: "exited",
      Status: "Exited (0) 1 hour ago",
    });
    spawnSpy.mockReturnValue(fakeProc(`${line1}\n${line2}\n`, "", 0));
    const result = await getContainers("/project/docker-compose.yml");
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: "abc123",
      name: "web-1",
      service: "web",
      state: "running",
      status: "Up 2 hours",
    });
    expect(result[1]).toEqual({
      id: "def456",
      name: "db-1",
      service: "db",
      state: "exited",
      status: "Exited (0) 1 hour ago",
    });
  });

  test("returns empty array for no containers", async () => {
    spawnSpy.mockReturnValue(fakeProc("", "", 0));
    const result = await getContainers("/project/docker-compose.yml");
    expect(result).toEqual([]);
  });

  test("handles spawn failure", async () => {
    spawnSpy.mockImplementation(() => {
      throw new Error("docker not found");
    });
    const result = await getContainers("/project/docker-compose.yml");
    expect(result).toEqual([]);
  });
});

describe("composeUp", () => {
  test("calls docker compose up with correct args", async () => {
    spawnSpy.mockReturnValue(fakeProc("", "", 0));
    const result = await composeUp("/project/docker-compose.yml");
    expect(result).toEqual({ ok: true });
    expect(spawnSpy).toHaveBeenCalledWith(
      ["docker", "compose", "-f", "/project/docker-compose.yml", "up", "-d"],
      expect.any(Object),
    );
  });

  test("handles failure with stderr", async () => {
    spawnSpy.mockReturnValue(fakeProc("", "network error", 1));
    const result = await composeUp("/project/docker-compose.yml");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("network error");
  });

  test("passes service argument", async () => {
    spawnSpy.mockReturnValue(fakeProc("", "", 0));
    await composeUp("/project/docker-compose.yml", "web");
    expect(spawnSpy).toHaveBeenCalledWith(
      ["docker", "compose", "-f", "/project/docker-compose.yml", "up", "-d", "web"],
      expect.any(Object),
    );
  });
});

describe("composeDown", () => {
  test("calls docker compose down", async () => {
    spawnSpy.mockReturnValue(fakeProc("", "", 0));
    const result = await composeDown("/project/docker-compose.yml");
    expect(result).toEqual({ ok: true });
    expect(spawnSpy).toHaveBeenCalledWith(
      ["docker", "compose", "-f", "/project/docker-compose.yml", "down"],
      expect.any(Object),
    );
  });

  test("handles failure", async () => {
    spawnSpy.mockReturnValue(fakeProc("", "permission denied", 1));
    const result = await composeDown("/project/docker-compose.yml");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("permission denied");
  });
});

describe("composeRestart", () => {
  test("calls docker compose restart", async () => {
    spawnSpy.mockReturnValue(fakeProc("", "", 0));
    const result = await composeRestart("/project/docker-compose.yml");
    expect(result).toEqual({ ok: true });
    expect(spawnSpy).toHaveBeenCalledWith(
      ["docker", "compose", "-f", "/project/docker-compose.yml", "restart"],
      expect.any(Object),
    );
  });
});

describe("composePull", () => {
  test("calls docker compose pull", async () => {
    spawnSpy.mockReturnValue(fakeProc("", "", 0));
    const result = await composePull("/project/docker-compose.yml");
    expect(result).toEqual({ ok: true });
    expect(spawnSpy).toHaveBeenCalledWith(
      ["docker", "compose", "-f", "/project/docker-compose.yml", "pull"],
      expect.any(Object),
    );
  });

  test("handles failure", async () => {
    spawnSpy.mockReturnValue(fakeProc("", "pull failed", 1));
    const result = await composePull("/project/docker-compose.yml");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("pull failed");
  });
});

describe("getContainerLogs", () => {
  test("returns combined stdout+stderr", async () => {
    spawnSpy.mockReturnValue(fakeProc("stdout logs\n", "stderr logs\n", 0));
    const result = await getContainerLogs("abc123");
    expect(result).toBe("stdout logs\nstderr logs");
  });

  test("uses custom tail count", async () => {
    spawnSpy.mockReturnValue(fakeProc("logs", "", 0));
    await getContainerLogs("abc123", 100);
    expect(spawnSpy).toHaveBeenCalledWith(
      ["docker", "logs", "--tail", "100", "abc123"],
      expect.any(Object),
    );
  });

  test("handles failure", async () => {
    spawnSpy.mockImplementation(() => {
      throw new Error("container not found");
    });
    const result = await getContainerLogs("bad-id");
    expect(result).toBe("");
  });
});
