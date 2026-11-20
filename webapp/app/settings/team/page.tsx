'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Users, Copy, Check, Plus, Trash2, ChevronDown } from 'lucide-react'

interface Member {
  id: string
  userId: string
  role: string
  joinedAt: string
  user: { id: string; name: string | null; email: string | null }
}

interface Invite {
  id: string
  email: string
  role: string
  token: string
  expiresAt: string
}

interface Workspace {
  id: string
  name: string
  ownerId: string
  members: Member[]
}

const ROLES = ['admin', 'member', 'viewer']

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    owner: 'bg-purple-50 text-purple-700',
    admin: 'bg-blue-50 text-blue-700',
    member: 'bg-gray-100 text-gray-600',
    viewer: 'bg-gray-50 text-gray-400',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${colors[role] ?? colors.member}`}>
      {role}
    </span>
  )
}

export default function TeamPage() {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? ''

  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [callerRole, setCallerRole] = useState<string>('viewer')
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create workspace state
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [inviting, setInviting] = useState(false)
  const [copied, setCopied] = useState(false)

  // Workspace name edit
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  // Delete confirm
  const [confirmDelete, setConfirmDelete] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    try {
      const userRes = await fetch('/api/auth/session')
      // Fetch workspace list to find active workspace
      const wsRes = await fetch('/api/workspaces')
      const wsData = await wsRes.json()

      // Find the user's active workspace from owned or member lists
      const user = await fetch('/api/settings/profile').then(r => r.ok ? r.json() : null)
      const activeId = user?.workspaceId

      if (!activeId) { setWorkspace(null); setLoading(false); return }

      const [detailRes, inviteRes] = await Promise.all([
        fetch(`/api/workspaces/${activeId}`),
        fetch(`/api/workspaces/${activeId}/invite`),
      ])
      if (detailRes.ok) {
        const ws: Workspace = await detailRes.json()
        setWorkspace(ws)
        setNameInput(ws.name)
        const myMember = ws.members.find((m) => m.userId === userId)
        setCallerRole(ws.ownerId === userId ? 'owner' : myMember?.role ?? 'viewer')
      }
      if (inviteRes.ok) setInvites(await inviteRes.json())
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { load() }, [load])

  async function createWorkspace() {
    if (!newName.trim()) return
    setCreating(true)
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    if (res.ok) { setNewName(''); await load() }
    setCreating(false)
  }

  async function sendInvite() {
    if (!workspace) return
    setInviting(true)
    const res = await fetch(`/api/workspaces/${workspace.id}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })
    const data = await res.json()
    if (res.ok) {
      setInviteLink(data.inviteLink)
      setInviteEmail('')
      await load()
    } else {
      setError(data.error ?? 'Failed to send invite')
    }
    setInviting(false)
  }

  async function revokeInvite(token: string) {
    if (!workspace) return
    await fetch(`/api/workspaces/${workspace.id}/invite`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    setInvites((prev) => prev.filter((i) => i.token !== token))
  }

  async function removeMember(memberId: string, targetUserId: string) {
    if (!workspace) return
    await fetch(`/api/workspaces/${workspace.id}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: targetUserId }),
    })
    await load()
  }

  async function changeRole(memberId: string, role: string) {
    if (!workspace) return
    await fetch(`/api/workspaces/${workspace.id}/members/${memberId}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    await load()
  }

  async function saveName() {
    if (!workspace || !nameInput.trim()) return
    await fetch(`/api/workspaces/${workspace.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nameInput.trim() }),
    })
    setEditingName(false)
    await load()
  }

  async function deleteWorkspace() {
    if (!workspace) return
    await fetch(`/api/workspaces/${workspace.id}`, { method: 'DELETE' })
    setWorkspace(null)
    setConfirmDelete(false)
  }

  async function leaveWorkspace() {
    if (!workspace) return
    await fetch(`/api/workspaces/${workspace.id}/members`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    })
    setWorkspace(null)
  }

  async function copyLink() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const canAdmin = callerRole === 'owner' || callerRole === 'admin'

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>

  return (
    <div className="p-8 max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Users className="w-6 h-6" /> Team
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Manage your workspace and invite teammates to collaborate.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      {!workspace ? (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-1">Create a workspace</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Create a workspace to invite teammates and share campaigns, leads, and templates.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Workspace name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createWorkspace()}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
            <button
              onClick={createWorkspace}
              disabled={creating || !newName.trim()}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Workspace Info */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Current workspace</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Name</label>
                {editingName && canAdmin ? (
                  <div className="flex gap-2 mt-1">
                    <input
                      type="text"
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    />
                    <button onClick={saveName} className="px-3 py-1.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">Save</button>
                    <button onClick={() => setEditingName(false)} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{workspace.name}</span>
                    {canAdmin && (
                      <button onClick={() => setEditingName(true)} className="text-xs text-blue-600 hover:underline">Edit</button>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Workspace ID</label>
                <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-0.5">{workspace.id}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Your role</label>
                <div className="mt-0.5"><RoleBadge role={callerRole} /></div>
              </div>
            </div>
          </div>

          {/* Members */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Members</h2>
            <div className="space-y-2">
              {workspace.members.map((m) => {
                const isOwnerMember = m.userId === workspace.ownerId
                const displayRole = isOwnerMember ? 'owner' : m.role
                return (
                  <div key={m.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-200 flex-shrink-0">
                      {(m.user.name ?? m.user.email ?? '?')[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{m.user.name ?? m.user.email}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{m.user.email}</p>
                    </div>
                    {canAdmin && !isOwnerMember ? (
                      <select
                        value={m.role}
                        onChange={(e) => changeRole(m.id, e.target.value)}
                        className="text-xs border border-gray-200 dark:border-gray-700 rounded-lg px-2 py-1 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                      >
                        {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    ) : (
                      <RoleBadge role={displayRole} />
                    )}
                    {!isOwnerMember && (canAdmin || m.userId === userId) && (
                      <button
                        onClick={() => removeMember(m.id, m.userId)}
                        className="text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
                        title={m.userId === userId ? 'Leave workspace' : 'Remove member'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Invite */}
          {canAdmin && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Invite member</h2>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
                <div className="relative">
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    className="appearance-none pl-3 pr-7 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button
                  onClick={sendInvite}
                  disabled={inviting || !inviteEmail}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg"
                >
                  <Plus className="w-3.5 h-3.5" /> {inviting ? 'Sending…' : 'Invite'}
                </button>
              </div>

              {inviteLink && (
                <div className="mt-3 flex items-center gap-2 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                  <p className="flex-1 text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{inviteLink}</p>
                  <button onClick={copyLink} className={`flex items-center gap-1 text-xs font-medium ${copied ? 'text-green-600' : 'text-blue-600 hover:text-blue-700'}`}>
                    {copied ? <><Check className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Pending invites */}
          {canAdmin && invites.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Pending invites</h2>
              <div className="space-y-2">
                {invites.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{inv.email}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        <RoleBadge role={inv.role} /> · Expires {new Date(inv.expiresAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button onClick={() => revokeInvite(inv.token)} className="text-xs text-red-500 hover:text-red-600 font-medium">Revoke</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Danger zone */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-red-200 dark:border-red-900 p-6">
            <h2 className="text-base font-semibold text-red-600 dark:text-red-400 mb-4">Danger zone</h2>
            {callerRole === 'owner' ? (
              confirmDelete ? (
                <div className="space-y-3">
                  <p className="text-sm text-gray-700 dark:text-gray-300">Are you sure? This will remove all members from the workspace. This cannot be undone.</p>
                  <div className="flex gap-2">
                    <button onClick={deleteWorkspace} className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg">Yes, delete workspace</button>
                    <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setConfirmDelete(true)} className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950">
                  Delete workspace
                </button>
              )
            ) : (
              <button onClick={leaveWorkspace} className="px-4 py-2 text-sm font-semibold text-red-600 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-950">
                Leave workspace
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
