import { Router, Request, Response } from "express";
import path from "path";
import fs from "fs";
import simpleGit from "simple-git";
import { createContextLogger } from "../../utils/logger";
import { config } from "../../config";

const log = createContextLogger("api-github");
const router = Router();

const REPOS_DIR = path.join(config.paths.root, "cloned-repos");

if (!fs.existsSync(REPOS_DIR)) {
  fs.mkdirSync(REPOS_DIR, { recursive: true });
}

/**
 * POST /api/github/clone
 * Clone a repository from a URL.
 */
router.post("/clone", async (req: Request, res: Response) => {
  try {
    const { url, name, branch } = req.body;

    if (!url || typeof url !== "string") {
      res.status(400).json({ success: false, error: "Missing required field: url" });
      return;
    }

    const repoName = name || url.split("/").pop()?.replace(/\.git$/, "") || "repo";
    const targetDir = path.join(REPOS_DIR, repoName);

    if (fs.existsSync(targetDir)) {
      res.status(409).json({
        success: false,
        error: `Repository "${repoName}" already exists locally.`,
      });
      return;
    }

    log.info("Cloning repository", { url, targetDir, branch });

    const git = simpleGit();
    const cloneOptions: string[] = [];
    if (branch) cloneOptions.push("--branch", branch);
    await git.clone(url, targetDir, cloneOptions);

    const repoGit = simpleGit(targetDir);
    const status = await repoGit.status();
    const logResult = await repoGit.log({ maxCount: 5 });

    log.info("Repository cloned successfully", { repoName, branch: status.current });

    res.json({
      success: true,
      data: {
        name: repoName,
        path: targetDir,
        url,
        branch: status.current,
        files: status.files.length,
        lastCommit: logResult.latest,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("Clone failed", { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * POST /api/github/push
 * Stage all changes, commit, and push.
 */
router.post("/push", async (req: Request, res: Response) => {
  try {
    const { repoPath, message, branch } = req.body;

    if (!repoPath || typeof repoPath !== "string") {
      res.status(400).json({ success: false, error: "Missing required field: repoPath" });
      return;
    }
    if (!message || typeof message !== "string") {
      res.status(400).json({ success: false, error: "Missing required field: message" });
      return;
    }

    const resolvedPath = path.resolve(repoPath);
    if (!fs.existsSync(resolvedPath)) {
      res.status(404).json({ success: false, error: `Repository not found: ${resolvedPath}` });
      return;
    }

    const git = simpleGit(resolvedPath);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      res.status(400).json({ success: false, error: "Not a git repository" });
      return;
    }

    log.info("Pushing changes", { repoPath: resolvedPath, message });

    await git.add(".");
    const commitResult = await git.commit(message);
    const currentBranch = branch || (await git.status()).current || "main";
    await git.push("origin", currentBranch);

    log.info("Push successful", { branch: currentBranch, commit: commitResult.commit });

    res.json({
      success: true,
      data: {
        branch: currentBranch,
        commit: commitResult.commit,
        summary: commitResult.summary,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("Push failed", { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

export default router;

// ─── Additional routes (appended) ────────────────────────────

/**
 * GET /api/github/status
 * Get git status for a repository.
 */
router.get("/status", async (req: Request, res: Response) => {
  try {
    const repoPath = (req.query.path as string) || "";
    if (!repoPath) {
      res.status(400).json({ success: false, error: "Missing query param: path" });
      return;
    }

    const resolvedPath = path.resolve(repoPath);
    const git = simpleGit(resolvedPath);
    const isRepo = await git.checkIsRepo();
    if (!isRepo) {
      res.status(400).json({ success: false, error: "Not a git repository" });
      return;
    }

    const [status, logResult, remotes] = await Promise.all([
      git.status(),
      git.log({ maxCount: 10 }),
      git.getRemotes(true),
    ]);

    res.json({
      success: true,
      data: {
        branch: status.current,
        tracking: status.tracking,
        ahead: status.ahead,
        behind: status.behind,
        modified: status.modified,
        created: status.created,
        deleted: status.deleted,
        renamed: status.renamed,
        staged: status.staged,
        notAdded: status.not_added,
        conflicted: status.conflicted,
        isClean: status.isClean(),
        commits: logResult.all.map((c) => ({
          hash: c.hash.substring(0, 7),
          message: c.message,
          author: c.author_name,
          date: c.date,
        })),
        remotes: remotes.map((r) => ({ name: r.name, url: r.refs.fetch })),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("Status failed", { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * GET /api/github/repos
 * List locally cloned repositories.
 */
router.get("/repos", async (_req: Request, res: Response) => {
  try {
    const repos: Array<{
      name: string;
      path: string;
      branch: string | null;
      isClean: boolean;
      lastCommit: { hash: string; message: string; date: string } | null;
    }> = [];

    if (!fs.existsSync(REPOS_DIR)) {
      res.json({ success: true, data: repos });
      return;
    }

    const entries = fs.readdirSync(REPOS_DIR, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const repoPath = path.join(REPOS_DIR, entry.name);
      const git = simpleGit(repoPath);

      try {
        const isRepo = await git.checkIsRepo();
        if (!isRepo) continue;

        const [status, logResult] = await Promise.all([
          git.status(),
          git.log({ maxCount: 1 }),
        ]);

        repos.push({
          name: entry.name,
          path: repoPath,
          branch: status.current,
          isClean: status.isClean(),
          lastCommit: logResult.latest
            ? {
                hash: logResult.latest.hash.substring(0, 7),
                message: logResult.latest.message,
                date: logResult.latest.date,
              }
            : null,
        });
      } catch {
        // Skip directories that aren't valid repos
      }
    }

    res.json({ success: true, data: repos });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("List repos failed", { error: message });
    res.status(500).json({ success: false, error: message });
  }
});

/**
 * DELETE /api/github/repos/:name
 * Delete a locally cloned repository.
 */
router.delete("/repos/:name", async (req: Request, res: Response) => {
  try {
    const name = req.params.name as string;
    const repoPath = path.join(REPOS_DIR, name);

    if (!fs.existsSync(repoPath)) {
      res.status(404).json({ success: false, error: `Repository "${name}" not found` });
      return;
    }

    fs.rmSync(repoPath, { recursive: true, force: true });
    log.info("Repository deleted", { name });

    res.json({ success: true, data: { message: `Repository "${name}" deleted` } });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error("Delete repo failed", { error: message });
    res.status(500).json({ success: false, error: message });
  }
});