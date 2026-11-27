/**
 * Workspace to-do notebook, Host half.
 *
 * The notebook is one JSON file at a fixed path under the Harness home:
 * `<DSH_HOME>/workspace-todos.json`. It is the only store: the page reaches it
 * through the exact Fetch route `/api/workspace-todos`, the agent reaches it
 * through the `workspace_todos` tool, and both call the same functions below. Because the file has a stable absolute path and no session
 * or workspace in its address, every workspace's sessions share one notebook,
 * and ordinary file tools can read or edit the same file.
 *
 * Every operation reads the file before it writes it, so an edit made with a
 * file tool is picked up rather than overwritten from a stale memory copy.
 *
 * Only `node:` builtins are imported: a locally authored bundle does not
 * resolve `@deepseek-ai/*` packages at runtime (they live inside the desktop
 * app archive), so the tool definition below is a plain definition object and
 * its parameter and output schemas are written as raw JSON Schema.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'

/** Version of the stored envelope; a file from another version is refused. */
const STORE_VERSION = 1

/** Exact Fetch route on the shared `/api` channel that the page posts to. */
const BOARD_ROUTE = '/api/workspace-todos'

/** Endpoint name the page sends in its request envelope. */
const BOARD_ENDPOINT = 'workspace-todos'

/** Model-facing tool name. */
const TOOL_NAME = 'workspace_todos'

/** The one store path: fixed, global, and independent of any workspace. */
const DATA_FILE = join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'workspace-todos.json')

/** Tail of the serialized operation chain. */
let tail = Promise.resolve()

/**
 * Run one notebook operation after every operation queued before it.
 * @param task - the operation; it reads the file, changes it, and saves it.
 * @returns the task's own result or rejection.
 */
function serialized(task) {
  // Both arms run the next task: a failed operation reports its own error to
  // its caller and must not poison every later operation.
  const result = tail.then(task, task)
  tail = result.then(() => undefined, () => undefined)
  return result
}

/**
 * Case-insensitive path key used only to compare two workspaces.
 * @param value - an absolute directory path.
 * @returns the normalized comparison key.
 */
function pathKey(value) {
  return value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

/**
 * Derive a title for a record written before titles existed.
 *
 * The first non-empty line is the title, with a leading heading, bullet or
 * quote marker removed; longer lines are cut at 120 characters. A record with
 * no text keeps an empty title and is refused, because a card with no title
 * cannot be presented.
 *
 * @param source - the legacy `text` body, when the record has one.
 * @returns the derived title, possibly empty.
 */
function deriveTitle(source) {
  if (typeof source !== 'string') return ''
  const line = source.split(/\r?\n/).map(part => part.trim()).find(part => part !== '')
  if (line === undefined) return ''
  const stripped = line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^>\s?/, '')
    .trim()
  return stripped.length > 120 ? `${stripped.slice(0, 119)}…` : stripped
}

/**
 * Read and validate one stored record.
 *
 * Two fields arrived after the first release, so older files are read
 * leniently rather than refused:
 *
 * - `updatedAt` (1.1.0): a record without it uses `createdAt` as its
 *   modification time until the next write stores both.
 * - `title`/`summary`/`details` (2.0.0): a record written before the split has
 *   one `text` body, which becomes `details`; its title is derived from the
 *   first line and its summary starts empty. Every write stores the split.
 *
 * @param value - one raw element of the stored `items` array.
 * @param index - its position, used in failure messages.
 * @returns the record with exactly the fields this build reads.
 * @throws {Error} when the record is not this build's shape.
 */
