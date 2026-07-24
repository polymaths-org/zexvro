/** @jsxImportSource @opentui/solid */
/**
 * Morph TUI — ZEXVRO link (project-first)
 *
 * Most people stay in one workspace and switch projects.
 * /use opens the project list for the current workspace — one enter to switch.
 * Workspace pick / create is a separate path.
 *
 * Folder link: <launch-dir>/.morph/project.json
 */
import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { BuiltinTuiPlugin } from "../builtins"
import { DialogSelect, type DialogSelectOption } from "../../ui/dialog-select"
import { DialogPrompt } from "../../ui/dialog-prompt"
import { createMemo, createSignal, onMount, Show } from "solid-js"
import { existsSync, readFileSync } from "node:fs"
import { basename, join } from "node:path"
import { pathToFileURL } from "node:url"

const id = "internal:zexvro-workspace"

type Ws = { id: string; name: string; members?: number; plan?: string; raw: Record<string, unknown> }
type Proj = { id: string; name: string; raw: Record<string, unknown> }

/** projects | workspaces | required | status */
type Mode = "projects" | "workspaces" | "required" | "status"
type Step = "project" | "workspace"

type DirLink = {
  workspaceId: string
  workspaceName: string
  projectId: string
  projectName: string
  path: string
}

type Action =
  | { kind: "pick-project"; proj: Proj }
  | { kind: "clear-project" }
  | { kind: "create-project" }
  | { kind: "change-workspace" }
  | { kind: "pick-workspace"; ws: Ws }
  | { kind: "create-workspace" }
  | { kind: "status-ok" }
  | { kind: "status-switch" }
  | { kind: "noop" }

// ─── live chrome state ───────────────────────────────────────────────────────

const [liveLink, setLiveLink] = createSignal<DirLink | null>(null)
const [liveUser, setLiveUser] = createSignal("")

function projectDir(): string {
  return (process.env.MORPH_PROJECT_DIR || process.cwd()).trim() || process.cwd()
}

function readDirLink(cwd = projectDir()): DirLink | null {
  const path = join(cwd, ".morph", "project.json")
  if (!existsSync(path)) return null
  try {
    const body = JSON.parse(readFileSync(path, "utf8"))
    const workspaceId = String(body.workspaceId || "").trim()
    if (!workspaceId) return null
    return {
      workspaceId,
      workspaceName: String(body.workspaceName || "").trim(),
      projectId: String(body.projectId || "").trim(),
      projectName: String(body.projectName || "").trim(),
      path,
    }
  } catch {
    return null
  }
}

function refreshLive() {
  setLiveLink(readDirLink())
}

function needsWorkspaceLink(cwd = projectDir()): boolean {
  return !readDirLink(cwd)?.workspaceId
}

function displayWorkspace(link: DirLink | null): string {
  if (!link) return ""
  return link.workspaceName || link.workspaceId
}

function displayProject(link: DirLink | null): string {
  if (!link) return ""
  return link.projectName || link.projectId || ""
}

/** Chrome: prefer project name (what people switch). */
function chromeLabel(link: DirLink | null): string {
  if (!link) return "link project"
  const proj = displayProject(link)
  const ws = displayWorkspace(link)
  if (proj && ws) return proj
  return proj || ws || "link project"
}

function chromeSub(link: DirLink | null): string {
  if (!link) return ""
  const proj = displayProject(link)
  const ws = displayWorkspace(link)
  if (proj && ws) return ws
  return ""
}

async function loadMorphLib() {
  const home = (process.env.MORPH_HOME || "").trim()
  if (!home) throw new Error("MORPH_HOME not set — start Morph via the morph launcher")
  const base = pathToFileURL(join(home, "lib") + "/").href
  const [api, store, bind] = await Promise.all([
    import(new URL("zexvro-api.mjs", base).href),
    import(new URL("zexvro-store.mjs", base).href),
    import(new URL("project-bind.mjs", base).href),
  ])
  return { api, store, bind }
}

function workspaceIdOf(w: Record<string, unknown>): string {
  return String(w.id || w.workspaceId || w.pk || "")
}

function workspaceNameOf(w: Record<string, unknown>): string {
  return String(w.name || w.title || w.displayName || "").trim() || workspaceIdOf(w) || "Workspace"
}

