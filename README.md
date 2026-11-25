# dsh-workspace-todos

One shared todo notebook for every workspace in
[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness), with cards
the human edits and a tool the agent edits — both on the same JSON file.

[中文说明](README.zh.md)

## What it gives you

- **One notebook, every workspace.** A todo carries the workspace directory it
  belongs to; the page groups cards by workspace in the same order the sidebar
  lists workspaces. Nothing is per-session, so a todo added in one conversation
  is visible from every other one.
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
workspace, Ctrl/Cmd+Enter adds), a checkbox for done, a pencil to edit the
Markdown source, a bin to delete. **Back to conversation** returns to the chat.

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
state. Ids come from a previous result.

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
      "createdAt": "2026-11-25T08:00:00.000Z"
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
  tags, attachments or reordering.
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

Checked while building this: `node --check` on both entry points; a stub-Cordis
harness over the Host half (registration, add/update/remove, filters, refusals,
corrupt and foreign-version files); the installed `@deepseek-ai/dsh-tools`
schema checks; a Markdown parser suite; and a render pass over both surfaces
with a minimal React stand-in. Live behaviour — activation, the tool round trip,
the authenticated route, and the centre page — was exercised in the Desktop app.
The right-Sidebar tab is covered by the render pass and by activation, but its
visual result has not been reviewed yet.

## License

MIT — see [LICENSE](LICENSE).
