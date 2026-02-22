import type { Page, Locator } from "@playwright/test";
import { sel } from "../helpers/selectors";

export class GitPanelPO {
  readonly page: Page;
  readonly root: Locator;

  constructor(page: Page) {
    this.page = page;
    // Git panel is rendered via Portal — target the fixed z-[9999] container
    this.root = page.locator(sel.gitPanelPortal);
  }

  /** Check if the git panel popover is visible. */
  async isVisible(): Promise<boolean> {
    return this.root.isVisible();
  }

  /** Click a file in the changed files list by partial name. */
  async clickFile(name: string) {
    await this.root.locator(`text=${name}`).first().click();
  }

  /** Check if a diff viewer is showing content. */
  async isDiffVisible(): Promise<boolean> {
    // DiffViewer renders pre/code blocks for diff content
    const diffContent = this.root.locator("pre, .diff-line");
    return (await diffContent.count()) > 0;
  }

  /** Get the commit message input. */
  commitInput(): Locator {
    return this.root.locator('textarea, input[placeholder*="ommit"]');
  }

  /** Type a commit message and submit. */
  async commit(message: string) {
    const input = this.commitInput();
    await input.fill(message);
    await input.press("Enter");
  }

  /** Close the git panel by clicking the close button. */
  async close() {
    await this.root.locator('button[title="Close git panel"]').click();
  }

  /** Get the push badge button. */
  pushBadge(): Locator {
    return this.root.locator('button[title*="Push"]');
  }

  /** Get the pull badge button. */
  pullBadge(): Locator {
    return this.root.locator('button[title*="Pull"]');
  }

  /** Get the branch name text. */
  async branchName(): Promise<string> {
    return (
      (await this.root.locator('button[title="Switch branch"] span').first().textContent()) ?? ""
    );
  }

  /** Check for the Source Control heading. */
  sourceControlHeading(): Locator {
    return this.root.locator("text=Source Control");
  }

  /** Get staged files section. */
  stagedSection(): Locator {
    return this.root.locator("text=Staged");
  }

  /** Get unstaged/changed files section. */
  unstagedSection(): Locator {
    return this.root.locator("text=Changes");
  }

  /** Get untracked files section. */
  untrackedSection(): Locator {
    return this.root.locator("text=Untracked");
  }

  /** Get the "Stage All" button. */
  stageAllButton(): Locator {
    return this.root.locator('button:has-text("Stage All")');
  }

  /** Get the "Unstage All" button. */
  unstageAllButton(): Locator {
    return this.root.locator('button:has-text("Unstage All")');
  }

  /** Get the Commit button (not the input). */
  commitButton(): Locator {
    return this.root.locator('button:has-text("Commit")');
  }

  /** Get the current repo name button in RepoNavigator (the accented button with dropdown arrow). */
  repoDropdown(): Locator {
    return this.root.locator("button").filter({ hasText: "▾" });
  }

  /** Get the "Return to terminal's repo" reset button. */
  repoResetButton(): Locator {
    return this.root.locator('button[title="Return to terminal\'s repo"]');
  }
}
