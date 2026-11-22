// Eval runner for the KickerLiga harness (lecture 8).
//
//   npm run eval -- --harness vl08 --runs 3
//   npm run eval -- --harness vl08-long --runs 3 --tasks win-rate,tournament-mode
//   npm run eval -- --self-test            (no model: start must fail, reference must pass)
//
// For every task and run:
//  1. sandbox: a fresh copy of the task's start ref with the harness files
//     (AGENTS.md, opencode.json, .opencode/) of --harness, its own git repo,
//     without evals/ and demos/, so the agent sees neither checks nor solutions
//  2. demo database reset to the start state
//  3. `opencode run --format json` with the task prompt, headless
//  4. demo database reset again (applies the agent's migrations), tests
//     restored from the start ref, hidden check copied in
//  5. check: acceptance tests of the task, unit tests, typecheck, lint
//  6. usage from `opencode export` of the session and its subagent sessions
// Results: evals/results/<stamp>-<harness>.csv and .md; raw logs in evals/runs/.
//
// Runs are sequential: all of them share the one demo database.

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
import { TASKS, type EvalTask } from './tasks'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, mkdir } from 'node:fs/promises'

const ROOT = process.cwd()
const HARNESS_FILES = ['AGENTS.md', 'opencode.json', '.opencode']

type Options = {
  harness: string
  runs: number
  k: number
  tasks: EvalTask[]
  model?: string
  bash: 'harness' | 'allow'
  selfTest: boolean
  keep: boolean
}

type Check = {
  migrations: boolean
  acceptance: string // "8/8", or an error
  acceptanceOk: boolean
  unit: boolean
  typecheck: boolean
  lint: boolean
  pass: boolean
}

type Usage = {
  steps: number
  toolCalls: number
  compactions: number
  sessions: number
  input: number
  output: number
  reasoning: number
  cacheRead: number
  cacheWrite: number
  cost: number
}

type Row = {
  task: string
  run: number
  check: Check
  minutes: number
  exit: string
  sessionId: string
  usage: Usage
}

// ---------- small process helpers ----------

function run(
  cmd: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ code: number; output: string }> {
  return new Promise((resolve) => {
    let output = ''
    // PWD as well: opencode takes its project root from PWD before the cwd.
    const child = spawn(cmd, args, { cwd, env: { ...env, PWD: cwd }, stdio: ['ignore', 'pipe', 'pipe'] })
    child.stdout.on('data', (chunk) => (output += chunk))
    child.stderr.on('data', (chunk) => (output += chunk))
    child.on('error', (error) => resolve({ code: -1, output: error.message }))
    child.on('close', (code) => resolve({ code: code ?? -1, output }))
  })
}

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim()
}

// ---------- options ----------

function options(): Options {
  const { values } = parseArgs({
    options: {
      harness: { type: 'string', default: 'HEAD' },
      runs: { type: 'string', default: '3' },
      k: { type: 'string' },
      tasks: { type: 'string' },
      model: { type: 'string' },
      bash: { type: 'string', default: 'harness' },
      'self-test': { type: 'boolean', default: false },
      keep: { type: 'boolean', default: false },
    },
  })
  const runs = Number(values.runs)
  const ids = values.tasks?.split(',').map((s) => s.trim())
  const tasks = ids ? TASKS.filter((t) => ids.includes(t.id)) : TASKS
  if (ids && tasks.length !== ids.length) {
    throw new Error(`unknown task in --tasks; known: ${TASKS.map((t) => t.id).join(', ')}`)
  }
  if (values.bash !== 'harness' && values.bash !== 'allow') {
    throw new Error('--bash must be "harness" or "allow"')
  }
  return {
    harness: values.harness,
    runs: values['self-test'] ? 1 : runs,
    k: Math.min(Number(values.k ?? 3), runs),
    tasks,
    model: values.model,
    bash: values.bash,
    selfTest: values['self-test'],
    keep: values.keep,
  }
}

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


// ---------- check ----------