function projectIdOf(p: Record<string, unknown>): string {
  return String(p.id || p.projectId || "")
}

function projectNameOf(p: Record<string, unknown>): string {
  return String(p.name || p.title || p.displayName || "").trim() || projectIdOf(p) || "Project"
}

function mapWorkspace(w: Record<string, unknown>): Ws {
  return {
    id: workspaceIdOf(w),
    name: workspaceNameOf(w),
    members: Array.isArray(w.members) ? w.members.length : undefined,
    plan: String(w.plan || "").trim() || undefined,
    raw: w,
  }
}

function mapProject(p: Record<string, unknown>): Proj {
  return { id: projectIdOf(p), name: projectNameOf(p), raw: p }
}

function updateTerminalTitle(api: TuiPluginApi, link: DirLink | null) {
  try {
    const folder = basename(projectDir())
    if (!link) {
      api.renderer.setTerminalTitle(`Morph · ${folder}`)
      return
    }
    const proj = displayProject(link)
    const ws = displayWorkspace(link)
    const mid = proj || ws
    api.renderer.setTerminalTitle(mid ? `Morph · ${mid} · ${folder}` : `Morph · ${folder}`)
  } catch {
    /* ignore */
  }
}

function promptText(
  api: TuiPluginApi,
  title: string,
  placeholder: string,
  description?: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false
    const finish = (v: string | null) => {
      if (settled) return
      settled = true
      resolve(v)
    }
    api.ui.dialog.replace(
      () => (
        <DialogPrompt
          title={title}
          placeholder={placeholder}
          description={
            description
              ? () => <text fg={api.theme.current.textMuted}>{description}</text>
              : undefined
          }
          onConfirm={(value) => finish(value.trim() || null)}
          onCancel={() => finish(null)}
        />
      ),
      () => finish(null),
    )
  })
}

// ─── chrome ──────────────────────────────────────────────────────────────────

function WorkspaceChip(props: { api: TuiPluginApi; compact?: boolean }) {
  const theme = () => props.api.theme.current
  const link = liveLink
  const main = createMemo(() => chromeLabel(link()))
  const sub = createMemo(() => chromeSub(link()))
  const linked = createMemo(() => Boolean(link()?.workspaceId))

  return (
    <box
      flexDirection="row"
      gap={1}
      flexShrink={0}
      onMouseDown={() => props.api.keymap.dispatchCommand("zexvro.use")}
    >
      <Show
        when={linked()}
        fallback={
          <text fg={theme().warning}>{props.compact ? "/use" : "link a project - /use"}</text>
        }
      >
        <text fg={theme().textMuted}>[</text>
        <text fg={theme().success || theme().text}>
          <b>{main()}</b>
        </text>
        <Show when={sub() && !props.compact}>
          <text fg={theme().textMuted}> · {sub()}</text>
        </Show>
        <text fg={theme().textMuted}>]</text>
      </Show>
    </box>
  )
}

function SidebarWorkspaceCard(props: { api: TuiPluginApi }) {
  const theme = () => props.api.theme.current
  const link = liveLink
  const user = liveUser
  const proj = createMemo(() => displayProject(link()))
  const ws = createMemo(() => displayWorkspace(link()))

  return (
    <box
      flexShrink={0}
      gap={0}
      paddingBottom={1}
      onMouseDown={() => props.api.keymap.dispatchCommand("zexvro.use")}
    >
      <text fg={theme().textMuted}>Project</text>
      <Show
        when={link()?.workspaceId}
        fallback={
          <text fg={theme().warning}>
            <b>Not linked</b> · /use
          </text>
        }
      >
        <text fg={theme().text}>
          <b>{proj() || "No project"}</b>
        </text>
        <Show when={ws()}>
          <text fg={theme().textMuted}>in {ws()}</text>
        </Show>
      </Show>
      <Show when={user()}>
        <text fg={theme().textMuted}>{user()}</text>
      </Show>
      <text fg={theme().textMuted}>/use switch project</text>
    </box>
  )
}

// ─── picker (project-first) ──────────────────────────────────────────────────

