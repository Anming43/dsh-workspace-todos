/**
 * Workspace to-do notebook, browser half.
 *
 * Two registrations, both owned by this plugin's context and released together
 * when it unloads:
 *
 *   1. `sidebar.panellist` — the left-sidebar launcher. The sidebar owns the
 *      button, its label and its selected state; this entry supplies only the
 *      glyph and the id shared with the page below.
 *   2. `main` under the same id — the full page the launcher selects. The
 *      centre column shows it instead of the Conversation, and `ctx.layout`
 *      brings the Conversation back.
 *
 * Data scope. The page owns no store of its own: every read and write goes
 * through the Host's exact Fetch route `/api/workspace-todos` (called through
 * `ctx.connection.rpc`), which reads and writes `<DSH_HOME>/workspace-todos.json`.
 * The agent's `workspace_todos` tool writes the same file, so a todo added in
 * one workspace's session is what this page shows, and a todo ticked here is
 * what the agent reads. The page re-reads the file on a short interval, so
 * changes made from a conversation appear without a reload.
 *
 * Presentation. Each todo is a card: a small head with its completion control
 * and its actions, then the body. The body is Markdown — paragraphs, headings,
 * lists, quotes, fenced code, emphasis, inline code and links — parsed here into
 * React elements, so nothing is injected as HTML.
 */

