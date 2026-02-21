import * as git from "../services/git-service";

export async function gitRoutes(req: Request, url: URL): Promise<Response | null> {
  const cwd = url.searchParams.get("cwd");
  if (!cwd) {
    return Response.json({ error: "cwd query parameter required" }, { status: 400 });
  }

  // Validate cwd exists and is a directory
  const check = git.validateCwd(cwd);
  if (!check.valid) {
    return Response.json({ error: check.error }, { status: 400 });
  }

  // GET /api/git/status?cwd=...
  if (req.method === "GET" && url.pathname === "/api/git/status") {
    const status = await git.getStatus(cwd);
    return Response.json(status);
  }

  // GET /api/git/diff?cwd=...&staged=true&file=...
  if (req.method === "GET" && url.pathname === "/api/git/diff") {
    const staged = url.searchParams.get("staged") === "true";
    const file = url.searchParams.get("file");
    const diff = file
      ? await git.getFileDiff(cwd, file, staged)
      : await git.getDiff(cwd, staged);
    return Response.json({ diff });
  }

  // POST /api/git/stage?cwd=...  body: { file: string }
  if (req.method === "POST" && url.pathname === "/api/git/stage") {
    const body = (await req.json()) as { file: string };
    if (!body.file) {
      return Response.json({ error: "file is required" }, { status: 400 });
    }
    const ok = await git.stageFile(cwd, body.file);
    return Response.json({ ok });
  }

  // POST /api/git/unstage?cwd=...  body: { file: string }
  if (req.method === "POST" && url.pathname === "/api/git/unstage") {
    const body = (await req.json()) as { file: string };
    if (!body.file) {
      return Response.json({ error: "file is required" }, { status: 400 });
    }
    const ok = await git.unstageFile(cwd, body.file);
    return Response.json({ ok });
  }

  // POST /api/git/commit?cwd=...  body: { message: string }
  if (req.method === "POST" && url.pathname === "/api/git/commit") {
    const body = (await req.json()) as { message: string };
    if (!body.message) {
      return Response.json({ error: "message is required" }, { status: 400 });
    }
    const result = await git.commit(cwd, body.message);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  // GET /api/git/log?cwd=...&count=20
  if (req.method === "GET" && url.pathname === "/api/git/log") {
    const count = parseInt(url.searchParams.get("count") ?? "20");
    const log = await git.getLog(cwd, count);
    return Response.json({ log });
  }

  // GET /api/git/ahead-behind?cwd=...
  if (req.method === "GET" && url.pathname === "/api/git/ahead-behind") {
    const result = await git.getAheadBehind(cwd);
    return Response.json(result);
  }

  // POST /api/git/fetch?cwd=...
  if (req.method === "POST" && url.pathname === "/api/git/fetch") {
    const result = await git.fetchRemotes(cwd);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  // POST /api/git/push?cwd=...
  if (req.method === "POST" && url.pathname === "/api/git/push") {
    const result = await git.push(cwd);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  // POST /api/git/pull?cwd=...
  if (req.method === "POST" && url.pathname === "/api/git/pull") {
    const result = await git.pull(cwd);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  // GET /api/git/branches?cwd=...
  if (req.method === "GET" && url.pathname === "/api/git/branches") {
    const branches = await git.listBranches(cwd);
    return Response.json({ branches });
  }

  // POST /api/git/checkout?cwd=...  body: { branch: string }
  if (req.method === "POST" && url.pathname === "/api/git/checkout") {
    const body = (await req.json()) as { branch: string };
    if (!body.branch) {
      return Response.json({ error: "branch is required" }, { status: 400 });
    }
    const result = await git.checkout(cwd, body.branch);
    return Response.json(result, { status: result.ok ? 200 : 400 });
  }

  // POST /api/git/stage-all?cwd=...
  if (req.method === "POST" && url.pathname === "/api/git/stage-all") {
    const ok = await git.stageAll(cwd);
    return Response.json({ ok });
  }

  // POST /api/git/unstage-all?cwd=...
  if (req.method === "POST" && url.pathname === "/api/git/unstage-all") {
    const ok = await git.unstageAll(cwd);
    return Response.json({ ok });
  }

  // GET /api/git/diff-stats?cwd=...
  if (req.method === "GET" && url.pathname === "/api/git/diff-stats") {
    const stats = await git.getDiffStats(cwd);
    return Response.json(stats);
  }

  // GET /api/git/repo-tree?cwd=...
  if (req.method === "GET" && url.pathname === "/api/git/repo-tree") {
    const tree = await git.getRepoTree(cwd);
    if (!tree) {
      return Response.json({ error: "Not a git repository" }, { status: 400 });
    }
    return Response.json(tree);
  }

  return null;
}
