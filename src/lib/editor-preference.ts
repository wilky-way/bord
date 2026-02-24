import { createSignal } from "solid-js";

type Editor = "vscode" | "cursor" | "zed";
type FileOpenTarget = "terminal" | "editor";

const STORAGE_KEY = "bord-preferred-editor";
const FILE_OPEN_TARGET_KEY = "bord-file-open-target";

function loadEditorPreference(): Editor {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "vscode" || stored === "cursor" || stored === "zed") return stored;
  return "cursor";
}

function loadFileOpenTarget(): FileOpenTarget {
  const stored = localStorage.getItem(FILE_OPEN_TARGET_KEY);
  if (stored === "editor" || stored === "terminal") return stored;
  return "terminal";
}

const [preferred, setPreferredSignal] = createSignal<Editor>(
  loadEditorPreference()
);
const [fileOpenTarget, setFileOpenTargetSignal] = createSignal<FileOpenTarget>(loadFileOpenTarget());

export function getPreferredEditor(): Editor {
  return preferred();
}

export function setPreferredEditor(editor: Editor) {
  localStorage.setItem(STORAGE_KEY, editor);
  setPreferredSignal(editor);
}

export function getFileOpenTarget(): FileOpenTarget {
  return fileOpenTarget();
}

export function setFileOpenTarget(target: FileOpenTarget) {
  localStorage.setItem(FILE_OPEN_TARGET_KEY, target);
  setFileOpenTargetSignal(target);
}

export type { Editor, FileOpenTarget };
