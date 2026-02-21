import { Dynamic } from "solid-js/web";
import { api } from "../../lib/api";
import { getPreferredEditor } from "../../lib/editor-preference";
import { VSCodeIcon, CursorIcon } from "../icons/ProviderIcons";

const EDITORS = {
  vscode: { Icon: VSCodeIcon },
  cursor: { Icon: CursorIcon },
};

interface Props {
  cwd: string;
  file: string;
}

export default function OpenFileButton(props: Props) {
  const handleClick = (e: MouseEvent) => {
    e.stopPropagation();
    api.openInEditor(props.cwd, getPreferredEditor(), props.file);
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
