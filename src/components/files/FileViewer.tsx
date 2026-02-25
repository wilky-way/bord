import { createSignal, createEffect, onMount, onCleanup, Show, For } from "solid-js";
import { state } from "../../store/core";
import { closeFileInTerminal, setActiveFileInTerminal, setTerminalView, setFileScrollTop } from "../../store/terminals";
import { api } from "../../lib/api";
import { getFileIcon } from "../../lib/file-icons";
import { fileIconPack } from "../../store/settings";

interface Props {
  terminalId: string;
}

// Highlight.js theme using CSS variables
const HLJS_THEME = `
.hljs { color: var(--text-primary); background: transparent; }
.hljs-keyword, .hljs-selector-tag, .hljs-built_in, .hljs-type { color: var(--accent); }
.hljs-string, .hljs-attr, .hljs-symbol, .hljs-bullet, .hljs-addition, .hljs-template-variable, .hljs-template-tag { color: var(--success); }
.hljs-comment, .hljs-quote, .hljs-deletion, .hljs-meta { color: var(--text-secondary); opacity: 0.6; }
.hljs-number, .hljs-literal, .hljs-regexp { color: var(--warning); }
.hljs-title, .hljs-section, .hljs-name, .hljs-selector-id, .hljs-selector-class { color: var(--accent-hover); }
.hljs-attribute, .hljs-variable, .hljs-property { color: var(--text-primary); }
.hljs-emphasis { font-style: italic; }
.hljs-strong { font-weight: bold; }
.hljs-link { color: var(--accent); text-decoration: underline; }
.hljs-params { color: var(--text-secondary); }
.hljs-tag { color: var(--accent); }
`;