async function check(
  task: EvalTask,
  dir: string,
  logDir: string,
  label: string,
): Promise<Check> {
  const result: Check = {
    migrations: false,
    acceptance: '',
    acceptanceOk: false,
    unit: false,
    typecheck: false,
    lint: false,
    pass: false,
  }

  // Tests auf den ursprünglichen Stand zurücksetzen.
  const testsDir = path.join(dir, 'tests')

  if (existsSync(testsDir)) {
    git(dir, 'checkout', 'HEAD', '--', 'tests')
  }

  let files: string[]

  if (task.check.hidden) {
    const target = path.join(
      'tests',
      'acceptance',
      `zz-eval-${task.id}.test.ts`,
    )

    const source = path.join(
      ROOT,
      'evals',
      'tasks',
      task.id,
      'check.test.ts',
    )

    mkdirSync(path.dirname(path.join(dir, target)), { recursive: true })
    copyFileSync(source, path.join(dir, target))

    files = [target]
  } else {
    files = task.check.files
  }

  const vitest = path.join(dir, 'node_modules', '.bin', 'vitest')

  // 1. Acceptance-Tests
  if (files.length > 0) {
    const acceptance = await run(vitest, ['run', ...files], dir)

    result.acceptanceOk = acceptance.code === 0
    result.acceptance = result.acceptanceOk ? 'passed' : 'failed'
  } else {
    result.acceptance = 'no tests configured'
    result.acceptanceOk = false
  }

  // 2. Unit-Tests
  result.unit = (
    await run(vitest, ['run'], dir)
  ).code === 0

  // 3. TypeScript
  result.typecheck = (
    await run('npm', ['run', '--silent', 'typecheck'], dir)
  ).code === 0

  // 4. Lint
  result.lint = (
    await run('npm', ['run', '--silent', 'lint'], dir)
  ).code === 0

  // 5. Gesamtergebnis
  result.pass =
    result.acceptanceOk &&
    result.unit &&
    result.typecheck &&
    result.lint

  return result
}


// ---------- agent ----------

type AgentRun = { sessionId: string; children: string[]; exit: string; minutes: number }

function runAgent(task: EvalTask, dir: string, opts: Options, logFile: string): Promise<AgentRun> {
  const prompt = readFileSync(path.join(ROOT, 'evals', 'tasks', task.id, 'prompt.md'), 'utf8')
  // --dir and PWD: opencode run takes its project root from PWD, not from the
  // cwd, and would otherwise work in the repository the runner was started from.
  const args = ['run', '--format', 'json', '--dir', dir]
  if (opts.model) args.push('--model', opts.model)
  args.push(prompt)

  const env: NodeJS.ProcessEnv = { ...process.env, PWD: dir, OPENCODE_DISABLE_AUTOUPDATE: '1' }
  // Headless, "ask" is rejected. --bash allow turns bash "*" into "allow" for the
  // sandbox only; explicit deny rules of the harness still win.
  if (opts.bash === 'allow') env.OPENCODE_PERMISSION = JSON.stringify({ bash: { '*': 'allow' } })

  const started = Date.now()
  const log = createWriteStream(logFile)
  return new Promise((resolve) => {
    let sessionId = ''
    const children = new Set<string>()
    let buffer = ''
    let timedOut = false
    // stdin closed: opencode run reads piped stdin until EOF and would wait forever.
    const child = spawn('opencode', args, { cwd: dir, env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] })

    const onLine = (line: string) => {
      if (!line.trim()) return
      log.write(line + '\n')
      try {
        const event = JSON.parse(line) as {
          sessionID?: string
          type?: string
          part?: { tool?: string; state?: { metadata?: { sessionId?: string } } }
        }
        if (!sessionId && event.sessionID) sessionId = event.sessionID
        const sub = event.part?.tool === 'task' ? event.part.state?.metadata?.sessionId : undefined
        if (sub) children.add(sub)
      } catch {
        // not a JSON event: keep it in the log only
      }
    }
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      lines.forEach(onLine)
    })
    child.stderr.on('data', (chunk: Buffer) => log.write(`[stderr] ${chunk.toString()}`))

    const timer = setTimeout(() => {
      timedOut = true
      try {
        process.kill(-(child.pid ?? 0), 'SIGTERM')
      } catch {
        child.kill('SIGTERM')
      }
    }, task.minutes * 60_000)

    const finish = (exit: string) => {
      clearTimeout(timer)
      onLine(buffer)
      log.end()
      resolve({ sessionId, children: [...children], exit, minutes: (Date.now() - started) / 60_000 })
    }
    child.on('error', (error) => finish(`error: ${error.message}`))
    child.on('close', (code) => finish(timedOut ? 'timeout' : `exit ${code}`))
  })
}

