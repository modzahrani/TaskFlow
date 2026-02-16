import apiClient from '@/api/clientProvider';
import { ENDPOINTS } from '@/constants/endpoints';

// Types
export type TeamRole = 'admin' | 'member';

export interface Team {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  role: TeamRole;
  name?: string;
  email?: string;
}

export interface CreateTeamData {
  name: string;
}

export interface UpdateTeamData {
  name: string;
}

export interface AddMemberData {
  user_id?: string;
  email?: string;
  role?: TeamRole;
}

export interface TeamInvite {
  id: string;
  team_id: string;
  invited_user_id: string;
  invited_by: string;
  role: TeamRole;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at?: string | null;
  team_name?: string;
  invited_by_name?: string;
  invited_by_email?: string;
}

// ==================== TEAM OPERATIONS ====================

// Get all teams for the authenticated user
export const getTeams = async () => {
  const res = await apiClient.get(ENDPOINTS.TEAMS.LIST);
  return res;
};

// Get a single team by ID
export const getTeam = async (teamId: string) => {
  const res = await apiClient.get(ENDPOINTS.TEAMS.GET(teamId));
  return res;
};

// Create a new team
export const createTeam = async (teamData: CreateTeamData) => {
  const res = await apiClient.post(ENDPOINTS.TEAMS.CREATE, teamData);
  return res;
};

// Update an existing team
export const updateTeam = async (teamId: string, teamData: UpdateTeamData) => {
  const res = await apiClient.put(ENDPOINTS.TEAMS.UPDATE(teamId), teamData);
  return res;
};

// Delete a team
export const deleteTeam = async (teamId: string) => {
  const res = await apiClient.delete(ENDPOINTS.TEAMS.DELETE(teamId));
  return res;
};

// ==================== TEAM MEMBER OPERATIONS ====================

// Get all members of a team
export const getTeamMembers = async (teamId: string) => {
  const res = await apiClient.get(ENDPOINTS.TEAMS.MEMBERS.LIST(teamId));
  return res;
};

// Add a member to a team
export const addTeamMember = async (teamId: string, memberData: AddMemberData) => {
  const res = await apiClient.post(ENDPOINTS.TEAMS.MEMBERS.ADD(teamId), memberData);
  return res;
};

// Remove a member from a team
export const removeTeamMember = async (teamId: string, memberId: string) => {
  const res = await apiClient.delete(ENDPOINTS.TEAMS.MEMBERS.REMOVE(teamId, memberId));
  return res;
};

// ==================== TEAM INVITES ====================

export const getMyPendingInvites = async () => {
  const res = await apiClient.get(ENDPOINTS.TEAMS.INVITES.MY_PENDING);
  return res;
};

export const acceptInvite = async (inviteId: string) => {
  const res = await apiClient.post(ENDPOINTS.TEAMS.INVITES.ACCEPT(inviteId));
  return res;
};

export const declineInvite = async (inviteId: string) => {
  const res = await apiClient.post(ENDPOINTS.TEAMS.INVITES.DECLINE(inviteId));
  return res;
};