export default function FileViewer(props: Props) {
  const terminal = () => state.terminals.find((t) => t.id === props.terminalId);
  const openFiles = () => terminal()?.openFiles ?? [];
  const activeFileIndex = () => terminal()?.activeFileIndex ?? 0;
  const activeFile = () => openFiles()[activeFileIndex()];

  const [content, setContent] = createSignal("");
  const [originalContent, setOriginalContent] = createSignal("");
  const [language, setLanguage] = createSignal("plaintext");
  const [binary, setBinary] = createSignal(false);
  const [truncated, setTruncated] = createSignal(false);
  const [fileSize, setFileSize] = createSignal(0);
  const [loading, setLoading] = createSignal(false);
  const [highlighted, setHighlighted] = createSignal("");
  const [mdPreview, setMdPreview] = createSignal(false);
  const [mdHtml, setMdHtml] = createSignal("");
  const [saving, setSaving] = createSignal(false);

  let textareaRef: HTMLTextAreaElement | undefined;
  let preRef: HTMLPreElement | undefined;
  let gutterRef: HTMLDivElement | undefined;
  let styleEl: HTMLStyleElement | undefined;
  let highlightTimer: ReturnType<typeof setTimeout>;

  const isDirty = () => content() !== originalContent();
  const isMarkdown = () => language() === "markdown";
  const isReadOnly = () => truncated() || binary();

  onMount(() => {
    // Inject hljs theme
    styleEl = document.createElement("style");
    styleEl.textContent = HLJS_THEME;
    document.head.appendChild(styleEl);
  });
  onCleanup(() => {
    styleEl?.remove();
    clearTimeout(highlightTimer);
  });

  // Load file when active file changes
  createEffect(() => {
    const file = activeFile();
    if (!file) return;
    loadFile(file.path);
  });

  async function loadFile(path: string) {
    setLoading(true);
    setMdPreview(false);
    try {
      const result = await api.readFile(path);
      setBinary(result.binary);
      setTruncated(result.truncated);
      setFileSize(result.size);
      setLanguage(result.language);
      if (!result.binary) {
        setContent(result.content);
        setOriginalContent(result.content);
        await doHighlight(result.content, result.language);
      }
    } catch (e) {
      console.error("Failed to read file:", path, e);
    } finally {
      setLoading(false);
    }
  }

  // Map of language loaders — Vite can statically analyze these
  const LANG_LOADERS: Record<string, () => Promise<any>> = {
    typescript: () => import("highlight.js/lib/languages/typescript"),
    javascript: () => import("highlight.js/lib/languages/javascript"),
    json: () => import("highlight.js/lib/languages/json"),
    markdown: () => import("highlight.js/lib/languages/markdown"),
    css: () => import("highlight.js/lib/languages/css"),
    html: () => import("highlight.js/lib/languages/xml"),
    xml: () => import("highlight.js/lib/languages/xml"),
    yaml: () => import("highlight.js/lib/languages/yaml"),
    toml: () => import("highlight.js/lib/languages/ini"),
    bash: () => import("highlight.js/lib/languages/bash"),
    python: () => import("highlight.js/lib/languages/python"),
    rust: () => import("highlight.js/lib/languages/rust"),
    go: () => import("highlight.js/lib/languages/go"),
    sql: () => import("highlight.js/lib/languages/sql"),
    scss: () => import("highlight.js/lib/languages/scss"),
    less: () => import("highlight.js/lib/languages/less"),
    java: () => import("highlight.js/lib/languages/java"),
    kotlin: () => import("highlight.js/lib/languages/kotlin"),
    swift: () => import("highlight.js/lib/languages/swift"),
    ruby: () => import("highlight.js/lib/languages/ruby"),
    php: () => import("highlight.js/lib/languages/php"),
    c: () => import("highlight.js/lib/languages/c"),
    cpp: () => import("highlight.js/lib/languages/cpp"),
    graphql: () => import("highlight.js/lib/languages/graphql"),
    dockerfile: () => import("highlight.js/lib/languages/dockerfile"),
    lua: () => import("highlight.js/lib/languages/lua"),
  };

  const registeredLangs = new Set<string>();

  async function doHighlight(text: string, lang: string) {
    try {
      const hljs = (await import("highlight.js/lib/core")).default;
      if (!registeredLangs.has(lang) && LANG_LOADERS[lang]) {
        try {
          const langMod = await LANG_LOADERS[lang]();
          hljs.registerLanguage(lang, langMod.default);
          registeredLangs.add(lang);
        } catch {
          // Language not available
        }
      }
      if (registeredLangs.has(lang)) {
        const result = hljs.highlight(text, { language: lang, ignoreIllegals: true });
        setHighlighted(result.value);
      } else {
        setHighlighted(escapeHtml(text));
      }
    } catch {
      setHighlighted(escapeHtml(text));
    }
  }

  function escapeHtml(str: string): string {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function handleInput(value: string) {
    setContent(value);
    clearTimeout(highlightTimer);
    highlightTimer = setTimeout(() => doHighlight(value, language()), 150);
  }

  function handleScroll() {
    if (textareaRef && preRef) {
      preRef.scrollTop = textareaRef.scrollTop;
      preRef.scrollLeft = textareaRef.scrollLeft;
    }
    if (textareaRef && gutterRef) {
      gutterRef.scrollTop = textareaRef.scrollTop;
    }
    // Store scroll position
    const file = activeFile();
    if (file && textareaRef) {
      setFileScrollTop(props.terminalId, activeFileIndex(), textareaRef.scrollTop);
    }
  }

  async function handleSave() {
    const file = activeFile();
    if (!file || isReadOnly() || !isDirty()) return;
    setSaving(true);
    try {
      const result = await api.writeFile(file.path, content());
      if (result.ok) {
        setOriginalContent(content());
      }
    } catch (e) {
      console.error("Failed to save:", e);
    } finally {
      setSaving(false);
    }
  }

  async function renderMarkdown(text: string) {
    try {
      const { marked } = await import("marked");

      // Custom renderer: mermaid code blocks → placeholder divs
      const renderer = new marked.Renderer();
      const originalCode = renderer.code.bind(renderer);
      let mermaidCount = 0;
      const mermaidSources: string[] = [];

      renderer.code = function (token: { text: string; lang?: string; escaped?: boolean }) {
        if (token.lang === "mermaid") {
          const id = `mermaid-${mermaidCount++}`;
          mermaidSources.push(token.text);
          return `<div class="mermaid-placeholder" data-mermaid-id="${id}" data-mermaid-idx="${mermaidSources.length - 1}"></div>`;
        }
        return originalCode(token);
      };

      const html = await marked(text, { renderer });
      setMdHtml(html);

      // Post-render: initialize mermaid on placeholder divs
      if (mermaidSources.length > 0) {
        requestAnimationFrame(async () => {
          try {
            const mermaid = (await import("mermaid")).default;

            // Resolve CSS variables to actual hex values — mermaid doesn't support var() refs
            const cs = getComputedStyle(document.documentElement);
            const v = (name: string) => cs.getPropertyValue(name).trim() || undefined;

            mermaid.initialize({
              startOnLoad: false,
              theme: "dark",
              themeVariables: {
                primaryColor: v("--accent"),
                primaryTextColor: v("--text-primary"),
                primaryBorderColor: v("--border"),
                lineColor: v("--text-secondary"),
                secondaryColor: v("--bg-secondary"),
                tertiaryColor: v("--bg-tertiary"),
              },
            });

            const placeholders = document.querySelectorAll(".mermaid-placeholder");
            for (const el of placeholders) {
              const idx = parseInt(el.getAttribute("data-mermaid-idx") ?? "0");
              const id = el.getAttribute("data-mermaid-id") ?? "mermaid-0";
              const source = mermaidSources[idx];
              if (source) {
                const { svg } = await mermaid.render(id, source);
                el.innerHTML = svg;
                el.classList.add("mermaid-rendered");
              }
            }
          } catch (e) {
            console.error("Mermaid render failed:", e);
          }
        });
      }
    } catch {
      setMdHtml(`<pre>${escapeHtml(text)}</pre>`);
    }
  }

  // Keyboard shortcuts
  onMount(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+S: save
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
        return;
      }
      // Escape: back to tree
      if (e.key === "Escape") {
        if (!isDirty()) {
          setTerminalView(props.terminalId, "filetree");
        }
        return;
      }
      // Cmd+1-5: switch tabs
      const tabKey = parseInt(e.key);
      if ((e.metaKey || e.ctrlKey) && tabKey >= 1 && tabKey <= 5) {
        e.preventDefault();
        const idx = tabKey - 1;
        if (openFiles().length > idx) setActiveFileInTerminal(props.terminalId, idx);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    onCleanup(() => window.removeEventListener("keydown", handler));
  });

  // Restore scroll position on tab switch
  createEffect(() => {
    const file = activeFile();
    if (file && textareaRef) {
      requestAnimationFrame(() => {
        if (textareaRef) textareaRef.scrollTop = file.scrollTop;
      });
    }
  });

  const lineCount = () => content().split("\n").length;
  const basename = (path: string) => path.split("/").pop() ?? path;

  return (
    <div class="flex flex-col h-full bg-[var(--bg-primary)]" data-file-viewer>
      {/* Tab bar */}
      <div class="flex items-center h-8 border-b border-[var(--border)] shrink-0 px-1 gap-0.5" data-file-viewer-tabs>
        <For each={openFiles()}>
          {(file, idx) => {
            const icon = () => getFileIcon(basename(file.path), "file", fileIconPack(), file.path);

            return (
              <button
                class="flex items-center gap-1 px-2 py-1 text-[11px] rounded-t-[var(--btn-radius)] transition-colors max-w-[160px] group"
                classList={{
                  "bg-[var(--bg-secondary)] text-[var(--text-primary)] border-b-2 border-[var(--accent)]": idx() === activeFileIndex(),
                  "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]": idx() !== activeFileIndex(),
                }}
                data-file-tab={basename(file.path)}
                onClick={() => setActiveFileInTerminal(props.terminalId, idx())}
              >
                <span
                  class="shrink-0 w-4 h-4 flex items-center justify-center"
                >
                  <Show
                    when={icon().kind === "asset"}
                    fallback={
                      <span
                        class="text-[10px] font-mono font-bold leading-none"
                        style={{ color: icon().color }}
                      >
                        {icon().icon}
                      </span>
                    }
                  >
                    <img
                      src={icon().icon}
                      alt=""
                      class="w-[13px] h-[13px]"
                      draggable={false}
                    />
                  </Show>
                </span>
                <span class="truncate">{basename(file.path)}</span>
                <Show when={idx() === activeFileIndex() && isDirty()}>
                  <span class="text-[var(--warning)] ml-0.5">{"\u25CF"}</span>
                </Show>
                <span
                  class="ml-1 text-[var(--text-secondary)] hover:text-[var(--danger)] opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeFileInTerminal(props.terminalId, idx());
                  }}
                >
                  {"\u00D7"}
                </span>
              </button>
            );
          }}
        </For>

        <div class="flex-1" />

        {/* Markdown toggle */}
        <Show when={isMarkdown() && !binary()}>
          <button
            class="text-[10px] px-1.5 py-0.5 rounded-[var(--btn-radius)] transition-colors"
            classList={{
              "text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]": mdPreview(),
              "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)]": !mdPreview(),
            }}
            data-md-preview-toggle
            onClick={() => {
              const next = !mdPreview();
              setMdPreview(next);
              if (next) renderMarkdown(content());
            }}
          >
            {mdPreview() ? "Edit" : "Preview"}
          </button>
        </Show>

        {/* Back to tree */}
        <button
          class="text-[10px] px-1.5 py-0.5 rounded-[var(--btn-radius)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] transition-colors"
          onClick={() => setTerminalView(props.terminalId, "filetree")}
          title="Back to file tree"
        >
          {"\u2190"} Tree
        </button>

        {/* Close viewer */}
        <button
          class="text-[10px] px-1 py-0.5 rounded-[var(--btn-radius)] text-[var(--text-secondary)] hover:text-[var(--danger)] hover:bg-[var(--bg-tertiary)] transition-colors"
          onClick={() => setTerminalView(props.terminalId, "terminal")}
          title="Close file viewer"
        >
          {"\u2715"}
        </button>
      </div>

      {/* Status bar */}
      <Show when={truncated() || saving()}>
        <div class="flex items-center px-2 py-0.5 border-b border-[var(--border)] shrink-0 text-[10px]">
          <Show when={truncated()}>
            <span class="text-[var(--warning)]">File truncated at 1MB ({(fileSize() / 1024 / 1024).toFixed(1)}MB total) — read-only</span>
          </Show>
          <Show when={saving()}>
            <span class="text-[var(--accent)]">Saving...</span>
          </Show>
        </div>
      </Show>

      {/* Content area */}
      <div class="flex-1 min-h-0 overflow-hidden relative">
        <Show when={loading()}>
          <div class="absolute inset-0 flex items-center justify-center bg-[var(--bg-primary)] z-10">
            <span class="text-xs text-[var(--text-secondary)]">Loading...</span>
          </div>
        </Show>

        <Show when={binary()}>
          <div class="flex items-center justify-center h-full">
            <span class="text-sm text-[var(--text-secondary)]">Binary file — cannot display</span>
          </div>
        </Show>

        <Show when={!binary() && !loading()}>
          {/* Markdown preview */}
          <Show when={mdPreview()}>
            <div
              class="h-full overflow-y-auto p-4 prose-viewer"
              innerHTML={mdHtml()}
            />
          </Show>

          {/* Code editor */}
          <Show when={!mdPreview()}>
            <div class="flex h-full">
              {/* Line number gutter */}
              <div
                ref={gutterRef}
                class="shrink-0 overflow-hidden select-none border-r border-[var(--border)] bg-[var(--bg-primary)]"
                style={{ width: `${Math.max(3, String(lineCount()).length) * 8 + 16}px` }}
              >
                <div class="py-[4px]">
                  <For each={Array.from({ length: lineCount() }, (_, i) => i + 1)}>
                    {(num) => (
                      <div
                        class="text-right pr-2 text-[var(--text-secondary)] opacity-40 select-none"
                        style={{
                          "font-size": "12px",
                          "line-height": "20px",
                          "font-family": "var(--font-mono, ui-monospace, monospace)",
                        }}
                      >
                        {num}
                      </div>
                    )}
                  </For>
                </div>
              </div>

              {/* Editor area */}
              <div class="flex-1 min-w-0 relative">
                {/* Highlighted layer */}
                <pre
                  ref={preRef}
                  class="absolute inset-0 overflow-auto m-0 p-[4px] whitespace-pre pointer-events-none"
                  style={{
                    "font-size": "12px",
                    "line-height": "20px",
                    "font-family": "var(--font-mono, ui-monospace, monospace)",
                    "tab-size": "2",
                  }}
                >
                  <code innerHTML={highlighted()} />
                </pre>

                {/* Textarea input layer */}
                <textarea
                  ref={textareaRef}
                  class="absolute inset-0 w-full h-full resize-none m-0 p-[4px] bg-transparent outline-none whitespace-pre overflow-auto"
                  style={{
                    "font-size": "12px",
                    "line-height": "20px",
                    "font-family": "var(--font-mono, ui-monospace, monospace)",
                    color: "transparent",
                    "caret-color": "var(--text-primary)",
                    "tab-size": "2",
                  }}
                  value={content()}
                  onInput={(e) => handleInput(e.currentTarget.value)}
                  onScroll={handleScroll}
                  readOnly={isReadOnly()}
                  spellcheck={false}
                />
              </div>
            </div>
          </Show>
        </Show>
      </div>

      {/* Markdown preview styles */}
      <style>{`
        .prose-viewer {
          color: var(--text-primary);
          font-size: 14px;
          line-height: 1.6;
        }
        .prose-viewer h1, .prose-viewer h2, .prose-viewer h3, .prose-viewer h4 {
          color: var(--text-primary);
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          font-weight: 600;
        }
        .prose-viewer h1 { font-size: 1.5em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
        .prose-viewer h2 { font-size: 1.25em; border-bottom: 1px solid var(--border); padding-bottom: 0.3em; }
        .prose-viewer h3 { font-size: 1.1em; }
        .prose-viewer p { margin: 0.8em 0; }
        .prose-viewer a { color: var(--accent); text-decoration: underline; }
        .prose-viewer code {
          background: var(--bg-secondary);
          padding: 0.15em 0.4em;
          border-radius: 3px;
          font-size: 0.9em;
          font-family: var(--font-mono, ui-monospace, monospace);
        }
        .prose-viewer pre {
          background: var(--bg-secondary);
          padding: 12px;
          border-radius: 6px;
          overflow-x: auto;
        }
        .prose-viewer pre code { background: transparent; padding: 0; }
        .prose-viewer blockquote {
          border-left: 3px solid var(--accent);
          padding-left: 12px;
          color: var(--text-secondary);
          margin: 0.8em 0;
        }
        .prose-viewer ul, .prose-viewer ol { padding-left: 1.5em; margin: 0.8em 0; }
        .prose-viewer li { margin: 0.3em 0; }
        .prose-viewer img { max-width: 100%; border-radius: 6px; }
        .prose-viewer table { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
        .prose-viewer th, .prose-viewer td {
          border: 1px solid var(--border);
          padding: 6px 12px;
          text-align: left;
        }
        .prose-viewer th { background: var(--bg-secondary); font-weight: 600; }
        .prose-viewer hr { border: none; border-top: 1px solid var(--border); margin: 1.5em 0; }
        .prose-viewer .mermaid-placeholder {
          margin: 1em 0;
          padding: 16px;
          background: var(--bg-secondary);
          border-radius: 6px;
          overflow-x: auto;
        }
        .prose-viewer .mermaid-rendered svg {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </div>
  );
}
