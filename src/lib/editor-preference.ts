import { createSignal } from "solid-js";

type Editor = "vscode" | "cursor";

const STORAGE_KEY = "bord-preferred-editor";

const [preferred, setPreferredSignal] = createSignal<Editor>(
  (localStorage.getItem(STORAGE_KEY) as Editor) || "cursor"
);

export function getPreferredEditor(): Editor {
  return preferred();
}

export function setPreferredEditor(editor: Editor) {
  localStorage.setItem(STORAGE_KEY, editor);
  setPreferredSignal(editor);
}

export type { Editor };