// ---------- usage ----------

type ExportPart = {
  type: string
  cost?: number
  tokens?: { input: number; output: number; reasoning: number; cache: { read: number; write: number } }
}

type ExportData = {
  info?: {
    cost?: number
    tokens?: {
      input: number
      output: number
      reasoning: number
      cache: {
        read: number
        write: number
      }
    }
  }
  messages?: { parts?: ExportPart[] }[]
}

function emptyUsage(): Usage {
  return { steps: 0, toolCalls: 0, compactions: 0, sessions: 0, input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0 }
}

const execFileAsync = promisify(execFile)

async function exportTo(
  dir: string,
  id: string,
  file: string,
): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true })

  try {
    const { stdout, stderr } = await execFileAsync(
      'opencode',
      ['export', id],
      {
        cwd: dir,
        encoding: 'utf8',
        maxBuffer: 100 * 1024 * 1024,
      },
    )

    await writeFile(file, stdout, 'utf8')

    console.log(`Export ${id}: ${stdout.length} bytes`)

    if (stderr.trim()) {
      console.log(`Export stderr: ${stderr.trim()}`)
    }

    if (!stdout.trim()) {
      console.error(`Export returned empty output for ${id}`)
    }
  } catch (error) {
    console.error(`Export failed for ${id}:`, error)
    throw error
  }
}




async function usage(
  dir: string,
  sessions: string[],
  logDir: string,
  label: string,
): Promise<Usage> {
  const total = emptyUsage()

  console.log('\n--- USAGE DEBUG ---')
  console.log('Sessions:', sessions)

  for (const id of sessions.filter(Boolean)) {
    console.log('\nProcessing session:', id)

    const file = path.join(logDir, `${label}-export-${id}.json`)

    await exportTo(dir, id, file)

    console.log('Export file:', file)
    console.log('File exists:', existsSync(file))

    if (!existsSync(file)) {
      console.warn('Export file was not created:', id)
      continue
    }

    const text = readFileSync(file, 'utf8')

    console.log('File size:', text.length)

    const start = text.indexOf('{')

    if (start < 0) {
      console.warn('No JSON object found:', id)
      continue
    }

    type ExportData = {
      info?: {
        cost?: number
        tokens?: {
          input?: number
          output?: number
          reasoning?: number
          cache?: {
            read?: number
            write?: number
          }
        }
      }
      messages?: {
        parts?: ExportPart[]
      }[]
    }

    let data: ExportData

    try {
      data = JSON.parse(text.slice(start))
    } catch (error) {
      console.warn('Could not parse export:', id, error)
      continue
    }

    console.log('Export info:', JSON.stringify(data.info, null, 2))

    total.sessions += 1

    const usageData = data.info?.tokens

    if (usageData) {
      total.input += usageData.input ?? 0
      total.output += usageData.output ?? 0
      total.reasoning += usageData.reasoning ?? 0
      total.cacheRead += usageData.cache?.read ?? 0
      total.cacheWrite += usageData.cache?.write ?? 0
    } else {
      console.warn('No token information found:', id)
    }

    total.cost += data.info?.cost ?? 0

    for (const part of (data.messages ?? []).flatMap(
      (message) => message.parts ?? [],
    )) {
      if (part.type === 'tool') {
        total.toolCalls += 1
      }

      if (part.type === 'compaction') {
        total.compactions += 1
      }

      if (part.type === 'step-finish') {
        total.steps += 1
      }
    }

    console.log('Session processed:', id)
  }

  console.log('\n--- USAGE TOTAL ---')
  console.log(JSON.stringify(total, null, 2))
  console.log('--- END USAGE DEBUG ---\n')

  return total
}