function normalizeItem(value, index) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`todo board: ${DATA_FILE} item #${index} is not an object`)
  }
  const { id, workspacePath, workspaceLabel, title, summary, details, text, done, confirmed, createdAt, updatedAt } = value
  if (typeof id !== 'string' || id === '') {
    throw new Error(`todo board: ${DATA_FILE} item #${index} has no id`)
  }
  if (typeof workspacePath !== 'string' || workspacePath.trim() === '') {
    throw new Error(`todo board: item "${id}" has no workspace path`)
  }
  if (typeof workspaceLabel !== 'string' || workspaceLabel.trim() === '') {
    throw new Error(`todo board: item "${id}" has no workspace label`)
  }
  if (title !== undefined && typeof title !== 'string') {
    throw new Error(`todo board: item "${id}" has an invalid title`)
  }
  if (summary !== undefined && typeof summary !== 'string') {
    throw new Error(`todo board: item "${id}" has an invalid summary`)
  }
  if (details !== undefined && typeof details !== 'string') {
    throw new Error(`todo board: item "${id}" has invalid details`)
  }
  if (text !== undefined && typeof text !== 'string') {
    throw new Error(`todo board: item "${id}" has invalid text`)
  }
  const legacyText = typeof text === 'string' ? text : ''
  const resolvedDetails = typeof details === 'string' ? details : legacyText
  const resolvedTitle = typeof title === 'string' && title.trim() !== ''
    ? title.trim()
    : deriveTitle(resolvedDetails)
  if (resolvedTitle === '') {
    throw new Error(`todo board: item "${id}" has no title`)
  }
  if (typeof done !== 'boolean') {
    throw new Error(`todo board: item "${id}" has no completion flag`)
  }
  if (confirmed !== undefined && confirmed !== null && typeof confirmed !== 'boolean') {
    throw new Error(`todo board: item "${id}" has an invalid confirmation flag`)
  }
  if (typeof createdAt !== 'string' || createdAt === '') {
    throw new Error(`todo board: item "${id}" has no creation time`)
  }
  if (updatedAt !== undefined && updatedAt !== null
    && (typeof updatedAt !== 'string' || updatedAt === '')) {
    throw new Error(`todo board: item "${id}" has an invalid modification time`)
  }
  return {
    id,
    workspacePath: workspacePath.trim(),
    workspaceLabel: workspaceLabel.trim(),
    title: resolvedTitle,
    summary: typeof summary === 'string' ? summary.trim() : '',
    details: resolvedDetails,
    done,
    confirmed: confirmed === true,
    createdAt,
    updatedAt: typeof updatedAt === 'string' && updatedAt !== '' ? updatedAt : createdAt,
  }
}

/**
 * Parse a stored envelope, refusing anything this build does not understand
 * instead of replacing it with an empty notebook.
 * @param raw - the file's text.
 * @returns the stored records, in stored order.
 * @throws {Error} when the text is not JSON, is not this envelope, or holds an
 *   invalid record.
 */
function parseStore(raw) {
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (cause) {
    throw new Error(`todo board: ${DATA_FILE} is not valid JSON`, { cause })
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`todo board: ${DATA_FILE} is not a record set`)
  }
  if (parsed.version !== STORE_VERSION) {
    throw new Error(
      `todo board: ${DATA_FILE} has version ${String(parsed.version)}, `
      + `but this build reads version ${STORE_VERSION}`,
    )
  }
  if (!Array.isArray(parsed.items)) {
    throw new Error(`todo board: ${DATA_FILE} has no item list`)
  }
  return parsed.items.map(normalizeItem)
}

/**
 * Read the notebook from disk. A missing file is an empty notebook; anything
 * else that cannot be read is an error, never an empty result.
 * @returns the stored records, in stored order.
 */
async function readStore() {
  let raw
  try {
    raw = await readFile(DATA_FILE, 'utf8')
  } catch (cause) {
    if (cause.code === 'ENOENT') return []
    throw new Error(`todo board: cannot read ${DATA_FILE}`, { cause })
  }
  return parseStore(raw)
}

/**
 * Publish the whole notebook, replacing any previous file in one rename.
 * @param records - the complete list to store.
 */
async function persist(records) {
  await mkdir(dirname(DATA_FILE), { recursive: true })
  const temporary = `${DATA_FILE}.tmp`
  const body = `${JSON.stringify({ version: STORE_VERSION, items: records }, null, 2)}\n`
  await writeFile(temporary, body, 'utf8')
  await rename(temporary, DATA_FILE)
}

