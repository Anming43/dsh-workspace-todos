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
  first two; the details open in a dialog when the card is clicked. Status never
  lives in that text: a leading `已完成｜`, `进行中｜`, ✅, ✔ or `[x]` decoration is
  stripped from a title on write and on read, and the flags below carry it.
- **Two completion states.** `done` is the agent's own flag, set when its work is
  finished; `confirmed` is the user's acceptance, flipped by the *Confirm done*
  control on the card or by the agent when the user asks it to relay that. They
  are independent: a card can be AI-finished but still pending confirmation, and
  confirming it does not claim the AI finished.
- **Read-only for content, with three human actions.** The page has no add or
  edit control: the agent owns the title, summary, details and both flags through
  the `workspace_todos` tool. People confirm a card, delete one card, or clear
  the confirmed area; every destructive action asks first. Clicking a card opens
  the read-only detail dialog — resizable from its corner, maximisable, Esc
  closes it.
- **Confirmed work folds away.** A confirmed card leaves its workspace group and
  moves into one *Confirmed* area at the bottom, collapsed by default; the
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
one group per workspace, a card per todo showing the AI status, the *Confirm
done* control, title, summary and metadata. The bin on a card deletes that one
todo after a confirmation, and the *Clear* button on the *Confirmed* area deletes
every confirmed card in one go, also after a confirmation. Clicking a card opens
its detail dialog with the Markdown body, both statuses, the workspace, update
and creation times, and a copy control for the id. **Back to conversation**
returns to the chat.

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
| `update` | `id` plus any of `title`, `summary`, `details`, `done`, `confirmed`, `workspace`, `label` | changes that card; an empty `summary` or `details` clears it |
| `remove` | `id` | deletes that card |

`done` is the agent's own completion flag; `confirmed` records the user's
acceptance. The board's *Confirm* control flips `confirmed`, and the agent may
flip it too when the user asks it to relay that decision — the two flags stay
independent.

Deleting is separate: `remove` deletes one id and is also what the card's bin
calls. The page's bulk *Clear* uses a `clear` action that only the Host route
accepts — it is a page-only action, not in the tool's action enum, and it refuses
to run without the confirmed filter, so the agent cannot wipe the board by
accident.

A standing system-prompt section tells the model the same thing per step: finish
work with `done=true`, never write a status prefix into the title. Titles that
already have one are normalised on write and on read, so the board never shows
`已完成｜…` again.

Every action returns the complete notebook — title, summary, Markdown details
and both flags included — ordered newest-modified first. Ids come from a
previous result.

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
      "confirmed": false,
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
- A leading status decoration in `title` is stripped on read and on write, so an
  older file shows clean titles immediately and is rewritten without the prefix
  on its next write. A title that is nothing but a marker is kept rather than
  emptied.
- `done` is the agent's completion flag and `confirmed` is the user's; both are
  stored, and a record written before the flag existed reads as unconfirmed.
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

- People cannot add or edit content from the page: that is the point of this
  release. Confirming, deleting one card and clearing the confirmed area are the
  only human actions; the agent can do the same through the tool, and it also
  owns `done`. Deletes are permanent — neither the bin nor *Clear* has an undo.
- One file, one notebook: two DSH processes sharing one `DSH_HOME` write the
  same file, with no cross-process lock (last writer wins per operation).
- Surfaces poll every 3 seconds rather than receiving a push, so a change the
  agent makes can lag by up to that interval.
- The *Confirmed* area starts folded every time a surface mounts; its open state
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

Checked for 2.4.0: `node --check` on both entry points; the Host harness — the
page-only `clear` action removes only confirmed records, refuses to run without
the confirmed filter, rewrites the file, and stays out of the tool's action enum;
the browser-half pass calls `board.clear()` with `{ action: 'clear', confirmed:
true }`; plus the earlier title, flag and legacy-record checks, and the locale
parity check (47 keys per language).

Checked for 2.0.0: the Host harness against a throwaway `DSH_HOME` — add with
the split fields, update and clearing of summary/details, the stored JSON shape,
newest-first ordering, a record written with only `text` read as details with a
derived title and rewritten in the split form, foreign-version and malformed
refusals, workspace filters, remove, and the Fetch envelope.

Checked for 1.4.0 and earlier: the Host harness for the previous record shape,
the browser-half registration pass, a Markdown parser suite, a render pass with
a minimal React stand-in, and live use in the Desktop app for 1.0.0.

**Not verified:** the card layout, the two statuses and the confirm control, the
id badge, the copy control and the detail dialog have not been looked at in a
running app — no browser control was available here. The confirmation write goes
through the same board route as every other page call, but a live click has not
been exercised; the send paths and the dialog's resize grip likewise.

## License

MIT — see [LICENSE](LICENSE).
