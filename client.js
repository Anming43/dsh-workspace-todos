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
      'page.title': 'Workspace todos',
      'page.subtitle': 'One notebook for every workspace: the agent writes each card’s title, summary and details and marks its own work done; you confirm the cards you accept. Changes appear within a few seconds.',
      'page.back': 'Back to conversation',
      'page.loading': 'Reading workspaces…',
      'page.loadingBoard': 'Reading the notebook…',
      'page.empty': 'No todos yet. Ask the agent to add one with the workspace_todos tool.',
      'page.allDone': 'Nothing open. Completed cards wait in the area below.',
      'group.open': '{count} open',
      'section.done': 'Confirmed · {count}',
      'section.toggle': 'Show or hide confirmed todos',
      'card.aiDone': 'AI finished',
      'card.aiOpen': 'AI working',
      'card.confirm': 'Confirm done',
      'card.confirmed': 'Confirmed',
      'card.pending': 'Pending',
      'card.unconfirm': 'Undo confirmation',
      'card.delete': 'Delete todo',
      'confirm.delete': 'Delete “{title}”? This cannot be undone.',
      'section.clear': 'Clear',
      'confirm.clear': 'Delete all {count} confirmed todos? This cannot be undone.',
      'card.updated': 'Updated {time}',
      'card.id': 'Todo id {id}',
      'card.idCopy': 'Copy todo id',
      'card.idCopied': 'Copied',
      'card.viewHint': 'Open “{title}”',
      'execute.label': 'Execute todo',
      'explain.label': 'Explain todo',
      'execute.aria': 'Execute “{title}”',
      'explain.aria': 'Explain “{title}”',
      'execute.sent': 'Execution requested',
      'explain.sent': 'Explanation requested',
      'send.disabled': 'Open a conversation first',
      'execute.prompt': 'Execute this todo from the shared workspace todo notebook.\n\n'
        + '- Todo: {short} (`{id}`)\n'
        + '- Title: {title}\n'
        + '- Summary: {summary}\n'
        + '- Workspace: {workspace}\n'
        + '- Status: {status}\n'
        + '- Confirmed by the user: {confirmed}\n'
        + '- Last modified: {time}\n\n'
        + 'Details:\n\n{details}\n\n'
        + 'When it is finished, close it with the workspace_todos tool: update with this id and done=true.',
      'explain.prompt': 'Explain this todo from the shared workspace todo notebook; do not change anything yet.\n\n'
        + '- Todo: {short} (`{id}`)\n'
        + '- Title: {title}\n'
        + '- Summary: {summary}\n'
        + '- Workspace: {workspace}\n'
        + '- Status: {status}\n'
        + '- Confirmed by the user: {confirmed}\n'
        + '- Last modified: {time}\n\n'
        + 'Details:\n\n{details}\n\n'
        + 'Say what it asks for, why it matters, which files or steps it touches, and what is unclear. '
        + 'Leave the todo open unless I ask you to do it.',
      'detail.title': 'Todo details',
      'detail.close': 'Close',
      'detail.maximize': 'Maximize',
      'detail.restore': 'Restore size',
      'detail.ai': 'AI status',
      'detail.confirmation': 'My confirmation',
      'detail.workspace': 'Workspace',
      'detail.updated': 'Updated',
      'detail.created': 'Created',
      'detail.noDetails': 'No details yet.',
    }

    /** Chinese copy. */
    const zh = {
      'panel': '跨工作区待办本',
      'panel.guide': '当前会话所属工作区的待办',
      'panel.noWorkspace': '这个会话还没有所属工作区。',
      'page.title': '跨工作区待办本',
      'page.subtitle': '所有工作区共用一份清单：标题、摘要、详情和 AI 完成状态由智能体写入，你在这里确认哪些真的完成；改动几秒内出现。',
      'page.back': '返回对话',
      'page.loading': '正在读取工作区…',
      'page.loadingBoard': '正在读取待办本…',
      'page.empty': '还没有待办。可以让智能体用 workspace_todos 工具添加。',
      'page.allDone': '没有未完成的待办，已完成的收纳在下方。',
      'group.open': '{count} 条未完成',
      'section.done': '已确认 · {count}',
      'section.toggle': '展开或收起已确认待办',
      'card.aiDone': 'AI 已完成',
      'card.aiOpen': 'AI 进行中',
      'card.confirm': '确认完成',
      'card.confirmed': '已确认',
      'card.pending': '待确认',
      'card.unconfirm': '撤销确认',
      'card.delete': '删除待办',
      'confirm.delete': '删除「{title}」？此操作不可撤销。',
      'section.clear': '清空',
      'confirm.clear': '删除全部 {count} 条已确认待办？此操作不可撤销。',
      'card.updated': '修改于 {time}',
      'card.id': '待办 ID {id}',
      'card.idCopy': '复制待办 ID',
      'card.idCopied': '已复制',
      'card.viewHint': '查看「{title}」',
      'execute.label': '执行待办',
      'explain.label': '解释待办',
      'execute.aria': '执行待办「{title}」',
      'explain.aria': '解释待办「{title}」',
      'execute.sent': '已发送执行请求',
      'explain.sent': '已发送解释请求',
      'send.disabled': '先打开一个会话',
      'execute.prompt': '执行这条待办（来自跨工作区待办本）：\n\n'
        + '- 待办：{short}（`{id}`）\n'
        + '- 标题：{title}\n'
        + '- 摘要：{summary}\n'
        + '- 工作区：{workspace}\n'
        + '- 状态：{status}\n'
        + '- 用户确认：{confirmed}\n'
        + '- 最后修改：{time}\n\n'
        + '详情：\n\n{details}\n\n'
        + '完成后用 workspace_todos 工具标记完成：update，带上这条 id 和 done=true。',
      'explain.prompt': '解释这条待办（来自跨工作区待办本），先不要动手改动：\n\n'
        + '- 待办：{short}（`{id}`）\n'
        + '- 标题：{title}\n'
        + '- 摘要：{summary}\n'
        + '- 工作区：{workspace}\n'
        + '- 状态：{status}\n'
        + '- 用户确认：{confirmed}\n'
        + '- 最后修改：{time}\n\n'
        + '详情：\n\n{details}\n\n'
        + '说明它要做什么、为什么、涉及哪些文件或步骤、有哪些不确定点；除非我明确要求，否则保持未完成。',
      'detail.title': '待办详情',
      'detail.close': '关闭',
      'detail.maximize': '最大化',
      'detail.restore': '还原大小',
      'detail.ai': 'AI 状态',
      'detail.confirmation': '我的确认',
      'detail.workspace': '工作区',
      'detail.updated': '修改于',
      'detail.created': '创建于',
      'detail.noDetails': '还没有详情。',
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
          title: entry.text.split(/\r?\n/)[0].trim().slice(0, 120) || entry.text.slice(0, 120),
          details: entry.text,
          // A Host half that predates the split still reads `text`.
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
        title: item.title,
        summary: item.summary === '' ? '—' : item.summary,
        workspace: item.workspacePath,
        status: item.done ? t('card.aiDone') : t('card.aiOpen'),
        confirmed: item.confirmed ? t('card.confirmed') : t('card.pending'),
        time: formatStamp(item.updatedAt),
        details: item.details === '' ? '—' : item.details,
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
     * Give one Host record the three split fields, whatever the Host half
     * answered.
     *
     * Within one release the Host and this page always agree, but a page that
     * hot-reloaded before the Host did would otherwise render blank cards: a
     * record from the pre-2.0 shape has one `text` body, which becomes the
     * details with a title derived from its first line.
     *
     * @param item - one record from a Host snapshot.
     * @returns the record with `title`, `summary` and `details`.
     */
    function withSplitFields(item) {
      const text = typeof item.text === 'string' ? item.text : ''
      const derived = text.split(/\r?\n/).map(part => part.trim()).find(part => part !== '') ?? ''
      const title = typeof item.title === 'string' && item.title !== '' ? item.title : derived
      return {
        ...item,
        title: title.replace(/^#{1,6}\s+/, '').replace(/^[-*+]\s+/, '').replace(/^>\s?/, '').slice(0, 120),
        summary: typeof item.summary === 'string' ? item.summary : '',
        details: typeof item.details === 'string' ? item.details : text,
        confirmed: item.confirmed === true,
      }
    }

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
        setItems(value.items.map(withSplitFields))
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
     * One card per record, wired to the card's controls.
     * @param props - `t`, the records, the list's class name, whether each card
     *   names its workspace, the detail opener, and the send wiring.
     * @returns the list element.
     */
    function TodoCardList(props) {
      const { t, items, className, showWorkspace, onOpenDetail, onSend, canSend, onError, onConfirm, onDelete } = props
      return h('ul', { className },
        items.map(item => h(TodoCard, {
          key: item.id,
          t,
          item,
          showWorkspace,
          onOpenDetail,
          onSend,
          canSend,
          onError,
          onConfirm,
          onDelete,
        })))
    }

    /**
     * The folded area that holds completed cards.
     *
     * It starts collapsed on every mount, so open cards stay at the top; its
     * header is a button that shows or hides the cards underneath. With no
     * completed record the section renders nothing at all.
     *
     * @param props - `t`, the completed records, the list's class name,
     *   whether each card names its workspace, the detail opener, and the send
     *   wiring.
     * @returns the section element, or null when no record is completed.
     */
    function CompletedSection(props) {
      const {
        t, items, className, showWorkspace, onOpenDetail, onSend, canSend, onError, onConfirm, onDelete, onClear,
      } = props
      const [open, setOpen] = React.useState(false)
      if (items.length === 0) return null
      return h('section', { className: 'dsh-todo-done' },
        h('div', { className: 'dsh-todo-doneHead' },
          h('button', {
            type: 'button',
            className: 'dsh-todo-doneToggle',
            'aria-expanded': open,
            'aria-label': t('section.toggle'),
            onClick: () => { setOpen(value => !value) },
          },
          h(ChevronGlyph, { open }),
          h('span', { className: 'dsh-todo-doneTitle' }, t('section.done', { count: items.length }))),
          h('button', {
            type: 'button',
            className: 'dsh-todo-doneClear',
            title: t('confirm.clear', { count: items.length }),
            onClick: () => { onClear(items) },
          }, t('section.clear'))),
        open
          ? h(TodoCardList, {
            t, items, className, showWorkspace, onOpenDetail, onSend, canSend, onError, onConfirm, onDelete,
          })
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
     * Inline maximize glyph for the detail dialog's header.
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
     * Inline restore glyph for the maximized detail dialog's header.
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
     * Inline close glyph for the detail dialog's header.
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
     * Inline copy glyph for the id badge's copy control.
     * @returns the icon element, in the current text colour.
     */
    function CopyGlyph() {
      return h('svg', {
        viewBox: '0 0 16 16',
        width: 12,
        height: 12,
        'aria-hidden': true,
        focusable: 'false',
      },
      h('rect', {
        x: 2.4,
        y: 2.4,
        width: 8,
        height: 8,
        rx: 1.4,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
      }),
      h('rect', {
        x: 5.6,
        y: 5.6,
        width: 8,
        height: 8,
        rx: 1.4,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.3,
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
     * One todo card: a head with the status and the two conversation controls,
     * the title, the summary, then a meta line with the short id, a copy control
     * and the modification time. The whole card opens the read-only detail
     * dialog, and the controls stop their click from reaching it. The card body
     * is the title and summary only — the details live in
     * {@link TodoDetailDialog}.
     *
     * @param props - the translated strings, the item, whether the card names
     *   its workspace, the detail opener, and the send wiring.
     * @returns the list item element.
     */
    function TodoCard(props) {
      const { t, item, showWorkspace, onOpenDetail, onSend, canSend, onError, onConfirm, onDelete } = props
      const [sendStates, setSendStates] = React.useState({ execute: 'idle', explain: 'idle' })
      const [copied, setCopied] = React.useState(false)
      const sendTimers = React.useRef({ execute: 0, explain: 0 })
      const copyTimer = React.useRef(0)
      React.useEffect(() => () => {
        window.clearTimeout(sendTimers.current.execute)
        window.clearTimeout(sendTimers.current.explain)
        window.clearTimeout(copyTimer.current)
      }, [])

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
          onError(cause)
        }
      }

      const copyId = async (event) => {
        event.stopPropagation()
        try {
          await navigator.clipboard.writeText(item.id)
          setCopied(true)
          window.clearTimeout(copyTimer.current)
          copyTimer.current = window.setTimeout(() => { setCopied(false) }, 1500)
        } catch (cause) {
          onError(cause)
        }
      }

      const sendControl = (kind, Glyph, label) => h('button', {
        type: 'button',
        className: 'dsh-todo-iconButton',
        disabled: canSend !== true || sendStates[kind] === 'sending',
        'aria-label': canSend === true ? t(`${kind}.aria`, { title: item.title }) : t('send.disabled'),
        title: canSend === true
          ? (sendStates[kind] === 'sent' ? t(`${kind}.sent`) : label)
          : t('send.disabled'),
        onClick: (event) => { event.stopPropagation(); void triggerSend(kind) },
      }, sendStates[kind] === 'sent' ? h(CheckGlyph) : h(Glyph))

      return h('li', {
        className: 'dsh-todo-card',
        'data-done': item.confirmed ? 'true' : 'false',
        role: 'button',
        tabIndex: 0,
        'aria-label': t('card.viewHint', { title: item.title }),
        onClick: () => {
          // Selecting the summary to copy must not open the dialog.
          const selection = window.getSelection()
          if (selection !== null && selection.toString() !== '') return
          onOpenDetail(item)
        },
        onKeyDown: (event) => {
          if (event.target !== event.currentTarget) return
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onOpenDetail(item)
        },
      },
      h('div', { className: 'dsh-todo-cardHead' },
        h('span', {
          className: 'dsh-todo-ai',
          'data-done': item.done ? 'true' : 'false',
        }, item.done ? t('card.aiDone') : t('card.aiOpen')),
        h('button', {
          type: 'button',
          className: 'dsh-todo-confirm',
          'aria-pressed': item.confirmed,
          title: item.confirmed ? t('card.unconfirm') : t('card.confirm'),
          onClick: (event) => { event.stopPropagation(); onConfirm(item) },
        }, item.confirmed ? t('card.confirmed') : t('card.confirm')),
        h('div', { className: 'dsh-todo-cardActions' },
          sendControl('execute', ExecuteGlyph, t('execute.label')),
          sendControl('explain', ExplainGlyph, t('explain.label')),
          h('button', {
            type: 'button',
            className: 'dsh-todo-iconButton',
            'data-variant': 'danger',
            'aria-label': t('card.delete'),
            title: t('card.delete'),
            onClick: (event) => { event.stopPropagation(); onDelete(item) },
          }, h(TrashGlyph)))),
      h('div', { className: 'dsh-todo-cardTitle' }, item.title),
      item.summary === '' ? null : h('p', { className: 'dsh-todo-cardSummary' }, item.summary),
      h('div', { className: 'dsh-todo-meta' },
        h('span', {
          className: 'dsh-todo-metaId',
          title: t('card.id', { id: item.id }),
        }, `#${shortId(item)}`),
        h('button', {
          type: 'button',
          className: 'dsh-todo-copyId',
          'aria-label': copied ? t('card.idCopied') : t('card.idCopy'),
          title: copied ? t('card.idCopied') : t('card.idCopy'),
          onClick: copyId,
        }, copied ? h(CheckGlyph) : h(CopyGlyph)),
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
     * The read-only detail dialog: title, summary, Markdown details and the
     * record's metadata.
     *
     * A native `<dialog>` opened with `showModal()` lives in the browser's top
     * layer, so it is centred over the viewport in either surface, blocks the
     * rest of the page, traps Tab and turns Escape into a close. It is
     * resizable from its bottom-right corner and toggles between that size and
     * the whole window.
     *
     * @param props - `t`, the record to show, the close callback, and the error
     *   reporter for a refused clipboard write.
     * @returns the dialog element.
     */
    function TodoDetailDialog(props) {
      const { t, item, onClose, onError } = props
      const dialogRef = React.useRef(null)
      const closeRef = React.useRef(onClose)
      closeRef.current = onClose
      const [maximized, setMaximized] = React.useState(false)
      const [copied, setCopied] = React.useState(false)
      const copyTimer = React.useRef(0)

      React.useEffect(() => {
        const dialog = dialogRef.current
        if (dialog === null) return undefined
        if (!dialog.open) dialog.showModal()
        const onNativeCancel = (event) => {
          event.preventDefault()
          closeRef.current()
        }
        dialog.addEventListener('cancel', onNativeCancel)
        return () => {
          dialog.removeEventListener('cancel', onNativeCancel)
          if (dialog.open) dialog.close()
        }
      }, [])

      React.useEffect(() => () => { window.clearTimeout(copyTimer.current) }, [])

      const blocks = React.useMemo(() => parseBlocks(item.details), [item.details])

      const copyId = async () => {
        try {
          await navigator.clipboard.writeText(item.id)
          setCopied(true)
          window.clearTimeout(copyTimer.current)
          copyTimer.current = window.setTimeout(() => { setCopied(false) }, 1500)
        } catch (cause) {
          onError(cause)
        }
      }

      const header = h('header', { className: 'dsh-todo-dialogHead' },
        h('span', { className: 'dsh-todo-dialogTitle' }, t('detail.title')),
        h('span', { className: 'dsh-todo-metaId', title: t('card.id', { id: item.id }) }, `#${shortId(item)}`),
        h('button', {
          type: 'button',
          className: 'dsh-todo-copyId',
          'aria-label': copied ? t('card.idCopied') : t('card.idCopy'),
          title: copied ? t('card.idCopied') : t('card.idCopy'),
          onClick: copyId,
        }, copied ? h(CheckGlyph) : h(CopyGlyph)),
        h('span', { className: 'dsh-todo-dialogActions' },
          h('button', {
            type: 'button',
            className: 'dsh-todo-iconButton',
            'aria-label': maximized ? t('detail.restore') : t('detail.maximize'),
            title: maximized ? t('detail.restore') : t('detail.maximize'),
            onClick: () => { setMaximized(value => !value) },
          }, maximized ? h(RestoreGlyph) : h(MaximizeGlyph)),
          h('button', {
            type: 'button',
            className: 'dsh-todo-iconButton',
            'aria-label': t('detail.close'),
            title: t('detail.close'),
            onClick: onClose,
          }, h(CloseGlyph))))

      const meta = h('dl', { className: 'dsh-todo-detailMeta' },
        h('div', null,
          h('dt', null, t('detail.ai')),
          h('dd', null, item.done ? t('card.aiDone') : t('card.aiOpen'))),
        h('div', null,
          h('dt', null, t('detail.confirmation')),
          h('dd', null, item.confirmed ? t('card.confirmed') : t('card.pending'))),
        h('div', null,
          h('dt', null, t('detail.workspace')),
          h('dd', { title: item.workspacePath }, item.workspaceLabel)),
        h('div', null,
          h('dt', null, t('detail.updated')),
          h('dd', null, formatStamp(item.updatedAt))),
        h('div', null,
          h('dt', null, t('detail.created')),
          h('dd', null, formatStamp(item.createdAt))))

      const body = h('div', { className: 'dsh-todo-dialogBody' },
        h('div', { className: 'dsh-todo-detail' },
          h('h2', { className: 'dsh-todo-detailTitle' }, item.title),
          item.summary === '' ? null : h('p', { className: 'dsh-todo-detailSummary' }, item.summary),
          item.details === ''
            ? h('p', { className: 'dsh-todo-empty' }, t('detail.noDetails'))
            : h('div', { className: 'dsh-todo-md dsh-todo-detailBody' }, renderMarkdown(blocks)),
          meta))

      const footer = h('footer', { className: 'dsh-todo-dialogFoot' },
        h('span', { className: 'dsh-todo-hint' }, ''),
        h('button', {
          type: 'button',
          className: 'dsh-todo-outline',
          onClick: onClose,
        }, t('detail.close')))

      return h('dialog', {
        ref: dialogRef,
        className: 'dsh-todo-dialog',
        'data-maximized': maximized ? 'true' : 'false',
        'aria-label': t('detail.title'),
      }, h('div', { className: 'dsh-todo-dialogInner' }, header, body, footer))
    }

    /**
     * The page the sidebar launcher selects.
     *
     * It reads workspaces through the injected `useTodoWorkspaces` hook, the
     * Session cards send into through `currentSessionSource`, and the notebook
     * through the Host, and re-reads the Host on a short interval so a card the
     * agent wrote appears while the page is open. The page is read-only: a card
     * opens {@link TodoDetailDialog}, and the agent owns every change.
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
      const workspacesRef = React.useRef(workspaces)
      workspacesRef.current = workspaces

      const { items, error, adopt, report, refresh } = useBoardItems(board)
      const migrated = React.useRef(false)
      const [detailId, setDetailId] = React.useState(null)

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

      React.useEffect(() => {
        if (detailId === null || items === null) return
        if (!items.some(item => item.id === detailId)) setDetailId(null)
      }, [items, detailId])

      const openItems = React.useMemo(
        () => (items === null ? [] : items.filter(item => !item.confirmed)),
        [items],
      )
      const doneItems = React.useMemo(
        () => (items === null ? [] : items.filter(item => item.confirmed)),
        [items],
      )
      const groups = React.useMemo(
        () => groupItems(openItems, workspaces),
        [openItems, workspaces],
      )
      const detailItem = items === null || detailId === null
        ? undefined
        : items.find(item => item.id === detailId)

      const openDetail = (item) => { setDetailId(item.id) }

      const confirm = async (item) => {
        try {
          adopt(await board.update({ id: item.id, confirmed: !item.confirmed }))
        } catch (cause) {
          report(cause)
        }
      }

      const remove = async (item) => {
        if (!window.confirm(t('confirm.delete', { title: item.title }))) return
        try {
          adopt(await board.remove(item.id))
        } catch (cause) {
          report(cause)
        }
      }

      const clear = async (itemsToClear) => {
        if (itemsToClear.length === 0) return
        if (!window.confirm(t('confirm.clear', { count: itemsToClear.length }))) return
        try {
          adopt(await board.clear())
        } catch (cause) {
          report(cause)
        }
      }

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
                          className: 'dsh-todo-cards',
                          onOpenDetail: openDetail,
                          onSend: send,
                          onConfirm: confirm,
                          onDelete: remove,
                          canSend: sessionId !== undefined,
                          onError: report,
                        })))),
                  h(CompletedSection, {
                    key: 'done',
                    t,
                    items: doneItems,
                    className: 'dsh-todo-cards',
                    showWorkspace: true,
                    onOpenDetail: openDetail,
                    onSend: send,
                    onConfirm: confirm,
                    onDelete: remove,
                    onClear: clear,
                    canSend: sessionId !== undefined,
                    onError: report,
                  }),
                ])),
        detailItem === undefined ? null : h(TodoDetailDialog, {
          t,
          item: detailItem,
          onClose: () => { setDetailId(null) },
          onError: report,
        }))
    }

    /**
     * The right-Sidebar page: the cards of the workspace the shown Session
     * belongs to.
     *
     * The Session's workspace is resolved from the workspace catalog, so the
     * page follows the Session it was opened in: each Session's surface holds
     * its own tab, and the tab shows that Session's workspace only. Like the
     * page, it is read-only.
     *
     * @param props - `t`, the slot's `sessionId`, `useTodoWorkspaces` and `board`.
     * @returns the panel element.
     */
    function WorkspaceTodosPanel(props) {
      const { t, sessionId, useTodoWorkspaces, board } = props

      const workspaces = useTodoWorkspaces(snapshot => snapshot.items)
      const ready = useTodoWorkspaces(snapshot => snapshot.phase === 'ready')
      const { items, error, adopt, report } = useBoardItems(board)
      const [detailId, setDetailId] = React.useState(null)

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
        () => visible.filter(item => !item.confirmed),
        [visible],
      )
      const doneItems = React.useMemo(
        () => visible.filter(item => item.confirmed),
        [visible],
      )

      React.useEffect(() => {
        if (detailId === null || items === null) return
        if (!items.some(item => item.id === detailId)) setDetailId(null)
      }, [items, detailId])

      const detailItem = items === null || detailId === null
        ? undefined
        : items.find(item => item.id === detailId)

      const openDetail = (item) => { setDetailId(item.id) }

      const confirm = async (item) => {
        try {
          adopt(await board.update({ id: item.id, confirmed: !item.confirmed }))
        } catch (cause) {
          report(cause)
        }
      }

      const remove = async (item) => {
        if (!window.confirm(t('confirm.delete', { title: item.title }))) return
        try {
          adopt(await board.remove(item.id))
        } catch (cause) {
          report(cause)
        }
      }

      const clear = async (itemsToClear) => {
        if (itemsToClear.length === 0) return
        if (!window.confirm(t('confirm.clear', { count: itemsToClear.length }))) return
        try {
          adopt(await board.clear())
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
                      className: 'dsh-todo-panelCards',
                      onOpenDetail: openDetail,
                      onSend: send,
                      onConfirm: confirm,
                      onDelete: remove,
                      canSend: sessionId !== undefined,
                      onError: report,
                    }),
                  h(CompletedSection, {
                    key: 'done',
                    t,
                    items: doneItems,
                    className: 'dsh-todo-panelCards',
                    onOpenDetail: openDetail,
                    onSend: send,
                    onConfirm: confirm,
                    onDelete: remove,
                    onClear: clear,
                    canSend: sessionId !== undefined,
                    onError: report,
                  }),
                ],
          ],
        detailItem === undefined ? null : h(TodoDetailDialog, {
          t,
          item: detailItem,
          onClose: () => { setDetailId(null) },
          onError: report,
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
/* ---------------------------------------------------------- controls */
.dsh-todo-hint {
  flex: 1 1 auto;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
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
.dsh-todo-outline:focus-visible,
.dsh-todo-iconButton:focus-visible,
.dsh-todo-card:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
}
@media (hover: hover) {
  .dsh-todo-outline:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
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
  gap: 8px;
  box-sizing: border-box;
  width: 100%;
  padding: 3px 4px 3px 6px;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-md);
}
.dsh-todo-doneToggle {
  flex: 1 1 auto;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  padding: 4px;
  font: inherit;
  color: var(--dsw-alias-label-secondary);
  background: transparent;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  cursor: pointer;
  text-align: left;
}
.dsh-todo-doneClear {
  flex: none;
  height: 22px;
  padding: 0 8px;
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  color: var(--dsw-alias-state-error-primary);
  background: transparent;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
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
.dsh-todo-doneToggle:focus-visible,
.dsh-todo-doneClear:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
}
@media (hover: hover) {
  .dsh-todo-doneToggle:hover,
  .dsh-todo-doneClear:hover {
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
  cursor: pointer;
  transition: border-color 120ms ease;
}
.dsh-todo-card[data-done='true'] {
  background: var(--dsw-alias-bg-base);
}
@media (hover: hover) {
  .dsh-todo-card:hover {
    border-color: var(--dsw-alias-label-tertiary);
  }
}
.dsh-todo-cardHead {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.dsh-todo-ai {
  flex: none;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary);
}
.dsh-todo-ai[data-done='true'] {
  color: var(--dsw-alias-state-business-primary);
}
.dsh-todo-confirm {
  flex: none;
  height: 22px;
  padding: 0 8px;
  font: inherit;
  font-size: 12px;
  line-height: 16px;
  color: var(--dsw-alias-label-secondary);
  background: transparent;
  border: 0.5px solid var(--dsw-alias-border-l3);
  border-radius: var(--dsw-radius-sm);
  cursor: pointer;
}
.dsh-todo-confirm[aria-pressed='true'] {
  color: var(--dsw-alias-label-primary);
  background: var(--dsw-alias-bg-base);
}
.dsh-todo-confirm:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
}
@media (hover: hover) {
  .dsh-todo-confirm:hover {
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.dsh-todo-cardTitle {
  font-size: 14px;
  font-weight: 600;
  line-height: 21px;
  overflow-wrap: anywhere;
}
.dsh-todo-cardSummary {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}
.dsh-todo-card[data-done='true'] .dsh-todo-cardTitle,
.dsh-todo-card[data-done='true'] .dsh-todo-cardSummary {
  color: var(--dsw-alias-label-tertiary);
}
.dsh-todo-cardActions {
  flex: none;
  display: inline-flex;
  gap: 2px;
  margin-left: auto;
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
.dsh-todo-iconButton:disabled {
  opacity: 0.35;
  cursor: default;
}
.dsh-todo-iconButton[data-variant='danger'] {
  color: var(--dsw-alias-state-error-primary);
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
.dsh-todo-copyId {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 17px;
  margin-left: -6px;
  padding: 0;
  color: var(--dsw-alias-label-tertiary);
  background: transparent;
  border: 0;
  border-radius: var(--dsw-radius-sm);
  cursor: pointer;
}
@media (hover: hover) {
  .dsh-todo-copyId:hover {
    color: var(--dsw-alias-label-primary);
    background: var(--dsw-alias-interactive-bg-hover);
  }
}
.dsh-todo-copyId:focus-visible {
  outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary));
  outline-offset: 1px;
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
/* -------------------------------------------------------- detail dialog */
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
.dsh-todo-detail {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding-right: 4px;
}
.dsh-todo-detailTitle {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  line-height: 24px;
  overflow-wrap: anywhere;
}
.dsh-todo-detailSummary {
  margin: 8px 0 0;
  color: var(--dsw-alias-label-secondary);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}
.dsh-todo-detailBody {
  margin-top: 16px;
}
.dsh-todo-detailMeta {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 6px 12px;
  margin: 20px 0 0;
  padding-top: 12px;
  border-top: 0.5px solid var(--dsw-alias-border-l3);
  font-size: 12px;
  line-height: 18px;
}
.dsh-todo-detailMeta > div {
  display: contents;
}
.dsh-todo-detailMeta dt {
  color: var(--dsw-alias-label-tertiary);
}
.dsh-todo-detailMeta dd {
  margin: 0;
  color: var(--dsw-alias-label-secondary);
  overflow-wrap: anywhere;
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
          clear: () => callBoard(ctx, { action: 'clear', confirmed: true }),
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
