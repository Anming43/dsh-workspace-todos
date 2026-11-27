# dsh-workspace-todos

One shared todo notebook for every workspace in
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): the agent
maintains the todos through a tool, and people read them on a card board — title
and summary on the card, the full details in a dialog.

[中文说明](README.zh.md)

## What it gives you

- **One notebook, every workspace.** A todo carries the workspace directory it
  belongs to; the page groups open cards by workspace in the same order the
  sidebar lists workspaces. Nothing is per-session, so a todo added in one
  conversation is visible from every other one.
- **Title, summary, details.** Every todo is three fields: a one-line title, a
  short plain-text summary and a Markdown body of details. The card shows the
  first two; the details open in a dialog when the card is clicked.
- **Read-only for people.** The page has no add, edit, tick or delete control.
  The agent owns every change through the `workspace_todos` tool, so the board
  always reflects what the agent wrote. Clicking a card opens the read-only
  detail dialog — resizable from its corner, maximisable, Esc closes it.
- **Completed work folds away.** A completed card leaves its workspace group and
  moves into one *Completed* area at the bottom, collapsed by default; the
  right-Sidebar panel keeps the same area for its workspace only.
- **Newest edit first.** Every card stores when it was last modified
  (`updatedAt`, shown as `2026-11-25 17:40`), and both surfaces list cards
  newest-modified first.
- **A short id on every card.** The badge is the first eight hex digits of the
  stored UUID — stable, unique without a counter, and derived, so records
  written earlier have one too. A small control beside it copies the full id.
- **Two controls per card.** *Execute todo* sends the card into a Session as an
  ordinary user message asking the agent to do the work; *Explain todo* sends
  the same card asking what it means first, without changing anything. Both
  carry the id, workspace, status, modification time, title, summary and
  details.
- **Three surfaces, one store.**
  - a launcher in the left sidebar that opens the whole board in the centre
    column;
  - a right-Sidebar tab scoped to the Session's workspace;
  - plain JSON on disk, if you prefer to edit it by hand.

## Install

Requirements: a DeepSeek Harness installation that supports bundles. This was
built and verified against the Desktop app (DSH `0.2.2-rc.5`, profile
`desktop`).

Clone the repository, then install the directory as a bundle:

- **From the app**: **Plugins** → **Add plugin** → choose this directory; or
- **From a conversation**: ask the agent to install the local directory, which
  uses the `plugin_manager` tool with `action: "install_bundle"` and the
  absolute path of the checkout.

After it activates:

- **Plugins** lists *Workspace todos* with its own icon;
- the left sidebar gains a checklist entry (*跨工作区待办本*);
- the right Sidebar's add control lists *Workspace todos* in its guide;
- every session's agent can call `workspace_todos`.

No build step and no dependencies: `client.js` is authored directly in the form
the Web shell's module loader consumes, and `index.js` imports only `node:`
builtins.

## Using it

**Left sidebar → Workspace todos** opens the full board in the centre column:
one group per workspace, a card per todo showing its status, title, summary and
metadata. Clicking a card opens its detail dialog with the Markdown body, the
status, workspace, update and creation times, and a copy control for the id.
**Back to conversation** returns to the chat.

**Right Sidebar → + → Workspace todos** opens a panel scoped to the shown
Session's workspace: it lists only that workspace's cards, with the same detail
dialog. Each Session's surface owns its own tab.

Both surfaces re-read the notebook every few seconds, so a change the agent
makes appears without a reload.

## Agent tool

| action | arguments | effect |
|---|---|---|
| `list` | `workspace` (optional filter: path, path fragment, or label) | returns every card, or the matching ones, newest-modified first |
| `add` | `title`, `workspace` (absolute directory), `summary` and `details` (optional), `label` (optional, defaults to the directory name) | appends one open card |
| `update` | `id` plus any of `title`, `summary`, `details`, `done`, `workspace`, `label` | changes that card; an empty `summary` or `details` clears it |
| `remove` | `id` | deletes that card |

Every action returns the complete notebook — title, summary and Markdown
details included — ordered newest-modified first. Ids come from a previous
result.

## Storage

The notebook is one file:

```
<DSH_HOME>/workspace-todos.json
```