/**
 * Order records the way both surfaces read them: the most recently modified
 * first, so a card rises to the top of its section whenever it is touched.
 * ISO 8601 strings from `toISOString` sort chronologically; the id breaks ties
 * (two writes inside one millisecond) so the order is total and stable.
 * @param records - the records in stored order.
 * @returns a new array, sorted newest-modified first.
 */
function newestFirst(records) {
  return [...records].sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) return left.updatedAt < right.updatedAt ? 1 : -1
    return left.id < right.id ? -1 : 1
  })
}

/**
 * The value every operation returns and the tool's canonical output.
 * @param records - the complete stored list.
 * @param query - optional workspace filter, matched against path or label.
 * @returns the file path and the matching records, newest-modified first.
 */
function snapshot(records, query) {
  const selected = query === undefined
    ? records
    : records.filter(item => matchesWorkspace(item, query))
  return { file: DATA_FILE, items: newestFirst(selected).map(item => ({ ...item })) }
}

/**
 * Whether one record belongs to the workspace a query names.
 * @param item - a stored record.
 * @param query - an absolute path, a path fragment, or a workspace label.
 * @returns true on an exact path match, or a case-insensitive containment.
 */
function matchesWorkspace(item, query) {
  const needle = query.trim().toLowerCase()
  if (needle === '') return false
  const key = pathKey(item.workspacePath)
  if (key === pathKey(query)) return true
  return key.includes(needle) || item.workspaceLabel.toLowerCase().includes(needle)
}

/**
 * Require one non-empty string argument.
 * @param value - candidate value.
 * @param field - argument name for the failure message.
 * @returns the trimmed value.
 * @throws {Error} when the value is not a non-empty string.
 */
function requireText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`todo board: "${field}" must be a non-empty string`)
  }
  return value.trim()
}

/**
 * Read one optional string argument.
 * @param value - candidate value.
 * @param field - argument name for the failure message.
 * @returns the trimmed value, or undefined when absent or blank.
 * @throws {Error} when the value is present but not a string.
 */
function optionalText(value, field) {
  if (value === undefined || value === null) return undefined
  if (typeof value !== 'string') throw new Error(`todo board: "${field}" must be a string`)
  const trimmed = value.trim()
  return trimmed === '' ? undefined : trimmed
}

/**
 * Narrow an operation payload to a plain object.
 * @param payload - the wire or tool argument value.
 * @returns the payload, or an empty object when it is absent.
 * @throws {Error} when the payload is present but not an object.
 */
function asRecord(payload) {
  if (payload === undefined || payload === null) return {}
  if (typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('todo board: the request payload must be an object')
  }
  return payload
}

/**
 * Run one notebook operation.
 * @param payload - operation arguments; `action` selects the operation.
 * @returns the notebook snapshot after the operation.
 * @throws {Error} on an unknown action, invalid arguments, or a missing id.
 */
