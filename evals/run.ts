import { execFileSync, spawn } from 'node:child_process'
import {
  closeSync,
  copyFileSync,
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { loadDemoEnv, runSupabase, tail } from '../scripts/demo-db.ts'
import { TASKS, type EvalTask } from './tasks'

// ---------- sandbox ----------

function extract(ref: string, dest: string, paths: string[] = []) {
  const tar = path.join(dest, '.eval-archive.tar')
  execFileSync('git', ['archive', '--output', tar, ref, ...paths], { cwd: ROOT })
  execFileSync('tar', ['-xf', tar, '-C', dest])
  rmSync(tar)
}

function makeSandbox(task: EvalTask, harness: string): string {
  const dir = mkdtempSync(path.join(tmpdir(), `kl-eval-${task.id}-`))
  extract(task.start, dir)
  for (const file of HARNESS_FILES) rmSync(path.join(dir, file), { recursive: true, force: true })
  extract(harness, dir, HARNESS_FILES)
  for (const hidden of ['evals', 'demos']) rmSync(path.join(dir, hidden), { recursive: true, force: true })

  symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'))
  const pluginDeps = path.join(ROOT, '.opencode', 'node_modules')
  if (existsSync(pluginDeps)) symlinkSync(pluginDeps, path.join(dir, '.opencode', 'node_modules'))
  if (existsSync(path.join(ROOT, '.env.demo'))) {
    copyFileSync(path.join(ROOT, '.env.demo'), path.join(dir, '.env.demo'))
  }

  git(dir, 'init', '-q')
  git(dir, 'add', '-A')
  git(dir, '-c', 'user.name=eval', '-c', 'user.email=eval@localhost', 'commit', '-qm', 'start')
  return dir
}