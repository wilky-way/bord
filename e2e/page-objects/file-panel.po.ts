import type { Page, Locator } from "@playwright/test";
import { sel } from "../helpers/selectors";

export class FilePanelPO {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /** File tree toggle button on a terminal title bar. */
  fileTreeButton(terminalId?: string): Locator {
    if (terminalId) {
      return this.page
        .locator(sel.terminalPanel(terminalId))
        .locator(sel.fileTreeButton);
    }
    return this.terminalArea().locator(sel.fileTreeButton).first();
  }

  /** Scope to the terminal panel area (excludes sidebar file trees). */
  private terminalArea(): Locator {
    return this.page.locator(sel.terminalPanel());
  }

  /** File tree root container scoped to terminal panel (visible when in filetree view). */
  fileTree(): Locator {
    return this.terminalArea().locator(sel.fileTreeRoot).first();
  }

  /** File tree toolbar. */
  fileTreeToolbar(): Locator {
    return this.terminalArea().locator(sel.fileTreeToolbar).first();
  }

  /** Hidden files toggle button (.*). */
  hiddenToggle(): Locator {
    return this.fileTreeToolbar().locator('button[title="Toggle hidden files"]');
  }

  /** Directory entry in the file tree by name. */
  dirEntry(name: string): Locator {
    return this.fileTree().locator(`div:has(> svg) >> text="${name}"`);
  }

  /** File entry in the file tree by name. */
  fileEntry(name: string): Locator {
    return this.fileTree().locator(`text="${name}"`);
  }

  /** Click to expand/collapse a directory. */
  async expandDir(name: string) {
    await this.dirEntry(name).click();
  }

  /** Double-click a file to open it. */
  async openFile(name: string) {
    await this.fileEntry(name).dblclick();
  }

  /** File viewer root container scoped to terminal panel. */
  fileViewer(): Locator {
    return this.terminalArea().locator(sel.fileViewerRoot).first();
  }

  /** File viewer tab bar. */
  fileViewerTabs(): Locator {
    return this.terminalArea().locator(sel.fileViewerTabs).first();
  }

  /** Active tab (has accent border). */
  activeTab(): Locator {
    return this.page.locator(sel.fileViewerTabs).locator("button.border-\\[var\\(--accent\\)\\]");
  }

  /** Tab by filename. */
  tabByName(name: string): Locator {
    return this.page.locator(sel.fileTab(name));
  }

  /** Close a tab by clicking its × button. */
  async closeTab(name: string) {
    const tab = this.tabByName(name);
    await tab.locator("span:has-text('×')").click();
  }

  /** The textarea editor input. */
  editorTextarea(): Locator {
    return this.page.locator(sel.fileViewerRoot).locator("textarea");
  }

  /** Back to tree button (← Tree). */
  backToTreeButton(): Locator {
    return this.page.locator(sel.backToTreeButton);
  }

  /** Close viewer button (✕). */
  closeViewerButton(): Locator {
    return this.page.locator(sel.closeViewerButton);
  }

  /** Markdown preview toggle button. */
  previewToggle(): Locator {
    return this.page.locator(sel.mdPreviewToggle);
  }

  /** Markdown preview content area. */
  previewContent(): Locator {
    return this.page.locator(sel.proseViewer);
  }

  /** Sidebar file tree button. */
  sidebarFilesButton(): Locator {
    // The sidebar has its own "File tree" button in the action bar
    return this.page.locator('[data-bord-sidebar] button[title="Browse files"]');
  }

  /** Check if file tree is visible. */
  async isFileTreeVisible(): Promise<boolean> {
    return this.fileTree().isVisible();
  }

  /** Check if file viewer is visible. */
  async isFileViewerVisible(): Promise<boolean> {
    return this.fileViewer().isVisible();
  }
}
