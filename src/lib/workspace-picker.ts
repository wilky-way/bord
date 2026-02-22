import { open } from "@tauri-apps/plugin-dialog";

export function isTauriRuntime(): boolean {
  const globalWindow = typeof window !== "undefined" ? (window as any) : undefined;
  return !!globalWindow && ("__TAURI_INTERNALS__" in globalWindow || "__TAURI__" in globalWindow);
}

export async function pickWorkspaceDirectory(defaultPath?: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;

  const selected = await open({
    title: "Open project",
    directory: true,
    multiple: false,
    defaultPath,
  });

  if (selected === null) return null;
  if (typeof selected === "string") return selected;
  if (Array.isArray(selected)) return selected[0] ?? null;
  return String(selected);
}
