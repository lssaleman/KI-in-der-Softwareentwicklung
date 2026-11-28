// Loads an OpenCode tool from .opencode/tools/ for verify.mjs.
//
// The tool is called exactly as OpenCode calls it: execute(args, context).
// So verify.mjs and the agent use the same implementation of every rule.

import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Returns a function (dir, target) => report for the tool in
 * <root>/.opencode/tools/<file>.
 */
export async function loadTool(file, root) {
  const url = pathToFileURL(path.join(root, ".opencode", "tools", file)).href;
  const tool = (await import(url)).default;
  if (!tool || typeof tool.execute !== "function") {
    throw new Error(`${file} does not export an OpenCode tool`);
  }
  return async (dir, target) =>
    JSON.parse(await tool.execute({ target }, { worktree: dir, directory: dir }));
}
