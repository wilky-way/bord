export function isTauriRuntime(): boolean {
  const globalWindow = typeof window !== "undefined" ? (window as any) : undefined;
  return !!globalWindow && ("__TAURI_INTERNALS__" in globalWindow || "__TAURI__" in globalWindow);
}

export async function pickWorkspaceDirectory(defaultPath?: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;

  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      title: "Open project",
      directory: true,
      multiple: false,
      defaultPath,
    });

    return typeof selected === "string" ? selected : null;
  } catch {
    return null;
  }
}
