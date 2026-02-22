import { Dynamic } from "solid-js/web";
import { api } from "../../lib/api";
import { getPreferredEditor } from "../../lib/editor-preference";
import { VSCodeIcon, CursorIcon, ZedIcon } from "../icons/ProviderIcons";

const EDITORS = {
  vscode: { Icon: VSCodeIcon },
  cursor: { Icon: CursorIcon },
  zed: { Icon: ZedIcon },
};

interface Props {
  cwd: string;
  file: string;
}

export default function OpenFileButton(props: Props) {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    void api.openInEditor(props.cwd, getPreferredEditor(), props.file).catch((err) => {
      console.error("[bord] open file in editor failed:", err);
    });
  };

  return (
    <button
      class="opacity-0 group-hover:opacity-100 text-[var(--text-secondary)] hover:text-[var(--accent)] hover:bg-[var(--bg-tertiary)] transition-opacity shrink-0 w-5 h-5 flex items-center justify-center rounded"
      onClick={handleClick}
      title={`Open ${props.file} in editor`}
    >
      <Dynamic component={EDITORS[getPreferredEditor()].Icon} size={13} />
    </button>
  );
}
