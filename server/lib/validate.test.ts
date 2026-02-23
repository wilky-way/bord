import { describe, test, expect } from "bun:test";
import {
  validateBranchName,
  validateComposePath,
  validateContainerId,
  validateFilePath,
  clampInteger,
  MAX_COMMIT_MESSAGE_LENGTH,
  MAX_CLIPBOARD_IMAGE_SIZE,
} from "./validate";

describe("validateBranchName", () => {
  test("accepts valid branch names", () => {
    expect(validateBranchName("main")).toBe("main");
    expect(validateBranchName("feature/foo")).toBe("feature/foo");
    expect(validateBranchName("release-1.0")).toBe("release-1.0");
    expect(validateBranchName("fix_bug")).toBe("fix_bug");
    expect(validateBranchName("v2.0.0")).toBe("v2.0.0");
  });

  test("rejects empty string", () => {
    expect(() => validateBranchName("")).toThrow("must not be empty");
  });

  test("rejects whitespace-only", () => {
    expect(() => validateBranchName("   ")).toThrow("must not be empty");
  });

  test("rejects names starting with dash (flag injection)", () => {
    expect(() => validateBranchName("-force")).toThrow("must not start with '-'");
    expect(() => validateBranchName("--delete")).toThrow("must not start with '-'");
  });

  test("rejects spaces", () => {
    expect(() => validateBranchName("my branch")).toThrow("invalid characters");
  });

  test("rejects '..'", () => {
    expect(() => validateBranchName("foo..bar")).toThrow("must not contain '..'");
  });

  test("rejects tilde", () => {
    expect(() => validateBranchName("foo~1")).toThrow("invalid characters");
  });

  test("rejects caret", () => {
    expect(() => validateBranchName("HEAD^")).toThrow("invalid characters");
  });

  test("rejects colon", () => {
    expect(() => validateBranchName("foo:bar")).toThrow("invalid characters");
  });

  test("rejects question mark", () => {
    expect(() => validateBranchName("foo?")).toThrow("invalid characters");
  });

  test("rejects asterisk", () => {
    expect(() => validateBranchName("foo*")).toThrow("invalid characters");
  });

  test("rejects brackets", () => {
    expect(() => validateBranchName("foo[0]")).toThrow("invalid characters");
  });

  test("rejects backslash", () => {
    expect(() => validateBranchName("foo\\bar")).toThrow("invalid characters");
  });

  test("rejects control characters", () => {
    expect(() => validateBranchName("foo\x00bar")).toThrow("control characters");
    expect(() => validateBranchName("foo\x1fbar")).toThrow("control characters");
    expect(() => validateBranchName("foo\x7fbar")).toThrow("control characters");
  });

  test("rejects tab", () => {
    expect(() => validateBranchName("foo\tbar")).toThrow("invalid characters");
  });
});

describe("validateComposePath", () => {
  test("accepts valid compose paths", () => {
    expect(validateComposePath("docker-compose.yml")).toBe("docker-compose.yml");
    expect(validateComposePath("docker-compose.yaml")).toBe("docker-compose.yaml");
    expect(validateComposePath("compose.yml")).toBe("compose.yml");
    expect(validateComposePath("compose.yaml")).toBe("compose.yaml");
    expect(validateComposePath("services/docker-compose.yml")).toBe("services/docker-compose.yml");
  });

  test("rejects empty string", () => {
    expect(() => validateComposePath("")).toThrow("must not be empty");
  });

  test("rejects path traversal (../)", () => {
    expect(() => validateComposePath("../docker-compose.yml")).toThrow("path traversal");
    expect(() => validateComposePath("foo/../docker-compose.yml")).toThrow("path traversal");
  });

  test("rejects path traversal (..\\)", () => {
    expect(() => validateComposePath("..\\docker-compose.yml")).toThrow("path traversal");
  });

  test("rejects absolute paths", () => {
    expect(() => validateComposePath("/etc/docker-compose.yml")).toThrow("must not be absolute");
  });

  test("rejects invalid filenames", () => {
    expect(() => validateComposePath("Dockerfile")).toThrow("must end with");
    expect(() => validateComposePath("compose.json")).toThrow("must end with");
    expect(() => validateComposePath("docker-compose.toml")).toThrow("must end with");
  });
});

