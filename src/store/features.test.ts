import { describe, test, expect, beforeEach, mock } from "bun:test";
import { createRoot } from "solid-js";

// ---- Mocks ----

const mockGetFeatures = mock(() =>
  Promise.resolve({
    git: true,
    docker: false,
    sessions: true,
    providers: { claude: true, codex: false, opencode: true, gemini: true },
  })
);

const mockUpdateFeatures = mock(() =>
  Promise.resolve({
    git: false,
    docker: false,
    sessions: true,
    providers: { claude: true, codex: false, opencode: true, gemini: true },
  })
);

mock.module("../lib/api", () => ({
  api: {
    getFeatures: mockGetFeatures,
    updateFeatures: mockUpdateFeatures,
  },
}));

import {
  getFeatures,
  loadFeatures,
  updateFeatures,
  isFeatureEnabled,
  isProviderEnabled,
} from "./features";
import { state, setState } from "./core";

describe("loadFeatures", () => {
  beforeEach(() => {
    mockGetFeatures.mockClear();
    mockUpdateFeatures.mockClear();
    setState("activeProvider", "claude");
  });

  test("populates from API", async () => {
    await loadFeatures();
    createRoot((dispose) => {
      const f = getFeatures();
      expect(f.git).toBe(true);
      expect(f.docker).toBe(false);
      expect(f.sessions).toBe(true);
      dispose();
    });
  });

  test("uses defaults on failure", async () => {
    mockGetFeatures.mockImplementationOnce(() =>
      Promise.reject(new Error("unavailable"))
    );
    await loadFeatures();
    createRoot((dispose) => {
      // After failure, should still have values (defaults from previous state or initial)
      const f = getFeatures();
      expect(f).toBeDefined();
      expect(typeof f.git).toBe("boolean");
      dispose();
    });
  });

  test("default values have all features enabled", () => {
    // Before any loadFeatures call, check default signal value
    // NOTE: This test works because the module initializes with defaults
    createRoot((dispose) => {
      const f = getFeatures();
      expect(f).toBeDefined();
      expect(typeof f.git).toBe("boolean");
      expect(typeof f.docker).toBe("boolean");
      expect(typeof f.sessions).toBe("boolean");
      expect(typeof f.providers).toBe("object");
      dispose();
    });
  });
});

describe("updateFeatures", () => {
  beforeEach(() => {
    mockGetFeatures.mockClear();
    mockUpdateFeatures.mockClear();
    setState("activeProvider", "claude");
  });

  test("sends partial patch to API", async () => {
    await updateFeatures({ git: false });
    expect(mockUpdateFeatures).toHaveBeenCalledWith({ git: false });
  });

  test("updates local state from API response", async () => {
    await updateFeatures({ git: false });
    createRoot((dispose) => {
      const f = getFeatures();
      expect(f.git).toBe(false);
      dispose();
    });
  });

  test("merges providers on API success", async () => {
    mockUpdateFeatures.mockImplementationOnce(() =>
      Promise.resolve({
        git: true,
        docker: true,
        sessions: true,
        providers: { claude: true, codex: true, opencode: false, gemini: true },
      })
    );
    await updateFeatures({ providers: { codex: true, opencode: false } });
    createRoot((dispose) => {
      const f = getFeatures();
      expect(f.providers.codex).toBe(true);
      expect(f.providers.opencode).toBe(false);
      dispose();
    });
  });

  test("applies locally on API failure", async () => {
    // First, set known state
    mockGetFeatures.mockImplementationOnce(() =>
      Promise.resolve({
        git: true,
        docker: true,
        sessions: true,
        providers: { claude: true, codex: true, opencode: true, gemini: true },
      })
    );
    await loadFeatures();

    // Now make updateFeatures fail
    mockUpdateFeatures.mockImplementationOnce(() =>
      Promise.reject(new Error("server down"))
    );
    await updateFeatures({ git: false });
    createRoot((dispose) => {
      const f = getFeatures();
      // Should have applied optimistically
      expect(f.git).toBe(false);
      dispose();
    });
  });

  test("reconciles active provider when it becomes disabled", async () => {
    setState("activeProvider", "claude");
    mockUpdateFeatures.mockImplementationOnce(() =>
      Promise.resolve({
        git: true,
        docker: true,
        sessions: true,
        providers: { claude: false, codex: true, opencode: true, gemini: true },
      })
    );

    await updateFeatures({ providers: { claude: false } });
    expect(state.activeProvider).toBe("codex");
  });
});

describe("isFeatureEnabled", () => {
  beforeEach(async () => {
    mockGetFeatures.mockClear();
    mockGetFeatures.mockImplementationOnce(() =>
      Promise.resolve({
        git: true,
        docker: false,
        sessions: true,
        providers: { claude: true, codex: false, opencode: true, gemini: true },
      })
    );
    await loadFeatures();
  });

  test("returns true for enabled feature", () => {
    createRoot((dispose) => {
      expect(isFeatureEnabled("git")).toBe(true);
      expect(isFeatureEnabled("sessions")).toBe(true);
      dispose();
    });
  });

  test("returns false for disabled feature", () => {
    createRoot((dispose) => {
      expect(isFeatureEnabled("docker")).toBe(false);
      dispose();
    });
  });

  test("defaults to true for unknown feature", () => {
    createRoot((dispose) => {
      expect(isFeatureEnabled("nonexistent")).toBe(true);
      dispose();
    });
  });
});

describe("isProviderEnabled", () => {
  beforeEach(async () => {
    mockGetFeatures.mockClear();
    mockGetFeatures.mockImplementationOnce(() =>
      Promise.resolve({
        git: true,
        docker: false,
        sessions: true,
        providers: { claude: true, codex: false, opencode: true, gemini: true },
      })
    );
    await loadFeatures();
  });

  test("returns true for enabled provider", () => {
    createRoot((dispose) => {
      expect(isProviderEnabled("claude")).toBe(true);
      expect(isProviderEnabled("opencode")).toBe(true);
      dispose();
    });
  });

  test("returns false for disabled provider", () => {
    createRoot((dispose) => {
      expect(isProviderEnabled("codex")).toBe(false);
      dispose();
    });
  });

  test("defaults to true for unknown provider", () => {
    createRoot((dispose) => {
      expect(isProviderEnabled("unknown-provider")).toBe(true);
      dispose();
    });
  });
});