```json
{
  "version": 1,
  "items": [
    {
      "id": "…uuid…",
      "workspacePath": "D:\\work\\alpha",
      "workspaceLabel": "alpha",
      "title": "写接口文档",
      "summary": "先补上鉴权和错误码两节",
      "details": "## 范围\n\n- 登录\n- 刷新 token",
      "done": false,
      "createdAt": "2026-11-25T08:00:00.000Z",
      "updatedAt": "2026-11-25T09:40:00.000Z"
    }
  ]
}
```

- A missing file is an empty notebook and is created on the first write. A file
  that is not this envelope, or carries another version, is reported instead of
  being silently replaced.
- Writes go to a temporary file and are published with one `rename`; operations
  are serialized, so concurrent writers cannot interleave a read and a write.
- Every operation re-reads the file before changing it, so a hand edit is picked
  up by the next page poll and the next tool call.
- Records written before the split have one `text` body: it is read as
  `details`, the title is derived from its first non-empty line, and the summary
  starts empty. The next write stores the three fields and drops `text`.
- `updatedAt` is rewritten on every change. A record written by 1.0.0 has only
  `createdAt`, which stands in for it until the next write stores both.
- The file keeps records in the order they were added; `list` and both surfaces
  sort by `updatedAt` instead of trusting that order.
- The `#` badge is derived from `id`, not stored.
- The page talks to the Host through the exact Fetch route
  `/api/workspace-todos` on Connection's shared channel, behind the browser's
  authentication fence.

## Markdown subset

Only the `details` field is Markdown. Supported: paragraphs and line breaks,
`#`–`######` headings, `-`/`*`/`+` and `1.` lists, `>` quotes, fenced code,
inline code, bold, italic, strikethrough, and links with an `http(s):` or
`mailto:` target. Everything else — tables, images, nested lists, reference
links, task-list checkboxes, HTML, escapes — is rendered as plain text.

## Limitations

- People cannot add, edit, complete or delete from the page: that is the point
  of this release. Ask the agent, or edit the JSON file directly.
- One file, one notebook: two DSH processes sharing one `DSH_HOME` write the
  same file, with no cross-process lock (last writer wins per operation).
- Surfaces poll every 3 seconds rather than receiving a push, so a change the
  agent makes can lag by up to that interval.
- The *Completed* area starts folded every time a surface mounts; its open state
  is not remembered.
- The centre page sends into the last conversation it saw on screen. With no
  conversation opened since startup, both controls stay disabled; the
  right-Sidebar panel always has its own Session.
- A sent card becomes a normal user message in that Session: *Execute* starts a
  turn if the Session is idle, and there is no undo beyond deleting the message;
  *Explain* asks the agent to leave the card open.
- A workspace that was deleted keeps the label captured when its first card was
  added and sorts after the live ones.
- Written against the installed bundle API of DSH `0.2.2-rc.5`; other releases
  may need small adjustments.

## Repository layout

```
.
├── package.json        bundle manifest (dsh.bundle.patch, dsh.client)
├── cordis.patch.yml    inserts the single Host row
├── index.js            Host half: file store, Fetch route, agent tool
├── client.js           browser half: launcher, centre page, right-Sidebar tab
├── locale/en.json      Plugin Manager title and description (English)
├── locale/zh.json      Plugin Manager title and description (Chinese)
└── icon.svg            plugin icon
```

## Verification

Checked for 2.0.0: `node --check` on both entry points; the Host harness against
a throwaway `DSH_HOME` — add with the split fields, update and clearing of
summary/details, the stored JSON shape, newest-first ordering, a record written
with only `text` read as details with a derived title and rewritten in the split
form, foreign-version and malformed refusals, workspace filters, remove, and the
Fetch envelope; the load-and-apply pass over the browser half; and the locale
dictionary parity check (38 keys per language).

Checked for 1.4.0 and earlier: the Host harness for the previous record shape,
the browser-half registration pass, a Markdown parser suite, a render pass with
a minimal React stand-in, and live use in the Desktop app for 1.0.0.

**Not verified:** the card layout, the id badge, the copy control, the two card
controls and the detail dialog have not been looked at in a running app — no
browser control was available here. The send paths follow the composer's own
`Session.prompt` call and the last-on-screen Session source, but a live send has
not been exercised; the dialog's resize grip and maximise state have likewise
not been observed.

## License

MIT — see [LICENSE](LICENSE).
