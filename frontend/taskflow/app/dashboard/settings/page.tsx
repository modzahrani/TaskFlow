"use client"

import { useCallback, useEffect, useState } from "react"
import { Bell, LogOut, Moon, Plus, Save, ShieldCheck, UserMinus, UserPlus, Users } from "lucide-react"
import { getCurrentUser, logout, updateProfile, User } from "@/api/userProvider"
import { acceptInvite, addTeamMember, createTeam, declineInvite, getMyPendingInvites, getTeamMembers, getTeams, removeTeamMember, Team, TeamInvite, TeamMember, TeamRole } from "@/api/teamProvider"
import { useRouter } from "next/navigation"
import axios from "axios"
import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_SECONDARY } from "@/lib/buttonStyles"

export default function SettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const [user, setUser] = useState<User | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [pendingInvites, setPendingInvites] = useState<TeamInvite[]>([])
  const [processingInviteId, setProcessingInviteId] = useState<string | null>(null)
  const [selectedTeamId, setSelectedTeamId] = useState("")
  const [membersByTeam, setMembersByTeam] = useState<Record<string, TeamMember[]>>({})
  const [membersLoadingByTeam, setMembersLoadingByTeam] = useState<Record<string, boolean>>({})
  const [newMemberEmailByTeam, setNewMemberEmailByTeam] = useState<Record<string, string>>({})
  const [newMemberRoleByTeam, setNewMemberRoleByTeam] = useState<Record<string, TeamRole>>({})
  const [addingByTeam, setAddingByTeam] = useState<Record<string, boolean>>({})
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState("")
  const [newTeamName, setNewTeamName] = useState("")
  const [creatingTeam, setCreatingTeam] = useState(false)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [compactMode, setCompactMode] = useState(false)

  useEffect(() => {
    async function loadSettings(): Promise<void> {
      try {
        const [userRes, teamsRes, invitesRes] = await Promise.all([getCurrentUser(), getTeams(), getMyPendingInvites()])
        const loaded = userRes.data?.user || userRes.data || null
        setUser(loaded)
        setNameDraft(loaded?.name || "")

        if (Array.isArray(teamsRes.data)) {
          setTeams(teamsRes.data)
          if (teamsRes.data[0]?.id) setSelectedTeamId(teamsRes.data[0].id)
        } else if (Array.isArray(teamsRes.data?.teams)) {
          setTeams(teamsRes.data.teams)
          if (teamsRes.data.teams[0]?.id) setSelectedTeamId(teamsRes.data.teams[0].id)
        } else {
          setTeams([])
        }

        if (Array.isArray(invitesRes.data?.invites)) {
          setPendingInvites(invitesRes.data.invites)
        } else if (Array.isArray(invitesRes.data)) {
          setPendingInvites(invitesRes.data)
        } else {
          setPendingInvites([])
        }

        const notif = localStorage.getItem("settings.notifications")
        const compact = localStorage.getItem("settings.compactMode")

        if (notif !== null) setNotificationsEnabled(notif === "true")
        if (compact !== null) setCompactMode(compact === "true")
      } catch (error) {
        console.error("Error loading settings:", error)
      } finally {
        setLoading(false)
      }
    }

    void loadSettings()
  }, [])

  const loadTeamMembers = useCallback(async (teamId: string, force = false): Promise<void> => {
    if (!teamId || (membersByTeam[teamId] && !force) || membersLoadingByTeam[teamId]) return

    try {
      setMembersLoadingByTeam((prev) => ({ ...prev, [teamId]: true }))
      const res = await getTeamMembers(teamId)
      const members: TeamMember[] = Array.isArray(res.data?.members)
        ? res.data.members
        : Array.isArray(res.data)
          ? res.data
          : []
      setMembersByTeam((prev) => ({ ...prev, [teamId]: members }))
    } catch (error) {
      console.error("Failed to load members:", error)
      setMembersByTeam((prev) => ({ ...prev, [teamId]: [] }))
    } finally {
      setMembersLoadingByTeam((prev) => ({ ...prev, [teamId]: false }))
    }
  }, [membersByTeam, membersLoadingByTeam])

  useEffect(() => {
    if (!selectedTeamId) return
    void loadTeamMembers(selectedTeamId)
  }, [selectedTeamId, loadTeamMembers])

  async function handleSave(): Promise<void> {
    try {
      setSaving(true)

      if (nameDraft.trim() && nameDraft.trim() !== user?.name) {
        const response = await updateProfile({ name: nameDraft.trim() })
        const updated = response.data?.user || response.data || null
        if (updated) setUser(updated)
      }

      localStorage.setItem("settings.notifications", String(notificationsEnabled))
      localStorage.setItem("settings.compactMode", String(compactMode))
      alert("Settings saved")
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.detail as string) || error.message
        : "Failed to save settings"
      alert(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCreateTeam(): Promise<void> {
    if (!newTeamName.trim()) return

    try {
      setCreatingTeam(true)
      const response = await createTeam({ name: newTeamName.trim() })
      const created: Team | undefined = response.data?.team || response.data

      if (created) {
        setTeams((prev) => [...prev, created])
        setSelectedTeamId((prev) => prev || created.id)
      } else {
        const refreshed = await getTeams()
        if (Array.isArray(refreshed.data?.teams)) {
          setTeams(refreshed.data.teams)
          if (!selectedTeamId && refreshed.data.teams[0]?.id) {
            setSelectedTeamId(refreshed.data.teams[0].id)
          }
        }
      }

      setNewTeamName("")
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.detail as string) || error.message
        : "Failed to create team"
      alert(message)
    } finally {
      setCreatingTeam(false)
    }
  }

  async function handleAddMember(teamId: string): Promise<void> {
    const email = newMemberEmailByTeam[teamId]?.trim()
    const role = newMemberRoleByTeam[teamId] || "member"

    if (!email) {
      alert("Please enter a member email")
      return
    }

    try {
      setAddingByTeam((prev) => ({ ...prev, [teamId]: true }))
      const response = await addTeamMember(teamId, { email, role })
      setNewMemberEmailByTeam((prev) => ({ ...prev, [teamId]: "" }))
      alert(response.data?.detail || "Invite created successfully")
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.detail as string) || error.message
        : "Failed to add member"
      alert(message)
    } finally {
      setAddingByTeam((prev) => ({ ...prev, [teamId]: false }))
    }
  }

  async function handleRemoveMember(teamId: string, memberId: string): Promise<void> {
    try {
      setRemovingMemberId(memberId)
      await removeTeamMember(teamId, memberId)
      setMembersByTeam((prev) => ({
        ...prev,
        [teamId]: (prev[teamId] || []).filter((m) => m.id !== memberId),
      }))
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.detail as string) || error.message
        : "Failed to remove member"
      alert(message)
    } finally {
      setRemovingMemberId(null)
    }
  }

  async function handleAcceptInvite(inviteId: string): Promise<void> {
    try {
      setProcessingInviteId(inviteId)
      await acceptInvite(inviteId)
      setPendingInvites((prev) => prev.filter((invite) => invite.id !== inviteId))
      const refreshedTeams = await getTeams()
      if (Array.isArray(refreshedTeams.data?.teams)) {
        setTeams(refreshedTeams.data.teams)
      }
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.detail as string) || error.message
        : "Failed to accept invite"
      alert(message)
    } finally {
      setProcessingInviteId(null)
    }
  }

  async function handleDeclineInvite(inviteId: string): Promise<void> {
    try {
      setProcessingInviteId(inviteId)
      await declineInvite(inviteId)
      setPendingInvites((prev) => prev.filter((invite) => invite.id !== inviteId))
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? (error.response?.data?.detail as string) || error.message
        : "Failed to decline invite"
      alert(message)
    } finally {
      setProcessingInviteId(null)
    }
  }

  async function handleLogout(): Promise<void> {
    if (loggingOut) return

    try {
      setLoggingOut(true)
      await logout()
    } catch (error) {
      console.error("Logout API failed, continuing local logout:", error)
    } finally {
      localStorage.removeItem("user")
      setLoggingOut(false)
      router.push("/login")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background p-6 md:p-8 flex items-center justify-center">
      <div className="w-full max-w-4xl space-y-6">
        <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage your account and preferences.</p>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
          <div className="flex items-center gap-2 text-foreground">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Account</h2>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</label>
            <input
              value={user?.email || ""}
              disabled
              className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Display Name</label>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-5">
          <h2 className="text-lg font-semibold text-foreground">Preferences</h2>

          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <Bell className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Notifications</p>
                <p className="text-xs text-muted-foreground">Enable in-app reminders and updates</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setNotificationsEnabled((v) => !v)}
              className={`h-7 w-12 rounded-full p-1 transition ${
                notificationsEnabled ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white transition ${
                  notificationsEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-4">
            <div className="flex items-center gap-3">
              <Moon className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Compact Mode</p>
                <p className="text-xs text-muted-foreground">Reduce spacing in dashboards and tables</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCompactMode((v) => !v)}
              className={`h-7 w-12 rounded-full p-1 transition ${
                compactMode ? "bg-primary" : "bg-muted"
              }`}
            >
              <span
                className={`block h-5 w-5 rounded-full bg-white transition ${
                  compactMode ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-foreground">
            <Users className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Teams</h2>
          </div>

          <div className="flex flex-wrap gap-2">
            <input
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="New team name"
              className="min-w-[220px] flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
            />
            <button
              type="button"
              onClick={handleCreateTeam}
              disabled={creatingTeam || !newTeamName.trim()}
              className={`${BUTTON_PRIMARY} gap-2`}
            >
              <Plus className="h-4 w-4" />
              {creatingTeam ? "Creating..." : "Create Team"}
            </button>
          </div>

          <div className="rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
            {teams.length > 0 ? `${teams.length} teams available` : "No teams yet"}
          </div>

          {teams.length > 0 && (
            <div className="space-y-4 rounded-xl border border-border p-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Manage Team Members
              </label>

              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>

              {selectedTeamId && (
                <div className="space-y-3">
                  <div className="grid gap-2 sm:grid-cols-[1fr_160px_auto]">
                    <input
                      value={newMemberEmailByTeam[selectedTeamId] || ""}
                      onChange={(e) =>
                        setNewMemberEmailByTeam((prev) => ({ ...prev, [selectedTeamId]: e.target.value }))
                      }
                      placeholder="Member email"
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                    />
                    <select
                      value={newMemberRoleByTeam[selectedTeamId] || "member"}
                      onChange={(e) =>
                        setNewMemberRoleByTeam((prev) => ({
                          ...prev,
                          [selectedTeamId]: e.target.value as TeamRole,
                        }))
                      }
                      className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => void handleAddMember(selectedTeamId)}
                      disabled={addingByTeam[selectedTeamId]}
                      className={`${BUTTON_PRIMARY} gap-2`}
                    >
                      <UserPlus className="h-4 w-4" />
                      {addingByTeam[selectedTeamId] ? "Adding..." : "Add"}
                    </button>
                  </div>

                  <div className="rounded-xl border border-border bg-muted/40 p-3">
                    {membersLoadingByTeam[selectedTeamId] ? (
                      <div className="text-sm text-muted-foreground">Loading members...</div>
                    ) : (membersByTeam[selectedTeamId] || []).length === 0 ? (
                      <div className="text-sm text-muted-foreground">No members yet</div>
                    ) : (
                      <div className="space-y-2">
                        {(membersByTeam[selectedTeamId] || []).map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2"
                          >
                            <div>
                              <div className="text-sm font-medium text-foreground">{member.name || member.email || member.user_id}</div>
                              <div className="text-xs text-muted-foreground">
                                {member.email || member.user_id} • {member.role}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => void handleRemoveMember(selectedTeamId, member.id)}
                              disabled={removingMemberId === member.id}
                              className={`${BUTTON_SECONDARY} gap-1 px-3 py-1.5 text-xs`}
                            >
                              <UserMinus className="h-3.5 w-3.5" />
                              {removingMemberId === member.id ? "Removing..." : "Remove"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Team Invites</h2>
          {pendingInvites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending team invites.</p>
          ) : (
            <div className="space-y-2">
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {invite.team_name || "Team"} ({invite.role})
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Invited by {invite.invited_by_name || invite.invited_by_email || "team admin"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleDeclineInvite(invite.id)}
                      disabled={processingInviteId === invite.id}
                      className={`${BUTTON_SECONDARY} px-3 py-1.5 text-xs`}
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleAcceptInvite(invite.id)}
                      disabled={processingInviteId === invite.id}
                      className={`${BUTTON_PRIMARY} px-3 py-1.5 text-xs`}
                    >
                      {processingInviteId === invite.id ? "Processing..." : "Accept"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className={`${BUTTON_PRIMARY} gap-2`}
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Save Settings"}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className={`${BUTTON_DANGER} gap-2`}
          >
            <LogOut className="h-4 w-4" />
            {loggingOut ? "Logging out..." : "Logout"}
          </button>
        </section>
      </div>
    </div>
  )
}