async function dispatch(payload) {
  const input = asRecord(payload)
  const action = requireText(input.action, 'action')

  if (action === 'list') {
    const query = optionalText(input.workspace, 'workspace')
    return serialized(async () => snapshot(await readStore(), query))
  }

  if (action === 'add') {
    const title = requireText(input.title, 'title')
    const summary = optionalText(input.summary, 'summary') ?? ''
    const details = optionalText(input.details, 'details') ?? ''
    const workspacePath = requireText(input.workspace, 'workspace')
    const label = optionalText(input.label, 'label') ?? basename(workspacePath)
    return serialized(async () => {
      const records = await readStore()
      const now = new Date().toISOString()
      records.push({
        id: randomUUID(),
        workspacePath,
        workspaceLabel: label,
        title,
        summary,
        details,
        done: false,
        confirmed: false,
        createdAt: now,
        updatedAt: now,
      })
      await persist(records)
      return snapshot(records)
    })
  }

  if (action === 'update') {
    const id = requireText(input.id, 'id')
    const title = optionalText(input.title, 'title')
    // An empty string clears these two; omitting them leaves them alone.
    const summary = input.summary === undefined ? undefined : (optionalText(input.summary, 'summary') ?? '')
    const details = input.details === undefined ? undefined : (optionalText(input.details, 'details') ?? '')
    const workspacePath = optionalText(input.workspace, 'workspace')
    const label = optionalText(input.label, 'label')
    if (input.done !== undefined && typeof input.done !== 'boolean') {
      throw new Error('todo board: "done" must be a boolean')
    }
    if (input.confirmed !== undefined && typeof input.confirmed !== 'boolean') {
      throw new Error('todo board: "confirmed" must be a boolean')
    }
    if (title === undefined && summary === undefined && details === undefined
      && workspacePath === undefined && label === undefined
      && input.done === undefined && input.confirmed === undefined) {
      throw new Error(
        'todo board: "update" needs at least one of title, summary, details, done, confirmed, workspace, label',
      )
    }
    return serialized(async () => {
      const records = await readStore()
      const item = records.find(candidate => candidate.id === id)
      if (item === undefined) throw new Error(`todo board: no todo with id "${id}"`)
      if (title !== undefined) item.title = title
      if (summary !== undefined) item.summary = summary
      if (details !== undefined) item.details = details
      if (input.done !== undefined) item.done = input.done
      if (input.confirmed !== undefined) item.confirmed = input.confirmed
      if (workspacePath !== undefined) {
        item.workspacePath = workspacePath
        item.workspaceLabel = label ?? basename(workspacePath)
      } else if (label !== undefined) {
        item.workspaceLabel = label
      }
      item.updatedAt = new Date().toISOString()
      await persist(records)
      return snapshot(records)
    })
  }

  if (action === 'remove') {
    const id = requireText(input.id, 'id')
    return serialized(async () => {
      const records = await readStore()
      const index = records.findIndex(candidate => candidate.id === id)
      if (index === -1) throw new Error(`todo board: no todo with id "${id}"`)
      records.splice(index, 1)
      await persist(records)
      return snapshot(records)
    })
  }

  throw new Error(`todo board: unknown action "${String(action)}"; use list, add, update or remove`)
}

/** Argument schema the model sees. */
const TOOL_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: {
      type: 'string',
      enum: ['list', 'add', 'update', 'remove'],
      description: 'list reads the notebook; add appends one todo; update changes its title, summary, details, completion or confirmation; remove deletes one todo.',
    },
    workspace: {
      type: 'string',
      description: 'For add: the owning workspace directory (an absolute path, usually the session working directory). For list: an optional filter naming a path or workspace label.',
    },
    label: {
      type: 'string',
      description: 'Optional display name for the workspace when adding or moving a todo; defaults to the directory name.',
    },
    title: {
      type: 'string',
      description: 'The one-line title shown on the card. Required by add; replacing it updates the card heading.',
    },
    summary: {
      type: 'string',
      description: 'One or two plain-text sentences shown under the title. Optional; an empty string clears it.',
    },
    details: {
      type: 'string',
      description: 'The Markdown body shown in the card’s detail dialog. Optional; an empty string clears it.',
    },
    done: {
      type: 'boolean',
      description: 'The agent-side completion flag: true when your work on this todo is finished. Independent of the user’s confirmation.',
    },
    confirmed: {
      type: 'boolean',
      description: 'The user’s confirmation flag. Flip it when the user asks: true when they accept the finished todo, false to withdraw that acceptance. It is independent of `done`.',
    },
    id: {
      type: 'string',
      description: 'The todo id, taken from a previous list result. Required by update and remove.',
    },
  },
  required: ['action'],
}

/** Canonical output schema: the notebook snapshot every operation returns. */
const TOOL_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    file: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          workspacePath: { type: 'string' },
          workspaceLabel: { type: 'string' },
          title: { type: 'string' },
          summary: { type: 'string' },
          details: { type: 'string' },
          done: { type: 'boolean' },
          confirmed: { type: 'boolean' },
          createdAt: { type: 'string' },
          updatedAt: { type: 'string' },
        },
        required: [
          'id', 'workspacePath', 'workspaceLabel', 'title', 'summary', 'details',
          'done', 'confirmed', 'createdAt', 'updatedAt',
        ],
      },
    },
  },
  required: ['file', 'items'],
}

/**
 * Render one snapshot for the model.
 * @param value - the validated canonical output.
 * @returns one text block listing every todo, newest-modified first, with its
 *   title, summary, details, id, modification time and confirmation state.
 */