const tokens = (u: Usage) => u.input + u.output + u.reasoning + u.cacheRead + u.cacheWrite

// ---------- metrics ----------

// Unbiased estimator of pass@k (Chen et al. 2021): 1 - C(n-c, k) / C(n, k).
export function passAtK(n: number, c: number, k: number): number {
  if (n - c < k) return 1
  let rest = 1
  for (let i = n - c + 1; i <= n; i++) rest *= 1 - k / i
  return 1 - rest
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const fmt = (x: number, digits = 2) => x.toFixed(digits)

function writeResults(rows: Row[], opts: Options, stamp: string, commit: string) {
  const dir = path.join(ROOT, 'evals', 'results')
  mkdirSync(dir, { recursive: true })
  const base = path.join(dir, `${stamp}-${opts.harness.replace(/[^\w.-]/g, '_')}`)

  const header = 'task,run,pass,acceptance,unit,typecheck,lint,migrations,exit,minutes,steps,tool_calls,sessions,compactions,tokens_input,tokens_output,tokens_reasoning,tokens_cache_read,tokens_cache_write,tokens_total,cost,session_id'
  const csv = rows.map((r) =>
    [
      r.task, r.run, r.check.pass, r.check.acceptance, r.check.unit, r.check.typecheck, r.check.lint,
      r.check.migrations, r.exit, fmt(r.minutes), r.usage.steps, r.usage.toolCalls, r.usage.sessions,
      r.usage.compactions, r.usage.input, r.usage.output, r.usage.reasoning, r.usage.cacheRead,
      r.usage.cacheWrite, tokens(r.usage), fmt(r.usage.cost, 4), r.sessionId,
    ].join(','),
  )
  writeFileSync(`${base}.csv`, [header, ...csv].join('\n') + '\n')

  const k = opts.k
  const lines = [
    `# Eval results: harness ${opts.harness} (${commit})`,
    '',
    `Date ${stamp}, model ${opts.model ?? 'from opencode.json'}, n = ${opts.runs} runs per task, k = ${k}, bash ${opts.bash}.`,
    '',
    `| Task | Size | Passed | pass@1 | pass@${k} | Tokens per run | Cost per run | Minutes per run | Steps per run | Compactions |`,
    '|---|---|---|---|---|---|---|---|---|---|',
  ]
  const p1: number[] = []
  const pk: number[] = []
  for (const task of opts.tasks) {
    const own = rows.filter((r) => r.task === task.id)
    if (!own.length) continue
    const c = own.filter((r) => r.check.pass).length
    p1.push(passAtK(own.length, c, 1))
    pk.push(passAtK(own.length, c, k))
    lines.push(
      `| ${task.id} | ${task.size} | ${c}/${own.length} | ${fmt(p1.at(-1) ?? 0)} | ${fmt(pk.at(-1) ?? 0)} | ` +
        `${Math.round(mean(own.map((r) => tokens(r.usage))))} | ${fmt(mean(own.map((r) => r.usage.cost)), 4)} | ` +
        `${fmt(mean(own.map((r) => r.minutes)), 1)} | ${fmt(mean(own.map((r) => r.usage.steps)), 1)} | ` +
        `${fmt(mean(own.map((r) => r.usage.compactions)), 1)} |`,
    )
  }
  lines.push(
    `| **All tasks** | | ${rows.filter((r) => r.check.pass).length}/${rows.length} | ${fmt(mean(p1))} | ${fmt(mean(pk))} | ` +
      `${Math.round(mean(rows.map((r) => tokens(r.usage))))} | ${fmt(mean(rows.map((r) => r.usage.cost)), 4)} | ` +
      `${fmt(mean(rows.map((r) => r.minutes)), 1)} | ${fmt(mean(rows.map((r) => r.usage.steps)), 1)} | ` +
      `${fmt(mean(rows.map((r) => r.usage.compactions)), 1)} |`,
    '',
    'pass = acceptance tests of the task, unit tests, typecheck and lint all green.',
    'Tokens = input + output + reasoning + cache read + cache write, main session plus subagent sessions.',
  )
  writeFileSync(`${base}.md`, lines.join('\n') + '\n')
  return base
}

// ---------- main ----------

async function selfTest(opts: Options, logRoot: string) {
  console.log('Self-test: the check must fail at the start ref and pass with reference.patch.\n')
  let ok = true
  for (const task of opts.tasks) {
    const logDir = path.join(logRoot, task.id)
    mkdirSync(logDir, { recursive: true })
    const dir = makeSandbox(task, opts.harness)
    const before = await check(task, dir, logDir, 'start')
    const patch = path.join(ROOT, 'evals', 'tasks', task.id, 'reference.patch')
    const applied = await run('git', ['apply', '--whitespace=nowarn', patch], dir)
    const after = applied.code === 0 ? await check(task, dir, logDir, 'reference') : undefined
    const good = !before.acceptanceOk && Boolean(after?.pass)
    ok &&= good
    console.log(
  `${good ? 'OK  ' : 'FAIL'} ${task.id.padEnd(18)} start: ${before.acceptance.padEnd(16)} ` +
    `reference: ${after ? `${after.acceptance}, unit ${after.unit}, typecheck ${after.typecheck}, lint ${after.lint}` : 'patch failed'}`,
)
    if (!opts.keep) rmSync(dir, { recursive: true, force: true })
  }
  process.exitCode = ok ? 0 : 1
}


async function main() {
  const opts = options()

  const stamp = new Date().toISOString()
    .slice(0, 16)
    .replace(/[:T]/g, '-')

  const logRoot = path.join(
    ROOT,
    'evals',
    'runs',
    `${stamp}-${opts.selfTest ? 'self-test' : opts.harness.replace(/[^\w.-]/g, '_')}`,
  )

  mkdirSync(logRoot, { recursive: true })

  if (opts.selfTest) return selfTest(opts, logRoot)

  const commit = git(ROOT, 'rev-parse', '--short', opts.harness)

  console.log(
    `Harness ${opts.harness} (${commit}), ${opts.tasks.length} tasks x ${opts.runs} runs, bash ${opts.bash}`,
  )

  const rows: Row[] = []

  for (const task of opts.tasks) {
    for (let i = 1; i <= opts.runs; i++) {
      const label = `${task.id}-${i}`

      const logDir = path.join(logRoot, task.id)
      mkdirSync(logDir, { recursive: true })

      const dir = makeSandbox(task, opts.harness)

      console.log(`\nStarting agent: ${label}`)

      const agent = await runAgent(
        task,
        dir,
        opts,
        path.join(logDir, `${label}.jsonl`),
      )

      console.log('\n--- AGENT DEBUG ---')
      console.log('Session ID:', agent.sessionId)
      console.log('Subagent sessions:', agent.children)
      console.log('Exit:', agent.exit)
      console.log('Minutes:', agent.minutes)
      console.log('--- END AGENT DEBUG ---\n')

      const result = await check(task, dir, logDir, label)

      const used = await usage(
        dir,
        [agent.sessionId, ...agent.children],
        logDir,
        label,
      )

      rows.push({
        task: task.id,
        run: i,
        check: result,
        minutes: agent.minutes,
        exit: agent.exit,
        sessionId: agent.sessionId,
        usage: used,
      })

      console.log(
        `${result.pass ? 'PASS' : 'FAIL'} ${label.padEnd(20)} acceptance ${result.acceptance.padEnd(16)} ` +
        `${fmt(agent.minutes, 1)} min, ${used.steps} steps, ${tokens(used)} tokens, ${agent.exit}`,
      )

      if (opts.keep) {
        console.log(`Sandbox kept: ${dir}`)
      } else {
        rmSync(dir, { recursive: true, force: true })
      }
    }
  }

  const base = writeResults(rows, opts, stamp, commit)

  console.log(
    `\nResults: ${path.relative(ROOT, base)}.md and .csv`,
  )
}

main().catch((error: Error) => {
  console.error(error.message)
  process.exitCode = 1
})
