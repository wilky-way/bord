import { createSignal } from "solid-js";

interface Props {
  onCommit: (message: string) => void;
}

export default function CommitInput(props: Props) {
  const [message, setMessage] = createSignal("");

  function handleSubmit() {
    const msg = message().trim();
    if (!msg) return;
    props.onCommit(msg);
    setMessage("");
  }

  return (
    <div class="space-y-1">
      <textarea
        class="w-full px-2 py-1.5 text-xs bg-[var(--bg-primary)] border border-[var(--border)] rounded text-[var(--text-primary)] focus:border-[var(--accent)] outline-none resize-none"
        placeholder="Commit message..."
        rows={2}
        value={message()}
        onInput={(e) => setMessage(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      />
      <button
        class="w-full px-2 py-1 text-xs bg-[var(--accent)] text-black rounded font-medium hover:bg-[var(--accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!message().trim()}
        onClick={handleSubmit}
      >
        Commit
      </button>
    </div>
  );
}