function renderSnapshot(value) {
  const open = value.items.filter(item => !item.done).length
  const head = `${value.items.length} todo(s), ${open} open — ${value.file}`
  if (value.items.length === 0) return [{ type: 'text', text: head }]
  const lines = value.items.map((item) => {
    const line = `- [${item.done ? 'x' : ' '}] ${item.title} — ${item.workspaceLabel} (${item.workspacePath}) id=${item.id} updated=${item.updatedAt} confirmed=${item.confirmed ? 'yes' : 'no'}`
    const summary = item.summary === '' ? '' : `\n  summary: ${item.summary}`
    const details = item.details === ''
      ? ''
      : `\n${item.details.split('\n').map(part => `  ${part}`).join('\n')}`
    return `${line}${summary}${details}`
  })
  return [{ type: 'text', text: `${head}\n${lines.join('\n')}` }]
}

/** Services this bundle waits for before activating. */
export const inject = ['tools', 'connection']

/**
 * Answer the browser half's request: one `client-request` envelope in, one
 * `server-response` envelope out, with the same correlation id.
 * @param request - the Fetch request the Connection route admitted.
 * @returns the envelope response; a failure is a result, not an HTTP error, so
 *   the page can show the reason.
 */
async function serveBoard(request) {
  const body = await request.json()
  if (typeof body !== 'object' || body === null || body.type !== 'client-request'
    || typeof body.rpcId !== 'string' || typeof body.method !== 'string') {
    return envelope('invalid-request', {
      ok: false,
      error: { code: 'todo-board/bad-request', message: 'invalid client-request envelope', details: {} },
    })
  }
  if (body.method !== BOARD_ENDPOINT) {
    return envelope(body.rpcId, {
      ok: false,
      error: { code: 'todo-board/bad-request', message: `method must be "${BOARD_ENDPOINT}"`, details: {} },
    })
  }
  try {
    return envelope(body.rpcId, { ok: true, value: await dispatch(body.payload) })
  } catch (error) {
    return envelope(body.rpcId, {
      ok: false,
      error: {
        code: 'todo-board/failed',
        message: error instanceof Error ? error.message : String(error),
        details: {},
      },
    })
  }
}

/**
 * Wrap one result in the Connection response envelope.
 * @param rpcId - the correlation id from the request.
 * @param result - the success or failure result.
 * @returns a JSON response carrying that envelope.
 */
function envelope(rpcId, result) {
  return Response.json({ type: 'server-response', rpcId, result })
}

/**
 * Register the agent tool and the page's data route on the same store.
 * @param ctx - Host plugin context.
 */
export function apply(ctx) {
  ctx.tools.register({
    name: TOOL_NAME,
    description: 'Read or change the shared workspace todo notebook that the user sees in the "跨工作区待办本" page. '
      + 'One notebook is shared by every workspace; each todo carries the workspace directory it belongs to, '
      + 'a title, a short summary and Markdown details. `done` is your completion flag and `confirmed` is the user’s acceptance, '
      + 'which the board toggles with its Confirm control and which you may flip when the user asks you to. '
      + 'Call list first to get ids, then add, update (title, summary, details, done, confirmed, workspace or label), or remove. '
      + 'Every result lists todos newest-modified first and carries each todo\'s updatedAt and confirmed flag. '
      + 'Changes appear in the page within a few seconds and need no reload.',
    parameters: TOOL_PARAMETERS,
    output: {
      schema: TOOL_OUTPUT_SCHEMA,
      render: (_args, value) => renderSnapshot(value),
    },
    execute: args => dispatch(args),
  })

  // An exact Fetch route on the shared `/api` channel: carrier-neutral (works
  // for the served page and for a shell that dispatches the shared handler),
  // admitted by Connection before this function runs, and owner-only.
  ctx.inject(['connection'], (scope) => {
    scope.effect(() => scope.connection.fetch.register({
      path: BOARD_ROUTE,
      methods: ['POST'],
      requestBody: 'buffered',
      fetch: serveBoard,
    }), `todo-board: ${BOARD_ROUTE}`)
  })
}
