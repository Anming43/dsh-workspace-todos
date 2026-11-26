# dsh-workspace-todos

One shared todo notebook for every workspace in
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), with cards
the human edits and a tool the agent edits — both on the same JSON file.

[中文说明](README.zh.md)

## What it gives you

- **One notebook, every workspace.** A todo carries the workspace directory it
  belongs to; the page groups open cards by workspace in the same order the
  sidebar lists workspaces. Nothing is per-session, so a todo added in one
  conversation is visible from every other one.
- **Completed work folds away.** Ticking a card moves it out of its workspace
  group into one *Completed* area at the bottom of the page, collapsed by
  default; the right-Sidebar panel keeps the same area for its workspace only.
  Its header shows the count and opens or closes the cards.
- **Newest edit first.** Every card stores when it was last modified
  (`updatedAt`, shown on the card as `2026-11-25 17:40`), and both surfaces list
  cards newest-modified first, so whatever was just touched rises to the top.
- **A short id on every card.** Each card carries a generated id — the badge is
  the first eight hex digits of the stored UUID, stable for the card's lifetime
  and unique without a counter. The badge is what you quote; the agent sees the
  full id in tool results.
- **A real editor, not a text field in the card.** The pencil opens a large
  modal over the window: drag its bottom-right corner to resize it, the
  maximise button fills the screen, Esc or Close discards the draft and
  Ctrl/Cmd+Enter saves. The dialog is a native `<dialog>` in the browser's top
  layer, so the rest of the page stays inert while it is open.
- **Two controls per card.** *Execute todo* sends the card into a Session as an
  ordinary user message asking the agent to do the work; *Explain todo* sends
  the same card asking the agent to explain it first — what it asks for, why,
  which files or steps it touches, what is unclear — and to change nothing. Both
  carry the id, workspace, status and modification time, so the agent can find
  the card again and close it with the `workspace_todos` tool.
- **Cards with Markdown bodies.** Paragraphs, headings, bullet and numbered
  lists, quotes, fenced code, `inline code`, **bold**, *italic*,
  ~~strikethrough~~ and http(s)/mailto links. Parsed into React elements — no
  HTML injection.
- **The agent can read and write the same list.** A `workspace_todos` tool is
  registered for every session: `list`, `add`, `update` (text or completion),
  `remove`. What the agent writes appears in the open page within a few seconds.
- **Three surfaces, one store.**
  - a launcher in the left sidebar that opens the whole board in the centre
    column;
  - a right-Sidebar tab that shows only the workspace the shown Session belongs
    to;
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
one group per workspace, a card per todo, an add card at the top (pick the
workspace, Ctrl/Cmd+Enter adds), a checkbox for done, a pencil that opens the
Markdown editor dialog, a bin to delete. **Back to conversation** returns to
the chat.
Ticking a card moves it into the *Completed* area at the bottom, which starts
folded; its header reopens the card, and unticking it there puts the card back
among the open ones. Two card controls send it into the last conversation that
was on screen (the page itself has no Session of its own): the play control
(*Execute todo*) asks the agent to do the work, the question control (*Explain
todo*) asks what it means first. The right-Sidebar panel sends into the Session
that panel belongs to. After a send the control turns into a checkmark for a few
seconds; a failure shows in the page's error line.

**Right Sidebar → + → Workspace todos** opens a panel scoped to the shown
Session's workspace: it lists only that workspace's cards and adds new ones
there. Each Session's surface owns its own tab, so switching Sessions shows that
Session's workspace.

## Agent tool

| action | arguments | effect |
|---|---|---|
| `list` | `workspace` (optional filter: path, path fragment, or label) | returns every card, or the matching ones |
| `add` | `text`, `workspace` (absolute directory), `label` (optional, defaults to the directory name) | appends one open card |
| `update` | `id` plus any of `text`, `done`, `workspace`, `label` | changes that card |
| `remove` | `id` | deletes that card |

Every action returns the complete notebook, so the model always sees the current
state, ordered newest-modified first and carrying each card's `updatedAt`. Ids
come from a previous result.

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
      "text": "写接口文档",
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
- `updatedAt` is rewritten on every change. A record written by 1.0.0 has only
  `createdAt`, which stands in for it until the next write stores both.
- The file keeps records in the order they were added; `list` and both surfaces
  sort by `updatedAt` instead of trusting that order.
- The `#` badge is derived from `id`, not stored: no extra field, and a record
  written before the badge existed still shows one.
- The page talks to the Host through the exact Fetch route
  `/api/workspace-todos` on Connection's shared channel, behind the browser's
  authentication fence.

## Markdown subset

Supported: paragraphs and line breaks, `#`–`######` headings, `-`/`*`/`+` and
`1.` lists, `>` quotes, fenced code, inline code, bold, italic, strikethrough,
and links with an `http(s):` or `mailto:` target. Everything else — tables,
images, nested lists, reference links, task-list checkboxes, HTML, escapes — is
rendered as plain text.

## Limitations

- One file, one notebook: two DSH processes sharing one `DSH_HOME` write the
  same file, with no cross-process lock (last writer wins per operation).
- A card is Markdown text plus completion and workspace: no due date, priority,
  tags, attachments or manual ordering — the order is always the last
  modification time.
- The *Completed* area starts folded every time a surface mounts; its open state
  is not remembered between visits.
- The centre page sends into the last conversation it saw on screen. With no
  conversation opened since startup, both controls stay disabled; the
  right-Sidebar panel always has its own Session.
- A sent card becomes a normal user message in that Session: *Execute* starts a
  turn if the Session is idle, and there is no undo beyond deleting the message.
  *Explain* asks the agent to leave the card open.
- Surfaces poll every 3 seconds rather than receiving a push, so a change the
  agent makes can lag by up to that interval.
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

Checked for 1.3.0: `node --check` on both entry points; the Host harness
(unchanged by the editor); the load-and-apply pass over the browser half; and a
static review of the editor — a native `<dialog>` opened with `showModal()`, a
`cancel` listener that maps Escape to the cancel path, Ctrl/Cmd+Enter on the
textarea, and the dialog mounted by both surfaces from the shared editing state.

Checked for 1.2.0: `node --check` on both entry points; the Host harness against
a throwaway `DSH_HOME` (unchanged by this release, still covering the store,
timestamps, ordering and the Fetch envelope); and the load-and-apply pass over
the browser half, which now also supplies `sessions` and `uiSession` and proves
the three slot registrations.

Checked for 1.1.0: `node --check` on both entry points; the Host harness run
against a throwaway `DSH_HOME` — add/update/remove, workspace filters, refusals,
foreign-version and malformed files, `updatedAt` written on add and on every
update, newest-modified-first ordering, a 1.0.0 record upgraded on the next
write, and the client-request envelope on the Fetch route; and a load-and-apply
pass over the browser half that proves the factory id, the injected services and
the three slot registrations without rendering anything.

The 1.0.0 release was additionally checked with the installed
`@deepseek-ai/dsh-tools` schema checks, a Markdown parser suite, a render pass
with a minimal React stand-in, and live use in the Desktop app (activation, tool
round trip, authenticated route, centre page).

**Not verified:** the folded *Completed* area, the timestamp line, the id badge,
the two card controls and the editor dialog have not been looked at in a running
app — no browser control was available here. Both send paths follow the
composer's own `Session.prompt` call and the last-on-screen Session source, but
a live send has not been exercised; the dialog's resize grip and maximise state
have likewise not been observed.

## License

MIT — see [LICENSE](LICENSE).