describe("validateContainerId", () => {
  test("accepts valid container IDs", () => {
    expect(validateContainerId("abc123")).toBe("abc123");
    expect(validateContainerId("my-container")).toBe("my-container");
    expect(validateContainerId("my_container.1")).toBe("my_container.1");
    expect(validateContainerId("a")).toBe("a");
  });

  test("rejects empty string", () => {
    expect(() => validateContainerId("")).toThrow("must not be empty");
  });

  test("rejects IDs exceeding 128 characters", () => {
    expect(() => validateContainerId("a".repeat(129))).toThrow("must not exceed 128");
    // 128 is valid
    expect(validateContainerId("a".repeat(128))).toBe("a".repeat(128));
  });

  test("rejects IDs starting with special chars", () => {
    expect(() => validateContainerId("-container")).toThrow("invalid characters");
    expect(() => validateContainerId(".container")).toThrow("invalid characters");
    expect(() => validateContainerId("_container")).toThrow("invalid characters");
  });

  test("rejects IDs with invalid characters", () => {
    expect(() => validateContainerId("foo bar")).toThrow("invalid characters");
    expect(() => validateContainerId("foo;rm -rf /")).toThrow("invalid characters");
    expect(() => validateContainerId("foo$(cmd)")).toThrow("invalid characters");
    expect(() => validateContainerId("foo`cmd`")).toThrow("invalid characters");
  });
});

describe("validateFilePath", () => {
  test("accepts file within cwd", () => {
    const result = validateFilePath("/home/user/project", "src/app.ts");
    expect(result).toBe("/home/user/project/src/app.ts");
  });

  test("accepts nested files", () => {
    const result = validateFilePath("/home/user/project", "a/b/c/d.ts");
    expect(result).toBe("/home/user/project/a/b/c/d.ts");
  });

  test("rejects empty file", () => {
    expect(() => validateFilePath("/home/user", "")).toThrow("must not be empty");
  });

  test("rejects path traversal with ../", () => {
    expect(() => validateFilePath("/home/user/project", "../../etc/passwd")).toThrow("escapes the working directory");
  });

  test("rejects absolute paths that escape cwd", () => {
    expect(() => validateFilePath("/home/user/project", "/etc/passwd")).toThrow("escapes the working directory");
  });

  test("allows file that resolves to cwd itself", () => {
    // e.g. "." resolves to cwd
    const result = validateFilePath("/home/user/project", ".");
    expect(result).toBe("/home/user/project");
  });

  test("rejects sneaky traversal with intermediate ..", () => {
    expect(() => validateFilePath("/home/user/project", "src/../../outside")).toThrow("escapes the working directory");
  });
});

describe("clampInteger", () => {
  test("returns value when within range", () => {
    expect(clampInteger(5, 0, 10, 0)).toBe(5);
    expect(clampInteger(0, 0, 10, 5)).toBe(0);
    expect(clampInteger(10, 0, 10, 5)).toBe(10);
  });

  test("clamps to min", () => {
    expect(clampInteger(-5, 0, 10, 5)).toBe(0);
  });

  test("clamps to max", () => {
    expect(clampInteger(15, 0, 10, 5)).toBe(10);
  });

  test("rounds to integer", () => {
    expect(clampInteger(5.7, 0, 10, 0)).toBe(6);
    expect(clampInteger(5.3, 0, 10, 0)).toBe(5);
  });

  test("returns fallback for NaN", () => {
    expect(clampInteger(NaN, 0, 10, 5)).toBe(5);
  });

  test("returns fallback for Infinity", () => {
    expect(clampInteger(Infinity, 0, 10, 5)).toBe(5);
  });

  test("returns fallback for -Infinity", () => {
    expect(clampInteger(-Infinity, 0, 10, 5)).toBe(5);
  });

  test("returns fallback for string", () => {
    expect(clampInteger("5" as any, 0, 10, 5)).toBe(5);
  });

  test("returns fallback for null", () => {
    expect(clampInteger(null, 0, 10, 5)).toBe(5);
  });

  test("returns fallback for undefined", () => {
    expect(clampInteger(undefined, 0, 10, 5)).toBe(5);
  });

  test("returns fallback for boolean", () => {
    expect(clampInteger(true as any, 0, 10, 5)).toBe(5);
  });

  test("returns fallback for object", () => {
    expect(clampInteger({} as any, 0, 10, 5)).toBe(5);
  });
});

describe("constants", () => {
  test("MAX_COMMIT_MESSAGE_LENGTH is 10KB", () => {
    expect(MAX_COMMIT_MESSAGE_LENGTH).toBe(10240);
  });

  test("MAX_CLIPBOARD_IMAGE_SIZE is 10MB", () => {
    expect(MAX_CLIPBOARD_IMAGE_SIZE).toBe(10 * 1024 * 1024);
  });
});