window.__ModuleLoader__.load({
  id: 'dsh-workspace-todos',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /** Dictionary namespace owned by this plugin. */
    const NS = 'todoBoard'

    /** The id shared by the sidebar launcher and the page it opens. */
    const PANEL_ID = 'workspace-todos'

    /** The right-Sidebar tab type: this implementation's identity and its kind. */
    const TAB_ID = 'dsh-workspace-todos/board'
    const TAB_KIND = 'workspaceTodos'

    /** The Connection channel and endpoint the notebook lives behind. */
    const BOARD_CHANNEL = '/api'
    const BOARD_ENDPOINT = 'workspace-todos'

    /** How often the page re-reads the notebook while it is open. */
    const REFRESH_MS = 3000

    /**
     * The retired browser-storage key. It is read once, to move entries written
     * by the first version of this page into the Host file, and then removed.
     */
    const LEGACY_KEY = 'dsh.global-todo-board.v1'

    /** Element id of the stylesheet this plugin installs while it is loaded. */
    const STYLE_ID = 'dsh-todo-board-styles'

    /** Where the launcher row sits among global panels (Plugins is order 0). */
    const LAUNCHER_ORDER = 100

    /** English copy; every other locale falls back to it. */
    const en = {
      'panel': 'Workspace todos',
      'panel.guide': 'The todos of this session’s workspace',
      'panel.noWorkspace': 'This session has no workspace yet.',
      'panel.addPlaceholder': 'Add a card for this workspace — Markdown works',
      'page.title': 'Workspace todos',
      'page.subtitle': 'One notebook for every workspace. Each card belongs to a workspace and its text is Markdown; an agent in any workspace reads and writes the same file.',
      'page.back': 'Back to conversation',
      'page.loading': 'Reading workspaces…',
      'page.loadingBoard': 'Reading the notebook…',
      'page.empty': 'Nothing here yet. Add the first card above.',
      'add.placeholder': 'What needs doing? Markdown works — **bold**, `code`, - lists, [link](url)',
      'add.workspace': 'Workspace',
      'add.submit': 'Add',
      'add.hint': 'Ctrl+Enter adds',
      'add.noWorkspace': 'No workspace yet',
      'group.open': '{count} open',
      'page.allDone': 'Nothing open. Completed cards wait in the area below.',
      'section.done': 'Completed · {count}',
      'section.toggle': 'Show or hide completed todos',
      'card.updated': 'Updated {time}',
      'card.id': 'Todo id {id}',
      'execute.label': 'Execute todo',
      'explain.label': 'Explain todo',
      'execute.aria': 'Execute “{text}”',
      'explain.aria': 'Explain “{text}”',
      'execute.sent': 'Execution requested',
      'explain.sent': 'Explanation requested',
      'send.disabled': 'Open a conversation first',
      'execute.prompt': 'Execute this todo from the shared workspace todo notebook.\n\n'
        + '- Todo: {short} (`{id}`)\n'
        + '- Workspace: {workspace}\n'
        + '- Status: {status}\n'
        + '- Last modified: {time}\n\n'
        + '---\n\n{text}\n\n'
        + 'When it is finished, close it with the workspace_todos tool: update with this id and done=true.',
      'explain.prompt': 'Explain this todo from the shared workspace todo notebook; do not change anything yet.\n\n'
        + '- Todo: {short} (`{id}`)\n'
        + '- Workspace: {workspace}\n'
        + '- Status: {status}\n'
        + '- Last modified: {time}\n\n'
        + '---\n\n{text}\n\n'
        + 'Say what it asks for, why it matters, which files or steps it touches, and what is unclear. '
        + 'Leave the todo open unless I ask you to do it.',
      'card.done': 'Done',
      'card.open': 'Open',
      'row.toggle': 'Toggle “{text}”',
      'row.edit': 'Edit “{text}”',
      'row.delete': 'Delete “{text}”',
      'edit.title': 'Edit todo',
      'edit.maximize': 'Maximize',
      'edit.restore': 'Restore size',
      'edit.close': 'Close editor',
      'edit.label': 'Todo text (Markdown)',
      'edit.save': 'Save',
      'edit.cancel': 'Cancel',
      'edit.hint': 'Ctrl+Enter saves, Esc cancels',
    }

    /** Chinese copy. */
    const zh = {
      'panel': '跨工作区待办本',
      'panel.guide': '当前会话所属工作区的待办',
      'panel.noWorkspace': '这个会话还没有所属工作区。',
      'panel.addPlaceholder': '给这个工作区加一条，支持 Markdown',
      'page.title': '跨工作区待办本',
      'page.subtitle': '所有工作区共用一份清单。每张卡片属于一个工作区，内容支持基础 Markdown；任意工作区的智能体读写的都是同一个文件。',
      'page.back': '返回对话',
      'page.loading': '正在读取工作区…',
      'page.loadingBoard': '正在读取待办本…',
      'page.empty': '还没有待办，在上方添加第一张卡片。',
      'add.placeholder': '要做什么？支持 Markdown：**粗体**、`代码`、- 列表、[链接](url)',
      'add.workspace': '所属工作区',
      'add.submit': '添加',
      'add.hint': 'Ctrl+Enter 添加',
      'add.noWorkspace': '暂无工作区',
      'group.open': '{count} 条未完成',
      'page.allDone': '没有未完成的待办，已完成的收纳在下方。',
      'section.done': '已完成 · {count}',
      'section.toggle': '展开或收起已完成待办',
      'card.updated': '修改于 {time}',
      'card.id': '待办 ID {id}',
      'execute.label': '执行待办',
      'explain.label': '解释待办',
      'execute.aria': '执行待办「{text}」',
      'explain.aria': '解释待办「{text}」',
      'execute.sent': '已发送执行请求',
      'explain.sent': '已发送解释请求',
      'send.disabled': '先打开一个会话',
      'execute.prompt': '执行这条待办（来自跨工作区待办本）：\n\n'
        + '- 待办：{short}（`{id}`）\n'
        + '- 工作区：{workspace}\n'
        + '- 状态：{status}\n'
        + '- 最后修改：{time}\n\n'
        + '---\n\n{text}\n\n'
        + '完成后用 workspace_todos 工具标记完成：update，带上这条 id 和 done=true。',
      'explain.prompt': '解释这条待办（来自跨工作区待办本），先不要动手改动：\n\n'
        + '- 待办：{short}（`{id}`）\n'
        + '- 工作区：{workspace}\n'
        + '- 状态：{status}\n'
        + '- 最后修改：{time}\n\n'
        + '---\n\n{text}\n\n'
        + '说明它要做什么、为什么、涉及哪些文件或步骤、有哪些不确定点；除非我明确要求，否则保持未完成。',
      'card.done': '已完成',
      'card.open': '未完成',
      'row.toggle': '切换「{text}」的完成状态',
      'row.edit': '编辑「{text}」',
      'row.delete': '删除「{text}」',
      'edit.title': '编辑待办',
      'edit.maximize': '最大化',
      'edit.restore': '还原大小',
      'edit.close': '关闭编辑器',
      'edit.label': '待办内容（Markdown）',
      'edit.save': '保存',
      'edit.cancel': '取消',
      'edit.hint': 'Ctrl+Enter 保存，Esc 取消',
    }

    // --------------------------------------------------------------- Host RPC

    /**
     * Call one notebook operation on the Host.
     * @param ctx - the browser plugin context, providing `connection`.
     * @param payload - the operation, with its `action` and arguments.
     * @returns the Host's snapshot: `{ file, items }`.
     * @throws {Error} when the transport fails or the Host refuses the call.
     */
    async function callBoard(ctx, payload) {
      const result = await ctx.connection.rpc.call(BOARD_CHANNEL, BOARD_ENDPOINT, payload)
      if (!result.ok) throw new Error(`todo board: ${result.error.message}`)
      return result.value
    }

    /**
     * Report a failure as display text.
     * @param cause - the rejection value.
     * @returns a readable message.
     */
    function describeError(cause) {
      return cause instanceof Error ? cause.message : String(cause)
    }

    /** Local reference source this page counts under while it sends a prompt. */
    const SESSION_SOURCE = 'workspace-todos'

    /**
     * Send one todo into a Session as the user's own prompt.
     *
     * The message goes through the same `Session.prompt` call the composer
     * uses, so it is an ordinary durable user message: the conversation shows
     * it, the agent runs it, and a cold Session is resumed by the Host.
     *
     * @param ctx - the browser plugin context, providing `sessions`.
     * @param sessionId - the Session to send into.
     * @param text - the prompt text.
     * @returns completion once the Host accepted the prompt.
     * @throws {Error} when the Session cannot be opened or the prompt is refused.
     */
    async function sendToSession(ctx, sessionId, text) {
      await ctx.sessions.using(sessionId, { source: SESSION_SOURCE }, async (reference) => {
        const result = await reference.binding.session.prompt([{ type: 'text', text }], 'queue')
        if (!result.ok) throw new Error(`todo board: ${result.error.message}`)
      })
    }

    // -------------------------------------------------------------- migration

    /**
     * Move entries written by the first version of this page into the notebook.
     *
     * That version kept one list in browser storage; the Host file replaced it.
     * The old list is only read when the Host notebook is still empty, each
     * entry is added through the same Host call the page uses, and the old key
     * is removed only after every entry landed. A malformed old value throws
     * instead of being dropped.
     *
     * @param board - the notebook's Host calls.
     * @param workspaces - live workspace rows, used to resolve old ids to paths.
     */
    async function migrateLegacy(board, workspaces) {
      const raw = window.localStorage.getItem(LEGACY_KEY)
      if (raw === null || raw === '') return
      const parsed = JSON.parse(raw)
      if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.items)) {
        throw new Error(`todo board: the old browser-stored list at "${LEGACY_KEY}" is not readable`)
      }
      const known = new Set()
      for (const entry of parsed.items) {
        if (typeof entry !== 'object' || entry === null || typeof entry.text !== 'string') {
          throw new Error(`todo board: the old browser-stored list at "${LEGACY_KEY}" has an unreadable entry`)
        }
        const live = workspaces.find(workspace => workspace.workspaceId === entry.workspaceId)
        const workspacePath = live === undefined
          ? (typeof entry.workspaceLabel === 'string' && entry.workspaceLabel !== ''
            ? entry.workspaceLabel
            : 'unknown workspace')
          : live.path
        const added = await board.add({
          text: entry.text,
          workspace: workspacePath,
          label: typeof entry.workspaceLabel === 'string' ? entry.workspaceLabel : undefined,
        })
        // The Host answers newest-modified first, so the card just added need
        // not be last; it is the one whose id was not in the previous answer.
        const created = added.items.find(item => !known.has(item.id))
        if (created === undefined) {
          throw new Error(`todo board: the Host did not return the card it just added for "${entry.text}"`)
        }
        known.add(created.id)
        if (entry.done === true) {
          await board.update({ id: created.id, done: true })
        }
      }
      window.localStorage.removeItem(LEGACY_KEY)
    }

    // ---------------------------------------------------------------- markdown

    /** Inline rules in priority order; the earliest match in the text wins. */
    const INLINE_RULES = [
      { kind: 'code', regex: /`([^`\n]+)`/ },
      { kind: 'link', regex: /\[([^\]\n]+)\]\(([^)\s]+)\)/ },
      { kind: 'bold', regex: /\*\*(?=\S)([\s\S]*?\S)\*\*/ },
      { kind: 'strike', regex: /~~(?=\S)([\s\S]*?\S)~~/ },
      { kind: 'italic', regex: /(?<![*_~])\*(?=\S)([^*\n]*?\S)\*/ },
      { kind: 'italic', regex: /(?<![A-Za-z0-9_])_(?=\S)([^_\n]*?\S)_(?![A-Za-z0-9_])/ },
    ]

    /**
     * Split one line of text into inline tokens.
     *
     * Emphasis is parsed recursively, so `**a *b* c**` nests. Backslash and
     * unmatched markers stay literal text.
     *
     * @param text - inline Markdown.
     * @returns tokens: `text`, `code`, `link`, `bold`, `italic`, `strike`.
     */
    function parseInline(text) {
      const tokens = []
      let rest = text
      let plain = ''
      const flush = () => {
        if (plain === '') return
        tokens.push({ kind: 'text', value: plain })
        plain = ''
      }
      while (rest !== '') {
        let best = null
        for (const rule of INLINE_RULES) {
          const match = rule.regex.exec(rest)
          if (match === null) continue
          if (best === null || match.index < best.index) best = { index: match.index, match, kind: rule.kind }
        }
        if (best === null) {
          plain += rest
          break
        }
        plain += rest.slice(0, best.index)
        flush()
        const [, first, second] = best.match
        if (best.kind === 'code') tokens.push({ kind: 'code', value: first })
        else if (best.kind === 'link') tokens.push({ kind: 'link', text: first, href: second })
        else tokens.push({ kind: best.kind, children: parseInline(first) })
        rest = rest.slice(best.index + best.match[0].length)
      }
      flush()
      return tokens
    }

    /**
     * Whether a link target may become an anchor.
     * @param href - the raw Markdown target.
     * @returns true for http(s) and mailto targets only.
     */
    function isSafeHref(href) {
      return /^(https?:|mailto:)/i.test(href)
    }

    /**
     * Whether a line starts a block that ends a paragraph.
     * @param line - one source line.
     * @returns true for headings, fences, lists, quotes and rules.
     */
    function startsBlock(line) {
      return /^\s*(#{1,6}\s|```|[-*+]\s|\d+[.)]\s|>\s?|-{3,}\s*$)/.test(line)
    }

    /**
     * Parse the card body.
     * @param text - Markdown source.
     * @returns blocks: `paragraph`, `heading`, `ul`, `ol`, `quote`, `code`, `hr`.
     */
    function parseBlocks(text) {
      const lines = text.replace(/\r\n?/g, '\n').split('\n')
      const blocks = []
      let index = 0
      while (index < lines.length) {
        const line = lines[index]
        if (line.trim() === '') {
          index++
          continue
        }
        const fence = /^```\s*([\w+-]*)\s*$/.exec(line)
        if (fence !== null) {
          const body = []
          index++
          while (index < lines.length && !/^```\s*$/.test(lines[index])) {
            body.push(lines[index])
            index++
          }
          index++
          blocks.push({ kind: 'code', lang: fence[1], text: body.join('\n') })
          continue
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line)
        if (heading !== null) {
          blocks.push({ kind: 'heading', level: heading[1].length, inlines: parseInline(heading[2].trim()) })
          index++
          continue
        }
        if (/^\s*[-*+]\s+/.test(line)) {
          const items = []
          while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
            items.push(parseInline(lines[index].replace(/^\s*[-*+]\s+/, '')))
            index++
          }
          blocks.push({ kind: 'ul', items })
          continue
        }
        if (/^\s*\d+[.)]\s+/.test(line)) {
          const items = []
          while (index < lines.length && /^\s*\d+[.)]\s+/.test(lines[index])) {
            items.push(parseInline(lines[index].replace(/^\s*\d+[.)]\s+/, '')))
            index++
          }
          blocks.push({ kind: 'ol', items })
          continue
        }
        if (/^>\s?/.test(line)) {
          const quoted = []
          while (index < lines.length && /^>\s?/.test(lines[index])) {
            quoted.push(lines[index].replace(/^>\s?/, ''))
            index++
          }
          blocks.push({ kind: 'quote', inlines: parseInline(quoted.join('\n')) })
          continue
        }
        if (/^-{3,}\s*$/.test(line.trim())) {
          blocks.push({ kind: 'hr' })
          index++
          continue
        }
        const paragraph = [line]
        index++
        while (index < lines.length && lines[index].trim() !== '' && !startsBlock(lines[index])) {
          paragraph.push(lines[index])
          index++
        }
        blocks.push({ kind: 'paragraph', inlines: parseInline(paragraph.join('\n')) })
      }
      return blocks
    }

    /**
     * Render inline tokens to React nodes.
     * @param tokens - output of {@link parseInline}.
     * @param keyPrefix - stable key prefix for the child list.
     * @returns the nodes.
     */
    function renderInline(tokens, keyPrefix) {
      return tokens.map((token, index) => {
        const key = `${keyPrefix}-${index}`
        if (token.kind === 'text') return token.value
        if (token.kind === 'code') return h('code', { key, className: 'dsh-todo-mdCode' }, token.value)
        if (token.kind === 'link') {
          if (!isSafeHref(token.href)) return h('span', { key }, token.text)
          return h('a', {
            key,
            className: 'dsh-todo-mdLink',
            href: token.href,
            target: '_blank',
            rel: 'noreferrer noopener',
          }, token.text)
        }
        const tag = token.kind === 'bold' ? 'strong' : token.kind === 'italic' ? 'em' : 'del'
        return h(tag, { key }, renderInline(token.children, key))
      })
    }

    /**
     * Render parsed blocks to React nodes.
     * @param blocks - output of {@link parseBlocks}.
     * @returns the nodes; an empty body renders nothing.
     */
    function renderMarkdown(blocks) {
      if (blocks.length === 0) return null
      return blocks.map((block, index) => {
        const key = `md-${index}`
        if (block.kind === 'paragraph') {
          return h('p', { key, className: 'dsh-todo-mdP' }, renderInline(block.inlines, key))
        }
        if (block.kind === 'heading') {
          const level = Math.min(block.level + 2, 6)
          return h(`h${level}`, { key, className: 'dsh-todo-mdH' }, renderInline(block.inlines, key))
        }
        if (block.kind === 'ul' || block.kind === 'ol') {
          return h(block.kind === 'ul' ? 'ul' : 'ol', { key, className: 'dsh-todo-mdList' },
            block.items.map((item, itemIndex) => h('li', { key: `${key}-${itemIndex}` }, renderInline(item, `${key}-${itemIndex}`))))
        }
        if (block.kind === 'quote') {
          return h('blockquote', { key, className: 'dsh-todo-mdQuote' }, renderInline(block.inlines, key))
        }
        if (block.kind === 'code') {
          return h('pre', { key, className: 'dsh-todo-mdPre' }, h('code', null, block.text))
        }
        return h('hr', { key, className: 'dsh-todo-mdHr' })
      })
    }

    // ------------------------------------------------------------- pure parts

    /**
     * Case-insensitive path key used only to compare two workspaces.
     * @param value - an absolute directory path.
     * @returns the normalized comparison key.
     */
    function pathKey(value) {
      return value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
    }

    /**
     * The user-visible name of a live workspace.
     * @param workspace - a WorkspaceView from the workspace service.
     * @returns its title, or its directory when the title is blank.
     */
    function workspaceLabel(workspace) {
      const title = typeof workspace.title === 'string' ? workspace.title.trim() : ''
      return title === '' ? workspace.path : workspace.title
    }

    /**
     * Show a stored ISO timestamp as local `YYYY-MM-DD HH:mm`.
     *
     * The format is fixed rather than read from the browser's locale, so a
     * screenshot and the stored value always agree on the order of the parts.
     *
     * @param value - the stored timestamp.
     * @returns the local time, or the raw value when it does not parse.
     */
    function formatStamp(value) {
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return value
      const pad = number => String(number).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} `
        + `${pad(date.getHours())}:${pad(date.getMinutes())}`
    }

    /**
     * The short form of a todo id shown on the card: its first eight hex
     * digits. It is derived, not stored, so every record has one — including
     * the ones written before the badge existed — and it never changes.
     *
     * @param item - a stored record.
     * @returns the badge text, without the leading `#`.
     */
    function shortId(item) {
      return item.id.replace(/-/g, '').slice(0, 8)
    }

    /**
     * Compose the message a card sends into a conversation.
     * @param t - the bound translator.
     * @param item - the card being sent.
     * @param kind - `execute` asks for the work, `explain` asks what it means.
     * @returns Markdown naming the todo, its id, and what the agent should do.
     */
    function sendPrompt(t, item, kind) {
      return t(kind === 'explain' ? 'explain.prompt' : 'execute.prompt', {
        short: shortId(item),
        id: item.id,
        workspace: item.workspacePath,
        status: item.done ? t('card.done') : t('card.open'),
        time: formatStamp(item.updatedAt),
        text: item.text,
      })
    }

    /**
     * Group notebook records by the workspace path they carry.
     *
     * Groups follow the workspace service's own order, so the page reads in the
     * same sequence as the sidebar. A group whose workspace no longer exists
     * still shows, under the label captured when its first card was added, and
     * sorts after every live workspace.
     *
     * @param items - the stored list, in stored order.
     * @param workspaces - live workspace rows.
     * @returns one group per workspace path that owns at least one item.
     */
    function groupItems(items, workspaces) {
      const live = new Map()
      const position = new Map()
      workspaces.forEach((workspace, index) => {
        live.set(pathKey(workspace.path), workspace)
        position.set(pathKey(workspace.path), index)
      })

      const groups = new Map()
      for (const item of items) {
        const key = pathKey(item.workspacePath)
        let group = groups.get(key)
        if (group === undefined) {
          const workspace = live.get(key)
          group = {
            key,
            title: workspace === undefined ? item.workspaceLabel : workspaceLabel(workspace),
            position: position.has(key) ? position.get(key) : Number.MAX_SAFE_INTEGER,
            items: [],
          }
          groups.set(key, group)
        }
        group.items.push(item)
      }

      const ordered = Array.from(groups.values())
      ordered.sort((left, right) => (
        left.position === right.position
          ? left.title.localeCompare(right.title)
          : left.position - right.position
      ))
      return ordered
    }

    // ------------------------------------------------------- shared state

    /**
     * Read the notebook from the Host and re-read it while mounted, so a change
     * the agent made appears without a reload.
     *
     * @param board - the Host call object.
     * @returns the records (`null` until the first read), the last failure, the
     *   adopt and report callbacks, and a manual refresh.
     */
    function useBoardItems(board) {
      const [items, setItems] = React.useState(null)
      const [error, setError] = React.useState(null)

      const adopt = React.useCallback((value) => {
        setItems(value.items)
        setError(null)
      }, [])
      const report = React.useCallback((cause) => {
        setError(describeError(cause))
      }, [])

      const refresh = React.useCallback(async () => {
        try {
          const value = await board.list()
          adopt(value)
          return value
        } catch (cause) {
          report(cause)
          return undefined
        }
      }, [board, adopt, report])

      React.useEffect(() => {
        let cancelled = false
        const tick = async () => {
          try {
            const value = await board.list()
            if (!cancelled) adopt(value)
          } catch (cause) {
            if (!cancelled) report(cause)
          }
        }
        void tick()
        const timer = window.setInterval(() => { void tick() }, REFRESH_MS)
        return () => {
          cancelled = true
          window.clearInterval(timer)
        }
      }, [board, adopt, report])

      return { items, error, adopt, report, refresh }
    }

    /**
     * The per-card editing and mutation operations both surfaces share.
     * @param props - `board`, the current records, and the adopt/report callbacks.
     * @returns the editing state, its setter, and the operations a card calls.
     */
    function useTodoEditing(props) {
      const { board, items, adopt, report } = props
      const [editingId, setEditingId] = React.useState(null)
      const [editingText, setEditingText] = React.useState('')

      const start = (item) => {
        setEditingId(item.id)
        setEditingText(item.text)
      }
      const cancel = () => {
        setEditingId(null)
        setEditingText('')
      }

      const toggle = async (id) => {
        const item = (items ?? []).find(candidate => candidate.id === id)
        if (item === undefined) return
        try {
          adopt(await board.update({ id, done: !item.done }))
        } catch (cause) {
          report(cause)
        }
      }

      const remove = async (id) => {
        try {
          adopt(await board.remove(id))
          if (editingId === id) cancel()
        } catch (cause) {
          report(cause)
        }
      }

      const save = async () => {
        const text = editingText.trim()
        if (text === '' || editingId === null) return
        try {
          adopt(await board.update({ id: editingId, text }))
          cancel()
        } catch (cause) {
          report(cause)
        }
      }

      return { editingId, editingText, setEditingText, start, cancel, save, toggle, remove }
    }

    /**
     * One card per record, wired to an editor.
     * @param props - `t`, the records, the editor, the list's class name, and
     *   whether each card names its workspace.
     * @returns the list element.
     */
    function TodoCardList(props) {
      const { t, items, editor, className, showWorkspace, onSend, canSend, onSendError } = props
      return h('ul', { className },
        items.map(item => h(TodoCard, {
          key: item.id,
          t,
          item,
          onStartEdit: editor.start,
          onToggle: editor.toggle,
          onDelete: editor.remove,
          showWorkspace,
          onSend,
          canSend,
          onSendError,
        })))
    }

    /**
     * The folded area that holds completed cards.
     *
     * It starts collapsed on every mount, so open cards stay at the top; its
     * header is a button that shows or hides the cards underneath. With no
     * completed record the section renders nothing at all.
     *
     * @param props - `t`, the completed records, the shared editor, the list's
     *   class name, and whether each card names its workspace.
     * @returns the section element, or null when no record is completed.
     */
    function CompletedSection(props) {
      const { t, items, editor, className, showWorkspace, onSend, canSend, onSendError } = props
      const [open, setOpen] = React.useState(false)
      if (items.length === 0) return null
      return h('section', { className: 'dsh-todo-done' },
        h('button', {
          type: 'button',
          className: 'dsh-todo-doneHead',
          'aria-expanded': open,
          'aria-label': t('section.toggle'),
          onClick: () => { setOpen(value => !value) },
        },
        h(ChevronGlyph, { open }),
        h('span', { className: 'dsh-todo-doneTitle' }, t('section.done', { count: items.length }))),
        open
          ? h(TodoCardList, { t, items, editor, className, showWorkspace, onSend, canSend, onSendError })
          : null)
    }

    // ------------------------------------------------------------- components

    /**
     * Inline chevron for the completed area's header.
     * @param props - `open`, whether the section is expanded.
     * @returns the icon element, in the current text colour.
     */
    function ChevronGlyph(props) {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: 14,
        height: 14,
        className: 'dsh-todo-chevron',
        'data-open': props.open === true ? 'true' : 'false',
        'aria-hidden': true,
        focusable: 'false',
      }, h('path', {
        d: 'M6 3.5 10.5 8 6 12.5',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }))
    }

    /**
     * Inline pencil glyph for a card's edit control.
     * @returns the icon element, in the current text colour.
     */
    function PencilGlyph() {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: 14,
        height: 14,
        'aria-hidden': true,
        focusable: 'false',
      }, h('path', {
        d: 'M11.1 2.6a1.5 1.5 0 0 1 2.1 2.1L5.9 12 3 12.9l.9-2.9 7.2-7.4Z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinejoin: 'round',
      }))
    }

    /**
     * Inline bin glyph for a card's delete control.
     * @returns the icon element, in the current text colour.
     */
    function TrashGlyph() {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: 14,
        height: 14,
        'aria-hidden': true,
        focusable: 'false',
      }, h('path', {
        d: 'M3 4.4h10M6.4 4.4V2.9h3.2v1.5M4.6 4.4l.6 8.1a1 1 0 0 0 1 .9h3.6a1 1 0 0 0 1-.9l.6-8.1',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }))
    }

    /**
     * Inline play glyph for a card's execute control.
     * @returns the icon element, in the current text colour.
     */
    function ExecuteGlyph() {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: 14,
        height: 14,
        'aria-hidden': true,
        focusable: 'false',
      }, h('path', {
        d: 'M5.6 3.5v9l6.9-4.5-6.9-4.5Z',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinejoin: 'round',
      }))
    }

    /**
     * Inline question glyph for a card's explain control.
     * @returns the icon element, in the current text colour.
     */
    function ExplainGlyph() {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: 14,
        height: 14,
        'aria-hidden': true,
        focusable: 'false',
      },
      h('circle', {
        cx: 8,
        cy: 8,
        r: 6.2,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.2,
      }),
      h('path', {
        d: 'M6.2 6.2a1.85 1.85 0 1 1 2.7 1.65c-.55.35-.85.8-.85 1.4v.2',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.2,
        strokeLinecap: 'round',
      }),
      h('path', {
        d: 'M8.05 11.5v.2',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
      }))
    }

    /**
     * Inline maximize glyph for the editor's header.
     * @returns the icon element, in the current text colour.
     */
    function MaximizeGlyph() {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: 14,
        height: 14,
        'aria-hidden': true,
        focusable: 'false',
      }, h('path', {
        d: 'M9.6 2.8h3.6v3.6M6.4 13.2H2.8V9.6M13.2 2.8 9.9 6.1M2.8 13.2l3.3-3.3',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }))
    }

    /**
     * Inline restore glyph for the maximized editor's header.
     * @returns the icon element, in the current text colour.
     */
    function RestoreGlyph() {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: 14,
        height: 14,
        'aria-hidden': true,
        focusable: 'false',
      },
      h('path', {
        d: 'M5.6 5.6V3.2h7.2v7.2h-2.4',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
      h('rect', {
        x: 3.2,
        y: 5.6,
        width: 7.2,
        height: 7.2,
        rx: 1.2,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
      }))
    }

    /**
     * Inline close glyph for the editor's header.
     * @returns the icon element, in the current text colour.
     */
    function CloseGlyph() {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: 14,
        height: 14,
        'aria-hidden': true,
        focusable: 'false',
      }, h('path', {
        d: 'M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
        strokeLinecap: 'round',
      }))
    }

    /**
     * Inline check glyph shown once a card was sent.
     * @returns the icon element, in the current text colour.
     */
    function CheckGlyph() {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: 14,
        height: 14,
        'aria-hidden': true,
        focusable: 'false',
      }, h('path', {
        d: 'M3.2 8.6 6.4 11.7 12.8 4.6',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }))
    }

    /**
     * The left sidebar's launcher glyph.
     *
     * The sidebar owns the row, its label and its active colour, so the glyph is
     * drawn in `currentColor` at whatever edge it asks for.
     *
     * @param props - the sidebar's icon share: `size` and `active`.
     * @returns the icon element.
     */
    function TodoPanelIcon(props) {
      const size = props.size
      return h('svg', {
        viewBox: '0 0 20 20',
        width: size,
        height: size,
        'aria-hidden': true,
        focusable: 'false',
      },
      h('rect', {
        x: 2.6,
        y: 3.1,
        width: 14.8,
        height: 13.8,
        rx: 3.2,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.4,
      }),
      h('path', {
        d: 'M5.9 7.7l1.2 1.3 2.1-2.5',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
      }),
      h('path', {
        d: 'M11.2 7.9h3.4',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.4,
        strokeLinecap: 'round',
      }),
      h('path', {
        d: 'M5.9 13.2h8.7',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.4,
        strokeLinecap: 'round',
      }))
    }

    /**
     * One todo card: a head with the completion control, the execute and
     * explain controls and the other actions, the Markdown body, then a meta
     * line with the short id and the modification time. Editing happens in
     * {@link TodoEditorDialog}, not inside the card.
     *
     * @param props - the translated strings, the item, its callbacks, whether
     *   the card names its workspace, and whether it can send itself into a
     *   conversation.
     * @returns the list item element.
     */
    function TodoCard(props) {
      const {
        t, item, onStartEdit, onToggle, onDelete,
        showWorkspace, onSend, canSend, onSendError,
      } = props
      const [sendStates, setSendStates] = React.useState({ execute: 'idle', explain: 'idle' })
      const sendTimers = React.useRef({ execute: 0, explain: 0 })
      React.useEffect(() => () => {
        window.clearTimeout(sendTimers.current.execute)
        window.clearTimeout(sendTimers.current.explain)
      }, [])
      const blocks = React.useMemo(() => parseBlocks(item.text), [item.text])

      const triggerSend = async (kind) => {
        if (canSend !== true || sendStates[kind] === 'sending') return
        setSendStates(value => ({ ...value, [kind]: 'sending' }))
        try {
          await onSend(item, kind)
          setSendStates(value => ({ ...value, [kind]: 'sent' }))
          window.clearTimeout(sendTimers.current[kind])
          sendTimers.current[kind] = window.setTimeout(() => {
            setSendStates(value => ({ ...value, [kind]: 'idle' }))
          }, 4000)
        } catch (cause) {
          setSendStates(value => ({ ...value, [kind]: 'idle' }))
          onSendError(cause)
        }
      }

      const sendControl = (kind, Glyph, label) => h('button', {
        type: 'button',
        className: 'dsh-todo-iconButton',
        disabled: canSend !== true || sendStates[kind] === 'sending',
        'aria-label': canSend === true ? t(`${kind}.aria`, { text: item.text }) : t('send.disabled'),
        title: canSend === true
          ? (sendStates[kind] === 'sent' ? t(`${kind}.sent`) : label)
          : t('send.disabled'),
        onClick: () => { void triggerSend(kind) },
      }, sendStates[kind] === 'sent' ? h(CheckGlyph) : h(Glyph))

      return h('li', { className: 'dsh-todo-card', 'data-done': item.done ? 'true' : 'false' },
        h('div', { className: 'dsh-todo-cardHead' },
          h('label', { className: 'dsh-todo-checkWrap' },
            h('input', {
              type: 'checkbox',
              className: 'dsh-todo-check',
              checked: item.done,
              'aria-label': t('row.toggle', { text: item.text }),
              onChange: () => { onToggle(item.id) },
            }),
            h('span', { className: 'dsh-todo-status' }, item.done ? t('card.done') : t('card.open'))),
          h('div', { className: 'dsh-todo-cardActions' },
            sendControl('execute', ExecuteGlyph, t('execute.label')),
            sendControl('explain', ExplainGlyph, t('explain.label')),
            h('button', {
              type: 'button',
              className: 'dsh-todo-iconButton',
              'aria-label': t('row.edit', { text: item.text }),
              onClick: () => { onStartEdit(item) },
            }, h(PencilGlyph)),
            h('button', {
              type: 'button',
              className: 'dsh-todo-iconButton',
              'data-variant': 'danger',
              'aria-label': t('row.delete', { text: item.text }),
              onClick: () => { onDelete(item.id) },
            }, h(TrashGlyph)))),
        h('div', { className: 'dsh-todo-md' }, renderMarkdown(blocks)),
        h('div', { className: 'dsh-todo-meta' },
          h('span', {
            className: 'dsh-todo-metaId',
            title: t('card.id', { id: item.id }),
          }, `#${shortId(item)}`),
          h('span', {
            className: 'dsh-todo-metaTime',
            title: item.updatedAt,
          }, t('card.updated', { time: formatStamp(item.updatedAt) })),
          showWorkspace === true
            ? h('span', {
              className: 'dsh-todo-metaWorkspace',
              title: item.workspacePath,
            }, item.workspaceLabel)
            : null))
    }

    /**
     * The editing dialog: one large modal over the whole window.
     *
     * A native `<dialog>` opened with `showModal()` lives in the browser's top
     * layer, so it is centred in the viewport even inside the right-Sidebar
     * pane's transformed column, blocks the rest of the page, traps Tab and
     * turns Escape into a cancel. The dialog is resizable from its bottom-right
     * corner and toggles between that size and the whole window.
     *
     * @param props - `t`, the edited item, its draft, and the draft, cancel and
     *   save callbacks.
     * @returns the dialog element.
     */
    function TodoEditorDialog(props) {
      const { t, item, draft, onDraftChange, onCancel, onSave } = props
      const dialogRef = React.useRef(null)
      const textRef = React.useRef(null)
      const cancelRef = React.useRef(onCancel)
      cancelRef.current = onCancel
      const [maximized, setMaximized] = React.useState(false)

      React.useEffect(() => {
        const dialog = dialogRef.current
        if (dialog === null) return undefined
        if (!dialog.open) dialog.showModal()
        const onNativeCancel = (event) => {
          event.preventDefault()
          cancelRef.current()
        }
        dialog.addEventListener('cancel', onNativeCancel)
        if (textRef.current !== null) textRef.current.focus()
        return () => {
          dialog.removeEventListener('cancel', onNativeCancel)
          if (dialog.open) dialog.close()
        }
      }, [])

      return h('dialog', {
        ref: dialogRef,
        className: 'dsh-todo-dialog',
        'data-maximized': maximized ? 'true' : 'false',
        'aria-label': t('edit.title'),
      },
      h('div', { className: 'dsh-todo-dialogInner' },
        h('header', { className: 'dsh-todo-dialogHead' },
          h('span', { className: 'dsh-todo-dialogTitle' }, t('edit.title')),
          h('span', { className: 'dsh-todo-metaId', title: t('card.id', { id: item.id }) }, `#${shortId(item)}`),
          h('span', { className: 'dsh-todo-dialogActions' },
            h('button', {
              type: 'button',
              className: 'dsh-todo-iconButton',
              'aria-label': maximized ? t('edit.restore') : t('edit.maximize'),
              title: maximized ? t('edit.restore') : t('edit.maximize'),
              onClick: () => { setMaximized(value => !value) },
            }, maximized ? h(RestoreGlyph) : h(MaximizeGlyph)),
            h('button', {
              type: 'button',
              className: 'dsh-todo-iconButton',
              'aria-label': t('edit.close'),
              title: t('edit.close'),
              onClick: onCancel,
            }, h(CloseGlyph)))),
        h('div', { className: 'dsh-todo-dialogBody' },
          h('textarea', {
            ref: textRef,
            className: 'dsh-todo-input dsh-todo-textarea dsh-todo-dialogText',
            value: draft,
            'aria-label': t('edit.label'),
            onChange: (event) => { onDraftChange(event.target.value) },
            onKeyDown: (event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault()
                onSave()
              }
            },
          })),
        h('footer', { className: 'dsh-todo-dialogFoot' },
          h('span', { className: 'dsh-todo-hint' }, t('edit.hint')),
          h('button', {
            type: 'button',
            className: 'dsh-todo-outline',
            onClick: onCancel,
          }, t('edit.cancel')),
          h('button', {
            type: 'button',
            className: 'dsh-todo-primary',
            disabled: draft.trim() === '',
            onClick: onSave,
          }, t('edit.save')))))
    }

    /**
     * The page the sidebar launcher selects.
     *
     * It reads workspaces through the injected `useTodoWorkspaces` hook, the
     * Session cards send into through `currentSessionSource`, and the notebook
     * through the Host, and re-reads the Host on a short interval so a card the
     * agent wrote appears while the page is open.
     *
     * @param props - `t`, the workspace hook, `currentSessionSource`,
     *   `closeBoard` and `board`.
     * @returns the page element.
     */
    function TodoBoardPage(props) {
      const { t, useTodoWorkspaces, currentSessionSource, closeBoard, board } = props

      const workspaces = useTodoWorkspaces(snapshot => snapshot.items)
      const sessionId = React.useSyncExternalStore(
        currentSessionSource.subscribe,
        currentSessionSource.getSnapshot,
      )
      const workspacesPending = useTodoWorkspaces(snapshot => snapshot.phase !== 'ready')
      const workspacesRef = React.useRef(workspaces)
      workspacesRef.current = workspaces

      const { items, error, adopt, report, refresh } = useBoardItems(board)
      const editor = useTodoEditing({ board, items, adopt, report })
      const migrated = React.useRef(false)

      const [draftText, setDraftText] = React.useState('')
      const [draftWorkspacePath, setDraftWorkspacePath] = React.useState('')

      React.useEffect(() => {
        // One-time move of entries the first version of this page kept in
        // browser storage: only while the Host notebook is still empty.
        if (migrated.current || items === null || items.length > 0) return
        migrated.current = true
        void (async () => {
          try {
            await migrateLegacy(board, workspacesRef.current)
            await refresh()
          } catch (cause) {
            report(cause)
          }
        })()
      }, [items, board, refresh, report])

      const options = React.useMemo(
        () => workspaces.map(workspace => ({
          path: workspace.path,
          label: workspaceLabel(workspace),
        })),
        [workspaces],
      )

      const selectedWorkspacePath = options.some(option => option.path === draftWorkspacePath)
        ? draftWorkspacePath
        : (options.length > 0 ? options[0].path : '')

      const openItems = React.useMemo(
        () => (items === null ? [] : items.filter(item => !item.done)),
        [items],
      )
      const doneItems = React.useMemo(
        () => (items === null ? [] : items.filter(item => item.done)),
        [items],
      )
      const groups = React.useMemo(
        () => groupItems(openItems, workspaces),
        [openItems, workspaces],
      )
      const editingItem = items === null ? undefined : items.find(candidate => candidate.id === editor.editingId)

      const addTodo = async () => {
        const text = draftText.trim()
        if (text === '' || selectedWorkspacePath === '') return
        const option = options.find(candidate => candidate.path === selectedWorkspacePath)
        try {
          const value = await board.add({
            text,
            workspace: selectedWorkspacePath,
            label: option === undefined ? undefined : option.label,
          })
          adopt(value)
          setDraftText('')
        } catch (cause) {
          report(cause)
        }
      }

      const addDisabled = draftText.trim() === '' || selectedWorkspacePath === ''

      const send = (item, kind) => {
        if (sessionId === undefined) return Promise.reject(new Error(t('send.disabled')))
        return board.send(sessionId, sendPrompt(t, item, kind))
      }

      return h('div', { className: 'dsh-todo-page' },
        h('header', { className: 'dsh-todo-head' },
          h('div', { className: 'dsh-todo-headMain' },
            h('h1', { className: 'dsh-todo-title' }, t('page.title')),
            h('p', { className: 'dsh-todo-sub' }, t('page.subtitle'))),
          h('button', {
            type: 'button',
            className: 'dsh-todo-outline',
            onClick: closeBoard,
          }, t('page.back'))),
        h('div', { className: 'dsh-todo-body' },
          h('div', { className: 'dsh-todo-column' },
            h('form', {
              className: 'dsh-todo-addCard',
              onSubmit: (event) => { event.preventDefault(); void addTodo() },
            },
            h('textarea', {
              className: 'dsh-todo-input dsh-todo-textarea',
              value: draftText,
              rows: 2,
              placeholder: t('add.placeholder'),
              'aria-label': t('add.placeholder'),
              onChange: (event) => { setDraftText(event.target.value) },
              onKeyDown: (event) => {
                if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return
                event.preventDefault()
                void addTodo()
              },
            }),
            h('div', { className: 'dsh-todo-addBar' },
              h('select', {
                className: 'dsh-todo-select',
                value: selectedWorkspacePath,
                'aria-label': t('add.workspace'),
                disabled: options.length === 0,
                onChange: (event) => { setDraftWorkspacePath(event.target.value) },
              },
              options.length === 0
                ? h('option', { value: '' }, workspacesPending ? t('page.loading') : t('add.noWorkspace'))
                : options.map(option => h('option', { key: option.path, value: option.path }, option.label))),
              h('span', { className: 'dsh-todo-hint' }, t('add.hint')),
              h('button', {
                type: 'submit',
                className: 'dsh-todo-primary',
                disabled: addDisabled,
              }, t('add.submit')))),
            error === null ? null : h('p', { className: 'dsh-todo-error', role: 'alert' }, error),
            items === null
              ? h('p', { className: 'dsh-todo-empty' }, t('page.loadingBoard'))
              : items.length === 0
                ? h('p', { className: 'dsh-todo-empty' }, t('page.empty'))
                : [
                  groups.length === 0
                    ? h('p', { key: 'allDone', className: 'dsh-todo-empty' }, t('page.allDone'))
                    : h('div', { key: 'groups', className: 'dsh-todo-groups' },
                      groups.map(group => h('section', { key: group.key, className: 'dsh-todo-group' },
                        h('div', { className: 'dsh-todo-groupHead' },
                          h('h2', { className: 'dsh-todo-groupTitle', title: group.title }, group.title),
                          h('span', { className: 'dsh-todo-groupCount' }, t('group.open', {
                            count: group.items.length,
                          }))),
                        h(TodoCardList, {
                          t,
                          items: group.items,
                          editor,
                          className: 'dsh-todo-cards',
                          onSend: send,
                          canSend: sessionId !== undefined,
                          onSendError: report,
                        })))),
                  h(CompletedSection, {
                    key: 'done',
                    t,
                    items: doneItems,
                    editor,
                    className: 'dsh-todo-cards',
                    showWorkspace: true,
                    onSend: send,
                    canSend: sessionId !== undefined,
                    onSendError: report,
                  }),
                ])),
        editingItem === undefined ? null : h(TodoEditorDialog, {
          t,
          item: editingItem,
          draft: editor.editingText,
          onDraftChange: editor.setEditingText,
          onCancel: editor.cancel,
          onSave: editor.save,
        }))
    }

    /**
     * The right-Sidebar page: the cards of the workspace the shown Session
     * belongs to.
     *
     * The Session's workspace is resolved from the workspace catalog, so the
     * page follows the Session it was opened in: each Session's surface holds
     * its own tab, and the tab shows that Session's workspace only.
     *
     * @param props - `t`, the slot's `sessionId`, `useTodoWorkspaces` and `board`.
     * @returns the panel element.
     */
    function WorkspaceTodosPanel(props) {
      const { t, sessionId, useTodoWorkspaces, board } = props

      const workspaces = useTodoWorkspaces(snapshot => snapshot.items)
      const ready = useTodoWorkspaces(snapshot => snapshot.phase === 'ready')
      const { items, error, adopt, report } = useBoardItems(board)
      const editor = useTodoEditing({ board, items, adopt, report })
      const [draftText, setDraftText] = React.useState('')

      const workspace = workspaces.find(candidate => (
        Array.isArray(candidate.sessionIds) && candidate.sessionIds.includes(sessionId)
      ))
      const key = workspace === undefined ? null : pathKey(workspace.path)

      const visible = React.useMemo(() => (
        items === null || key === null
          ? []
          : items.filter(item => pathKey(item.workspacePath) === key)
      ), [items, key])

      const openItems = React.useMemo(
        () => visible.filter(item => !item.done),
        [visible],
      )
      const doneItems = React.useMemo(
        () => visible.filter(item => item.done),
        [visible],
      )
      const editingItem = items === null ? undefined : items.find(candidate => candidate.id === editor.editingId)

      const addTodo = async () => {
        const text = draftText.trim()
        if (text === '' || workspace === undefined) return
        try {
          adopt(await board.add({
            text,
            workspace: workspace.path,
            label: workspaceLabel(workspace),
          }))
          setDraftText('')
        } catch (cause) {
          report(cause)
        }
      }

      const send = (item, kind) => {
        if (sessionId === undefined) return Promise.reject(new Error(t('send.disabled')))
        return board.send(sessionId, sendPrompt(t, item, kind))
      }

      return h('div', { className: 'dsh-todo-panel' },
        workspace === undefined
          ? null
          : h('div', { className: 'dsh-todo-panelHead' },
            h('span', {
              className: 'dsh-todo-panelTitle',
              title: workspace.path,
            }, workspaceLabel(workspace)),
            h('span', { className: 'dsh-todo-panelCount' }, t('group.open', {
              count: openItems.length,
            }))),
        workspace === undefined
          ? (ready ? h('p', { className: 'dsh-todo-empty' }, t('panel.noWorkspace')) : null)
          : [
            h('form', {
              key: 'add',
              className: 'dsh-todo-panelAdd',
              onSubmit: (event) => { event.preventDefault(); void addTodo() },
            },
            h('textarea', {
              className: 'dsh-todo-input dsh-todo-textarea',
              value: draftText,
              rows: 2,
              placeholder: t('panel.addPlaceholder'),
              'aria-label': t('panel.addPlaceholder'),
              onChange: (event) => { setDraftText(event.target.value) },
              onKeyDown: (event) => {
                if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey)) return
                event.preventDefault()
                void addTodo()
              },
            }),
            h('div', { className: 'dsh-todo-panelAddBar' },
              h('span', { className: 'dsh-todo-hint' }, t('add.hint')),
              h('button', {
                type: 'submit',
                className: 'dsh-todo-primary',
                disabled: draftText.trim() === '',
              }, t('add.submit')))),
            error === null ? null : h('p', { key: 'error', className: 'dsh-todo-error', role: 'alert' }, error),
            items === null
              ? h('p', { key: 'loading', className: 'dsh-todo-empty' }, t('page.loadingBoard'))
              : visible.length === 0
                ? h('p', { key: 'empty', className: 'dsh-todo-empty' }, t('page.empty'))
                : [
                  openItems.length === 0
                    ? h('p', { key: 'allDone', className: 'dsh-todo-empty' }, t('page.allDone'))
                    : h(TodoCardList, {
                      key: 'cards',
                      t,
                      items: openItems,
                      editor,
                      className: 'dsh-todo-panelCards',
                      onSend: send,
                      canSend: sessionId !== undefined,
                      onSendError: report,
                    }),
                  h(CompletedSection, {
                    key: 'done',
                    t,
                    items: doneItems,
                    editor,
                    className: 'dsh-todo-panelCards',
                    onSend: send,
                    canSend: sessionId !== undefined,
                    onSendError: report,
                  }),
                ],
          ],
        editingItem === undefined ? null : h(TodoEditorDialog, {
          t,
          item: editingItem,
          draft: editor.editingText,
          onDraftChange: editor.setEditingText,
          onCancel: editor.cancel,
          onSave: editor.save,
        }))
    }

    // ---------------------------------------------------------------- styles

    /**
     * The board's stylesheet.
     *
     * Only `--dsw-alias-*` and `--dsw-*` theme tokens are referenced, so light
     * and dark themes and future token renames are the host's business. Every
     * class carries this plugin's `dsh-todo-` prefix so nothing here can reach
     * another plugin's UI.
     */
    const CSS = `
.dsh-todo-page {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-size: 14px;
  line-height: 20px;
}
.dsh-todo-head {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  box-sizing: border-box;
  padding: 28px clamp(24px, 4vw, 48px) 18px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l3);
}
html[data-platform='darwin'] .dsh-todo-head {
  padding-top: calc(28px + var(--dsh-frame-top-clearance, 0px));
}
.dsh-todo-headMain {
  min-width: 0;
}
.dsh-todo-title {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
  line-height: 28px;
}
.dsh-todo-sub {
  max-width: 640px;
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-todo-body {
  flex: 1;
  min-height: 0;
  display: flex;
  justify-content: center;
  box-sizing: border-box;
  padding: 24px clamp(24px, 4vw, 48px) 48px;
  overflow-y: auto;
}
.dsh-todo-column {
  width: 100%;
  max-width: 1200px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}
/* ---------------------------------------------------------- add card */
.dsh-todo-addCard {
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-sizing: border-box;
  padding: 12px 14px;
  background: var(--dsw-alias-bg-layer-1);
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-lg);
  box-shadow: var(--dsw-shadow-sm, none);
}
.dsh-todo-addBar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.dsh-todo-hint {
  flex: 1 1 auto;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
/* ------------------------------------------------------------ inputs */
.dsh-todo-input,
.dsh-todo-select {
  box-sizing: border-box;
  padding: 0 10px;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-md);
}
.dsh-todo-input {
  height: 32px;
}
.dsh-todo-select {
  flex: 0 1 auto;
  height: 32px;
  max-width: 220px;
  padding-right: 6px;
}
.dsh-todo-textarea {
  height: auto;
  padding: 8px 10px;
  resize: vertical;
  font-family: inherit;
}
.dsh-todo-input::placeholder {
  color: var(--dsw-alias-label-tertiary);
}
.dsh-todo-select:disabled {
  color: var(--dsw-alias-label-tertiary);
  cursor: default;
}
.dsh-todo-primary {
  flex: none;
  height: 32px;
  padding: 0 14px;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary-foreground);
  background: var(--dsw-alias-button-primary-fill);
  border: 0;
  border-radius: var(--dsw-radius-md);
  cursor: pointer;
}
.dsh-todo-primary:disabled {
  opacity: 0.5;
  cursor: default;
}
.dsh-todo-outline {
  flex: none;
  height: 32px;
  padding: 0 12px;
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
  background: transparent;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-md);
  cursor: pointer;
}
.dsh-todo-input:focus-visible,
.dsh-todo-select:focus-visible,
.dsh-todo-primary:focus-visible,
.dsh-todo-outline:focus-visible,
.dsh-todo-iconButton:focus-visible,
.dsh-todo-check:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
}
@media (hover: hover) {
  .dsh-todo-primary:hover:not(:disabled) {
    background: var(--dsw-alias-button-primary-hover);
  }
  .dsh-todo-outline:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.dsh-todo-primary:active:not(:disabled),
.dsh-todo-outline:active {
  background: var(--dsw-alias-interactive-bg-active);
}
.dsh-todo-error {
  margin: 0;
  padding: 8px 12px;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-state-error-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 0.5px solid var(--dsw-alias-state-error-primary);
  border-radius: var(--dsw-radius-md);
  overflow-wrap: anywhere;
}
/* ------------------------------------------------------------ groups */
.dsh-todo-groups {
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.dsh-todo-groupHead {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 10px;
}
.dsh-todo-groupTitle {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-todo-groupCount {
  flex: none;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
/* ------------------------------------------------------ completed area */
.dsh-todo-done {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}
.dsh-todo-doneHead {
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  width: 100%;
  padding: 7px 10px;
  font: inherit;
  color: var(--dsw-alias-label-secondary);
  background: transparent;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-md);
  cursor: pointer;
}
.dsh-todo-doneTitle {
  font-size: 13px;
  font-weight: 600;
  line-height: 20px;
}
.dsh-todo-chevron {
  flex: none;
  transition: transform 120ms ease;
}
.dsh-todo-chevron[data-open='true'] {
  transform: rotate(90deg);
}
.dsh-todo-doneHead:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
}
@media (hover: hover) {
  .dsh-todo-doneHead:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.dsh-todo-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}
/* ------------------------------------------------------------- cards */
.dsh-todo-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
  min-width: 0;
  padding: 12px 14px 14px;
  background: var(--dsw-alias-bg-layer-1);
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-lg);
  box-shadow: var(--dsw-shadow-sm, none);
}
.dsh-todo-card[data-done='true'] {
  background: var(--dsw-alias-bg-base);
}
.dsh-todo-cardHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.dsh-todo-checkWrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  cursor: pointer;
  user-select: none;
}
.dsh-todo-check {
  flex: none;
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--dsw-alias-brand-primary);
  cursor: pointer;
}
.dsh-todo-status {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-todo-card[data-done='true'] .dsh-todo-status {
  color: var(--dsw-alias-label-tertiary);
}
.dsh-todo-cardActions {
  flex: none;
  display: inline-flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 120ms ease;
}
.dsh-todo-card:hover .dsh-todo-cardActions,
.dsh-todo-card:focus-within .dsh-todo-cardActions {
  opacity: 1;
}
.dsh-todo-iconButton {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  color: var(--dsw-alias-label-secondary);
  background: transparent;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  cursor: pointer;
}
.dsh-todo-iconButton[data-variant='danger'] {
  color: var(--dsw-alias-state-error-primary);
}
.dsh-todo-iconButton:disabled {
  opacity: 0.35;
  cursor: default;
}
@media (hover: hover) {
  .dsh-todo-iconButton:hover {
    background: var(--dsw-alias-interactive-bg-hover);
    color: var(--dsw-alias-label-primary);
  }
}
/* -------------------------------------------------------- card body */
.dsh-todo-md {
  min-width: 0;
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
}
.dsh-todo-card[data-done='true'] .dsh-todo-md {
  color: var(--dsw-alias-label-tertiary);
  text-decoration: line-through;
}
.dsh-todo-md > :first-child {
  margin-top: 0;
}
.dsh-todo-md > :last-child {
  margin-bottom: 0;
}
.dsh-todo-mdP {
  margin: 0 0 8px;
  white-space: pre-wrap;
}
.dsh-todo-mdH {
  margin: 12px 0 6px;
  font-weight: 600;
  line-height: 22px;
}
h3.dsh-todo-mdH { font-size: 15px; }
h4.dsh-todo-mdH { font-size: 14px; }
h5.dsh-todo-mdH,
h6.dsh-todo-mdH { font-size: 13px; }
.dsh-todo-mdList {
  margin: 0 0 8px;
  padding-left: 18px;
}
.dsh-todo-mdList li {
  margin: 2px 0;
}
.dsh-todo-mdQuote {
  margin: 0 0 8px;
  padding: 2px 0 2px 10px;
  color: var(--dsw-alias-label-secondary);
  border-left: 2px solid var(--dsw-alias-border-l3);
  white-space: pre-wrap;
}
.dsh-todo-mdCode {
  padding: 1px 5px;
  font-family: var(--dsw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  background: var(--dsw-alias-bg-layer-2, var(--dsw-alias-bg-base));
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
}
.dsh-todo-mdPre {
  margin: 0 0 8px;
  padding: 8px 10px;
  overflow-x: auto;
  font-family: var(--dsw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 12px;
  line-height: 18px;
  background: var(--dsw-alias-bg-base);
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-md);
}
.dsh-todo-mdPre code {
  font: inherit;
}
.dsh-todo-mdLink {
  color: var(--dsw-alias-state-business-primary);
  text-decoration: none;
}
.dsh-todo-mdLink:hover {
  text-decoration: underline;
}
.dsh-todo-mdHr {
  margin: 10px 0;
  border: 0;
  border-top: 0.5px solid var(--dsw-alias-border-l3);
}
/* --------------------------------------------------------- card meta */
.dsh-todo-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 10px;
  min-width: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-todo-metaId {
  flex: none;
  padding: 0 5px;
  font-family: var(--dsw-font-family-mono, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  line-height: 17px;
  color: var(--dsw-alias-label-secondary);
  background: var(--dsw-alias-bg-base);
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
}
.dsh-todo-metaTime {
  flex: none;
  font-variant-numeric: tabular-nums;
}
.dsh-todo-metaWorkspace {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* ------------------------------------------------------------ editor */
/* One scrim value rather than a theme token: a modal backdrop must stay
   translucent in both themes, and no --dsw-alias-* token promises that. */
.dsh-todo-dialog {
  box-sizing: border-box;
  width: min(920px, 92vw);
  height: min(640px, 85vh);
  min-width: 360px;
  min-height: 240px;
  max-width: 92vw;
  max-height: 90vh;
  padding: 0;
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-layer-1);
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-lg);
  box-shadow: var(--dsw-shadow-sm, none);
  overflow: hidden;
  resize: both;
}
.dsh-todo-dialog::backdrop {
  background: rgb(0 0 0 / 40%);
}
.dsh-todo-dialog[data-maximized='true'] {
  /* !important: a manual resize writes inline width/height, which must lose
     while the dialog fills the window. */
  inset: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  max-width: none !important;
  max-height: none !important;
  margin: 0;
  border: 0;
  border-radius: 0;
  resize: none;
}
.dsh-todo-dialogInner {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
}
.dsh-todo-dialogHead {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  padding: 10px 12px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l3);
}
.dsh-todo-dialogTitle {
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}
.dsh-todo-dialogActions {
  flex: none;
  display: inline-flex;
  gap: 2px;
  margin-left: auto;
}
.dsh-todo-dialogBody {
  flex: 1;
  min-height: 0;
  display: flex;
  box-sizing: border-box;
  padding: 12px;
}
.dsh-todo-dialogText {
  flex: 1;
  width: 100%;
  height: auto;
  min-height: 0;
  resize: none;
  font-family: inherit;
  font-size: 13px;
  line-height: 20px;
}
.dsh-todo-dialogFoot {
  flex: none;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  padding: 10px 12px;
  border-top: 0.5px solid var(--dsw-alias-border-l3);
}
.dsh-todo-empty {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}
/* -------------------------------------------------- right-sidebar panel */
.dsh-todo-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  padding: 12px 12px 20px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
}
.dsh-todo-panelHead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.dsh-todo-panelTitle {
  min-width: 0;
  overflow: hidden;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dsh-todo-panelCount {
  flex: none;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-todo-panelAdd {
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
  padding: 10px 12px;
  background: var(--dsw-alias-bg-layer-1);
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-lg);
}
.dsh-todo-panelAddBar {
  display: flex;
  align-items: center;
  gap: 8px;
}
.dsh-todo-panelCards {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.dsh-todo-panelCards .dsh-todo-card {
  padding: 10px 12px 12px;
}
`

    /**
     * Install the stylesheet for this plugin's lifetime.
     * @returns the disposer that removes the element again.
     */
    function installStyles() {
      const element = document.createElement('style')
      element.id = STYLE_ID
      element.textContent = CSS
      document.head.appendChild(element)
      return () => { element.remove() }
    }

    // ------------------------------------------------------------ the plugin

    return {
      /** Services this browser half needs; it stays inactive without them. */
      inject: [
        'slots', 'locale', 'layout', 'workspaces', 'connection', 'sessions', 'uiSession', 'sidebarRightTabs',
      ],

      /**
       * Contribute the launcher and the page it opens.
       * @param ctx - the browser plugin context.
       */
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'todo-board: dictionaries')

        const t = ctx.locale.bind(NS)

        ctx.effect(installStyles, 'todo-board: stylesheet')

        // The Session a card sends into from the centre page: the last
        // conversation that was on screen. A global main panel has no Session
        // binding of its own, and the Conversation unmounts while a panel is
        // shown, so this keeps the last identity the shell reported instead of
        // reading an empty binding at click time.
        let lastSessionId
        const sessionListeners = new Set()
        const sessionSource = {
          getSnapshot: () => lastSessionId,
          subscribe: (listener) => {
            sessionListeners.add(listener)
            return () => { sessionListeners.delete(listener) }
          },
        }
        ctx.effect(() => {
          const current = ctx.uiSession.adapter.current
          const note = () => {
            const key = current.getSnapshot()?.key
            if (typeof key !== 'string' || key === '' || key === lastSessionId) return
            lastSessionId = key
            for (const listener of sessionListeners) listener()
          }
          const unsubscribe = current.subscribe(note)
          note()
          return () => {
            unsubscribe()
            sessionListeners.clear()
          }
        }, 'todo-board: last on-screen session')

        // One stable API object: the page's effects key on it, so it must not be
        // rebuilt on every render.
        const board = {
          list: () => callBoard(ctx, { action: 'list' }),
          add: input => callBoard(ctx, { action: 'add', ...input }),
          update: input => callBoard(ctx, { action: 'update', ...input }),
          remove: id => callBoard(ctx, { action: 'remove', id }),
          send: (sessionId, text) => sendToSession(ctx, sessionId, text),
        }

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({
            hooks: { todoWorkspaces: ctx.workspaces.list },
            currentSessionSource: sessionSource,
            closeBoard: () => { ctx.layout.selectPanel(null) },
            board,
          }),
        }, TodoBoardPage))

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: LAUNCHER_ORDER,
          label: () => t('panel'),
          locale: NS,
        }, TodoPanelIcon))

        // Right Sidebar: a page type whose body shows the workspace the shown
        // Session belongs to. The guide capsule is how it is opened — the
        // Sidebar's add control opens the guide, and the capsule opens this
        // page in a tab of that Session's surface.
        ctx.effect(() => ctx.sidebarRightTabs.register({
          id: TAB_ID,
          kind: TAB_KIND,
          priority: 'extension',
          title: () => t('panel'),
          guide: [{
            id: 'board',
            order: 40,
            title: () => t('panel'),
            description: () => t('panel.guide'),
            icon: TodoPanelIcon,
          }],
        }), 'todo-board: right-sidebar tab type')

        ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
          name: 'sidebar.right.pane.tab',
          key: TAB_ID,
          locale: NS,
          inject: () => ({
            hooks: { todoWorkspaces: ctx.workspaces.list },
            board,
          }),
        }, WorkspaceTodosPanel))

        // Registered last so it unwinds first: hand the centre column back to
        // the Conversation while the layout service and this page still exist,
        // and only when this plugin is what the user is looking at.
        ctx.effect(() => () => {
          if (ctx.layout.panelInfo.getSnapshot().activePanelId !== PANEL_ID) return
          ctx.layout.selectPanel(null)
        }, 'todo-board: release panel')
      },
    }
  },
})