function LinkPicker(props: {
  api: TuiPluginApi
  mode: Mode
  onLinked?: () => void
}) {
  const [step, setStep] = createSignal<Step>(
    props.mode === "workspaces" ? "workspace" : "project",
  )
  const [loading, setLoading] = createSignal(true)
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const [workspaces, setWorkspaces] = createSignal<Ws[]>([])
  const [projects, setProjects] = createSignal<Proj[]>([])
  const [activeWs, setActiveWs] = createSignal<Ws | null>(null)
  const [link, setLink] = createSignal<DirLink | null>(readDirLink())
  const [username, setUsername] = createSignal("")
  const [loggedIn, setLoggedIn] = createSignal(true)

  async function commitLink(ws: Ws, proj: Proj | null, quiet?: boolean) {
    const { store, bind } = await loadMorphLib()
    const cwd = projectDir()
    store.updateSession({
      workspaceId: ws.id,
      workspaceName: ws.name,
      projectId: proj?.id || "",
      projectName: proj?.name || "",
    })
    const written = bind.writeProjectBind(
      {
        workspaceId: ws.id,
        workspaceName: ws.name,
        projectId: proj?.id || "",
        projectName: proj?.name || "",
      },
      cwd,
    )
    const next: DirLink = {
      workspaceId: ws.id,
      workspaceName: ws.name,
      projectId: proj?.id || "",
      projectName: proj?.name || "",
      path: written.path,
    }
    setLink(next)
    setLiveLink(next)
    updateTerminalTitle(props.api, next)
    if (!quiet) {
      props.api.ui.toast({
        variant: "success",
        title: proj ? `Project: ${proj.name}` : `Workspace: ${ws.name}`,
        message: proj ? `in ${ws.name}` : "No project selected",
      })
    }
    props.onLinked?.()
    props.api.ui.dialog.clear()
  }

  async function loadProjectsFor(ws: Ws) {
    const { api } = await loadMorphLib()
    const listed = await api.listProjects(ws.id)
    let rows: Proj[] = []
    if (listed.ok) {
      rows = (listed.projects || [])
        .map((p: Record<string, unknown>) => mapProject(p))
        .filter((p: Proj) => p.id)
      // current project first
      const cur = readDirLink()?.projectId
      rows.sort((a, b) => {
        if (a.id === cur) return -1
        if (b.id === cur) return 1
        return a.name.localeCompare(b.name)
      })
    }
    setProjects(rows)
    setActiveWs(ws)
    setStep("project")
  }

  async function bootstrap() {
    const { api, store } = await loadMorphLib()
    const summary = store.sessionSummary()
    setLoggedIn(Boolean(summary.loggedIn))
    setUsername(summary.username || "")
    setLiveUser(summary.username || "")

    if (!summary.loggedIn) {
      setError("Not logged in. Exit Morph and run: morph login")
      return
    }

    const existing = readDirLink()
    setLink(existing)
    refreshLive()
    if (existing?.workspaceId) {
      try {
        store.updateSession({
          workspaceId: existing.workspaceId,
          workspaceName: existing.workspaceName,
          projectId: existing.projectId || "",
          projectName: existing.projectName || "",
        })
      } catch {
        /* ignore */
      }
    }

    if (props.mode === "status") return

    const listed = await api.listWorkspaces()
    if (!listed.ok) {
      setError(
        typeof listed.error === "string"
          ? listed.error
          : listed.note || `Failed to list workspaces (${listed.status || "?"})`,
      )
      return
    }

    const rows = (listed.workspaces || [])
      .map((w: Record<string, unknown>) => mapWorkspace(w))
      .filter((w: Ws) => w.id)
      .sort((a: Ws, b: Ws) => a.name.localeCompare(b.name))
    setWorkspaces(rows)

    // Resolve workspace for project-first path
    const preferId =
      existing?.workspaceId ||
      summary.workspaceId ||
      (rows.length === 1 ? rows[0].id : "")

    const forceWorkspaceStep =
      props.mode === "workspaces" ||
      (props.mode === "required" && rows.length > 1 && !preferId) ||
      (props.mode === "projects" && !preferId && rows.length !== 1)

    if (forceWorkspaceStep || !preferId) {
      // No workspace known → workspace list (or create)
      setStep("workspace")
      return
    }

    const ws =
      rows.find((w) => w.id === preferId) ||
      (existing
        ? { id: existing.workspaceId, name: existing.workspaceName || existing.workspaceId, raw: {} }
        : null)

    if (!ws?.id) {
      setStep("workspace")
      return
    }

    // Single workspace on first bind, or already linked → go straight to projects
    await loadProjectsFor(ws)
  }

  onMount(() => {
    void (async () => {
      try {
        await bootstrap()
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        setLoading(false)
      }
    })()
  })

  async function handleCreateProject() {
    const ws = activeWs()
    if (!ws) return
    setBusy(true)
    try {
      const name = await promptText(
        props.api,
        "New project name",
        "e.g. arcade, landing, api",
        `Created under ${ws.name} · then this folder links to it.`,
      )
      if (!name) {
        reopen(props.api, props.mode === "workspaces" ? "projects" : props.mode)
        return
      }
      const { api } = await loadMorphLib()
      const created = await api.createProject({ workspaceId: ws.id, name })
      if (!created.ok) {
        props.api.ui.toast({
          variant: "error",
          message: typeof created.error === "string" ? created.error : "Create failed",
        })
        reopen(props.api, "projects")
        return
      }
      let p = mapProject((created.project || {}) as Record<string, unknown>)
      if (!p.name) p = { ...p, name }
      if (!p.id) {
        const listed = await api.listProjects(ws.id)
        const hit = listed.ok
          ? (listed.projects || []).find((x: Record<string, unknown>) => projectNameOf(x) === name)
          : null
        if (hit) p = mapProject(hit)
      }
      await commitLink(ws, p.id ? p : { id: "", name, raw: {} })
    } catch (e) {
      props.api.ui.toast({
        variant: "error",
        message: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateWorkspace() {
    setBusy(true)
    try {
      const name = await promptText(
        props.api,
        "New workspace name",
        "e.g. Acme Labs",
        "Creates a workspace on your account.",
      )
      if (!name) {
        reopen(props.api, "workspaces")
        return
      }
      const { api } = await loadMorphLib()
      const created = await api.createWorkspace({ name })
      if (!created.ok) {
        props.api.ui.toast({
          variant: "error",
          message: typeof created.error === "string" ? created.error : "Create failed",
        })
        reopen(props.api, "workspaces")
        return
      }
      let w = mapWorkspace((created.workspace || {}) as Record<string, unknown>)
      if (!w.name) w = { ...w, name }
      if (!w.id) {
        const listed = await api.listWorkspaces()
        const hit = listed.ok
          ? (listed.workspaces || []).find((x: Record<string, unknown>) => workspaceNameOf(x) === name)
          : null
        if (hit) w = mapWorkspace(hit)
      }
      if (!w.id) {
        props.api.ui.toast({ variant: "error", message: "Created but missing id — try /use again" })
        reopen(props.api, "workspaces")
        return
      }
      props.api.ui.toast({ variant: "success", title: "Workspace ready", message: w.name })
      setLoading(true)
      await loadProjectsFor(w)
      setLoading(false)
      // stay in dialog on project step — re-render by replacing with projects mode
      props.api.ui.dialog.replace(() => (
        <LinkPicker api={props.api} mode="projects" onLinked={props.onLinked} />
      ))
    } catch (e) {
      props.api.ui.toast({
        variant: "error",
        message: e instanceof Error ? e.message : String(e),
      })
    } finally {
      setBusy(false)
    }
  }

  const title = createMemo(() => {
    if (props.mode === "status") return "This folder"
    if (busy()) return "Working…"
    if (step() === "project") {
      const ws = activeWs()
      const cur = displayProject(link())
      if (ws) {
        return cur ? `Switch project  ·  ${ws.name}` : `Pick a project  ·  ${ws.name}`
      }
      return "Pick a project"
    }
    if (props.mode === "required") return "Set up this folder"
    return "Change workspace"
  })

  const options = createMemo<DialogSelectOption<Action>[]>(() => {
    if (props.mode === "status") {
      const cur = link()
      const proj = displayProject(cur)
      const ws = displayWorkspace(cur)
      return [
        {
          title: proj || ws || "Not linked",
          value: { kind: "status-ok" },
          description: proj && ws ? `in ${ws}` : username() ? `as ${username()}` : "ZEXVRO",
          details: [
            ws ? `Workspace: ${ws}` : "No workspace",
            cur?.path ? `Linked: ${basename(projectDir())}` : `Folder: ${basename(projectDir())}`,
          ],
          category: "Now",
        },
        {
          title: "Switch project",
          value: { kind: "status-switch" },
          description: "/use",
          category: "Next",
        },
      ]
    }

    if (loading() || busy()) {
      return [
        {
          title: busy() ? "Working…" : "Loading…",
          value: { kind: "noop" },
          disabled: true,
          category: " ",
        },
      ]
    }

    if (error()) {
      return [
        {
          title: !loggedIn() ? "Login required" : "Something went wrong",
          value: { kind: "noop" },
          description: error() || undefined,
          disabled: true,
          category: " ",
        },
      ]
    }

    // ── PROJECT LIST (main) ──────────────────────────────────────────
    if (step() === "project") {
      const ws = activeWs()!
      const curId = link()?.projectId || ""
      const rows: DialogSelectOption<Action>[] = []

      // Current first (if any) already sorted — list is the main content
      for (const p of projects()) {
        const active = p.id === curId
        rows.push({
          title: p.name,
          value: { kind: "pick-project", proj: p },
          description: active ? "linked to this folder" : undefined,
          category: "Projects",
        })
      }

      if (projects().length === 0) {
        rows.push({
          title: "No projects yet",
          value: { kind: "noop" },
          description: "Create one below",
          disabled: true,
          category: "Projects",
        })
      }

      // Clean ASCII labels — no fullwidth plus / emoji (terminals often garble them)
      rows.push({
        title: "New project",
        value: { kind: "create-project" },
        description: "Create and link this folder",
        category: "Actions",
      })
      rows.push({
        title: "Folder only",
        value: { kind: "clear-project" },
        description: "Workspace link, no project",
        category: "Actions",
      })
      rows.push({
        title: "Change workspace",
        value: { kind: "change-workspace" },
        description: "Pick another workspace",
        category: "Actions",
      })

      return rows
    }

    // ── WORKSPACE LIST ───────────────────────────────────────────────
    const rows: DialogSelectOption<Action>[] = []
    const curId = link()?.workspaceId || ""

    if (workspaces().length === 0) {
      rows.push({
        title: "Create workspace",
        value: { kind: "create-workspace" },
        description: "First workspace for this account",
        category: "Workspaces",
      })
      return rows
    }

    for (const w of workspaces()) {
      const active = w.id === curId
      rows.push({
        title: w.name,
        value: { kind: "pick-workspace", ws: w },
        description: active ? "current" : w.plan || undefined,
        category: "Workspaces",
      })
    }

    rows.push({
      title: "New workspace",
      value: { kind: "create-workspace" },
      description: "Create a new ZEXVRO workspace",
      category: "Actions",
    })

    return rows
  })

  return (
    <DialogSelect
      title={title()}
      placeholder={step() === "project" ? "Filter projects..." : "Filter..."}
      options={options()}
      onSelect={(item) => {
        if (item.disabled) return
        const v = item.value as Action
        if (!v || v.kind === "noop") return

        if (v.kind === "status-ok") {
          props.api.ui.dialog.clear()
          return
        }
        if (v.kind === "status-switch") {
          reopen(props.api, "projects")
          return
        }

        if (v.kind === "pick-project") {
          const ws = activeWs()
          if (!ws) return
          void commitLink(ws, v.proj)
          return
        }
        if (v.kind === "clear-project") {
          const ws = activeWs()
          if (!ws) return
          void commitLink(ws, null)
          return
        }
        if (v.kind === "create-project") {
          void handleCreateProject()
          return
        }
        if (v.kind === "change-workspace") {
          setStep("workspace")
          // force re-render of options
          setProjects([...projects()])
          return
        }
        if (v.kind === "pick-workspace") {
          void (async () => {
            setLoading(true)
            try {
              await loadProjectsFor(v.ws)
            } finally {
              setLoading(false)
            }
          })()
          return
        }
        if (v.kind === "create-workspace") {
          void handleCreateWorkspace()
        }
      }}
    />
  )
}

// ─── open helpers ────────────────────────────────────────────────────────────

let requiredOpen = false
let loginWarned = false

function reopen(api: TuiPluginApi, mode: Mode) {
  openPicker(api, mode === "required" ? "required" : mode)
}

function openPicker(api: TuiPluginApi, mode: Mode) {
  if (mode === "required") {
    if (requiredOpen) return
    requiredOpen = true
  }

  api.ui.dialog.replace(
    () => (
      <LinkPicker
        api={api}
        mode={mode}
        onLinked={() => {
          if (mode === "required") requiredOpen = false
          refreshLive()
          updateTerminalTitle(api, readDirLink())
        }}
      />
    ),
    () => {
      if (mode !== "required") return
      requiredOpen = false
      if (needsWorkspaceLink()) {
        setTimeout(() => ensureDirLinked(api), 80)
      }
    },
  )
}

async function ensureDirLinked(api: TuiPluginApi) {
  refreshLive()
  updateTerminalTitle(api, readDirLink())

  if (!needsWorkspaceLink()) {
    try {
      const { store } = await loadMorphLib()
      const existing = readDirLink()
      if (existing && store.isLoggedIn()) {
        store.updateSession({
          workspaceId: existing.workspaceId,
          workspaceName: existing.workspaceName,
          projectId: existing.projectId || "",
          projectName: existing.projectName || "",
        })
        setLiveUser(store.sessionSummary().username || "")
      }
    } catch {
      /* ignore */
    }
    return
  }

  try {
    const { store } = await loadMorphLib()
    if (!store.isLoggedIn()) {
      if (!loginWarned) {
        loginWarned = true
        api.ui.toast({
          variant: "warning",
          title: "ZEXVRO login required",
          message: "Exit Morph → morph login → reopen.",
        })
      }
      return
    }
  } catch {
    return
  }

  openPicker(api, "required")
}

// ─── plugin ──────────────────────────────────────────────────────────────────

const tui: TuiPlugin = async (api) => {
  refreshLive()
  try {
    const { store } = await loadMorphLib()
    if (store.isLoggedIn()) setLiveUser(store.sessionSummary().username || "")
  } catch {
    /* ignore */
  }
  updateTerminalTitle(api, readDirLink())

  const timer = setInterval(() => {
    const next = readDirLink()
    const prev = liveLink()
    if (JSON.stringify(next) !== JSON.stringify(prev)) {
      setLiveLink(next)
      updateTerminalTitle(api, next)
    }
  }, 2000)

  api.lifecycle.onDispose(() => clearInterval(timer))

  setTimeout(() => {
    void ensureDirLinked(api)
  }, 450)

  api.slots.register({
    order: 10,
    slots: {
      home_prompt_right() {
        return <WorkspaceChip api={api} compact />
      },
      session_prompt_right() {
        return <WorkspaceChip api={api} compact />
      },
      home_bottom() {
        return (
          <box paddingLeft={2} paddingRight={2} paddingBottom={1} flexDirection="row" gap={1}>
            <text fg={api.theme.current.textMuted}>project</text>
            <WorkspaceChip api={api} />
            <text fg={api.theme.current.textMuted}>/use</text>
          </box>
        )
      },
      sidebar_content() {
        return <SidebarWorkspaceCard api={api} />
      },
    },
  })

  api.keymap.registerLayer({
    commands: [
      {
        name: "zexvro.use",
        title: "Switch project",
        desc: "Pick a project in this workspace (one click)",
        category: "ZEXVRO",
        namespace: "palette",
        suggested: true,
        slashName: "use",
        slashAliases: ["project", "projects", "p", "link"],
        run() {
          openPicker(api, "projects")
        },
      },
      {
        name: "zexvro.bind",
        title: "Switch project",
        desc: "Same as /use",
        category: "ZEXVRO",
        namespace: "palette",
        slashName: "bind",
        run() {
          openPicker(api, "projects")
        },
      },
      {
        name: "zexvro.workspace",
        title: "Change workspace",
        desc: "Switch or create a workspace",
        category: "ZEXVRO",
        namespace: "palette",
        slashName: "workspace",
        slashAliases: ["ws"],
        run() {
          openPicker(api, "workspaces")
        },
      },
      {
        name: "zexvro.status",
        title: "Folder link status",
        desc: "What project this folder is linked to",
        category: "ZEXVRO",
        namespace: "palette",
        slashName: "zexvro",
        slashAliases: ["whoami"],
        run() {
          openPicker(api, "status")
        },
      },
    ],
  })
}

const plugin: BuiltinTuiPlugin = {
  id,
  tui,
}

export default plugin
