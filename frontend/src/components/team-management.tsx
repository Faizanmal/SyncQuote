'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Users,
  UserPlus,
  Settings,
  Shield,
  MoreHorizontal,
  Mail,
  Crown,
  UserCog,
  Eye,
  Edit,
  Trash2,
  Check,
  X,
  Building,
  Calendar,
} from 'lucide-react';
import { useApi } from '@/hooks/use-api';
import { toast } from 'sonner';

// Types
type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

interface Permission {
  id: string;
  name: string;
  description: string;
  category: string;
}

interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: TeamRole;
  permissions: Record<string, boolean>;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl?: string;
  };
}

interface Team {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  settings: Record<string, unknown>;
  createdAt: string;
  members: TeamMember[];
  stats?: {
    totalProposals: number;
    totalRevenue: number;
    avgWinRate: number;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: TeamRole;
  status: 'pending' | 'accepted' | 'expired';
  expiresAt: string;
  createdAt: string;
}

const ROLE_LABELS: Record<TeamRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<TeamRole, string> = {
  owner: 'bg-amber-500',
  admin: 'bg-purple-500',
  member: 'bg-blue-500',
  viewer: 'bg-gray-500',
};

const DEFAULT_PERMISSIONS: Permission[] = [
  { id: 'proposals.create', name: 'Create Proposals', description: 'Create new proposals', category: 'Proposals' },
  { id: 'proposals.edit', name: 'Edit Proposals', description: 'Edit existing proposals', category: 'Proposals' },
  { id: 'proposals.delete', name: 'Delete Proposals', description: 'Delete proposals', category: 'Proposals' },
  { id: 'proposals.send', name: 'Send Proposals', description: 'Send proposals to clients', category: 'Proposals' },
  { id: 'templates.manage', name: 'Manage Templates', description: 'Create and edit templates', category: 'Templates' },
  { id: 'clients.manage', name: 'Manage Clients', description: 'Add and edit client information', category: 'Clients' },
  { id: 'analytics.view', name: 'View Analytics', description: 'Access analytics dashboard', category: 'Analytics' },
  { id: 'team.invite', name: 'Invite Members', description: 'Invite new team members', category: 'Team' },
  { id: 'team.manage', name: 'Manage Team', description: 'Manage team settings and members', category: 'Team' },
  { id: 'billing.view', name: 'View Billing', description: 'View billing information', category: 'Billing' },
  { id: 'billing.manage', name: 'Manage Billing', description: 'Manage billing and subscriptions', category: 'Billing' },
];

const ROLE_DEFAULT_PERMISSIONS: Record<TeamRole, string[]> = {
  owner: DEFAULT_PERMISSIONS.map((p) => p.id),
  admin: DEFAULT_PERMISSIONS.filter((p) => !p.id.startsWith('billing.manage')).map((p) => p.id),
  member: ['proposals.create', 'proposals.edit', 'proposals.send', 'templates.manage', 'clients.manage', 'analytics.view'],
  viewer: ['analytics.view'],
};

export function TeamManagement() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showCreateTeamDialog, setShowCreateTeamDialog] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const api = useApi();

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<TeamRole>('member');

  // Create team form state
  const [newTeamName, setNewTeamName] = useState('');

  useEffect(() => {
    fetchTeams();
  }, []);

  useEffect(() => {
    if (currentTeam) {
      fetchInvitations();
    }
  }, [currentTeam]);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await api.get('/teams');
      setTeams(response.data);
      if (response.data.length > 0 && !currentTeam) {
        setCurrentTeam(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    if (!currentTeam) return;
    try {
      const response = await api.get(`/teams/${currentTeam.id}/invitations`);
      setInvitations(response.data);
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    }
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    
    try {
      const response = await api.post('/teams', { name: newTeamName });
      setTeams([...teams, response.data]);
      setCurrentTeam(response.data);
      setNewTeamName('');
      setShowCreateTeamDialog(false);
      toast.success('Team created successfully');
    } catch (error) {
      toast.error('Failed to create team');
    }
  };

  const inviteMember = async () => {
    if (!currentTeam || !inviteEmail.trim()) return;

    try {
      await api.post(`/teams/${currentTeam.id}/invitations`, {
        email: inviteEmail,
        role: inviteRole,
      });
      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail('');
      setInviteRole('member');
      setShowInviteDialog(false);
      fetchInvitations();
    } catch (error) {
      toast.error('Failed to send invitation');
    }
  };

  const removeMember = async () => {
    if (!currentTeam || !memberToRemove) return;

    try {
      await api.delete(`/teams/${currentTeam.id}/members/${memberToRemove.id}`);
      toast.success('Member removed from team');
      setMemberToRemove(null);
      fetchTeams();
    } catch (error) {
      toast.error('Failed to remove member');
    }
  };

  const updateMemberRole = async (memberId: string, role: TeamRole) => {
    if (!currentTeam) return;

    try {
      await api.patch(`/teams/${currentTeam.id}/members/${memberId}`, { role });
      toast.success('Member role updated');
      fetchTeams();
    } catch (error) {
      toast.error('Failed to update member role');
    }
  };

  const updateMemberPermissions = async (memberId: string, permissions: Record<string, boolean>) => {
    if (!currentTeam) return;

    try {
      await api.patch(`/teams/${currentTeam.id}/members/${memberId}`, { permissions });
      toast.success('Permissions updated');
      fetchTeams();
      setEditingMember(null);
    } catch (error) {
      toast.error('Failed to update permissions');
    }
  };

  const cancelInvitation = async (invitationId: string) => {
    if (!currentTeam) return;

    try {
      await api.delete(`/teams/${currentTeam.id}/invitations/${invitationId}`);
      toast.success('Invitation cancelled');
      fetchInvitations();
    } catch (error) {
      toast.error('Failed to cancel invitation');
    }
  };

  const resendInvitation = async (invitationId: string) => {
    if (!currentTeam) return;

    try {
      await api.post(`/teams/${currentTeam.id}/invitations/${invitationId}/resend`);
      toast.success('Invitation resent');
    } catch (error) {
      toast.error('Failed to resend invitation');
    }
  };

  const getRoleIcon = (role: TeamRole) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4" />;
      case 'admin':
        return <Shield className="h-4 w-4" />;
      case 'member':
        return <UserCog className="h-4 w-4" />;
      case 'viewer':
        return <Eye className="h-4 w-4" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Team Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {teams.length > 1 ? (
            <Select
              value={currentTeam?.id}
              onValueChange={(value) => setCurrentTeam(teams.find((t) => t.id === value) || null)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team) => (
                  <SelectItem key={team.id} value={team.id}>
                    <div className="flex items-center gap-2">
                      <Building className="h-4 w-4" />
                      {team.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5" />
              <h2 className="text-xl font-semibold">{currentTeam?.name || 'No Team'}</h2>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Dialog open={showCreateTeamDialog} onOpenChange={setShowCreateTeamDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Building className="h-4 w-4 mr-2" />
                New Team
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Team</DialogTitle>
                <DialogDescription>Create a new team to collaborate with others.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="team-name">Team Name</Label>
                  <Input
                    id="team-name"
                    placeholder="My Team"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateTeamDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createTeam} disabled={!newTeamName.trim()}>
                  Create Team
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
            <DialogTrigger asChild>
              <Button disabled={!currentTeam}>
                <UserPlus className="h-4 w-4 mr-2" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
                <DialogDescription>
                  Send an invitation to join your team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="colleague@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as TeamRole)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin - Full access except billing</SelectItem>
                      <SelectItem value="member">Member - Can create and edit proposals</SelectItem>
                      <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowInviteDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={inviteMember} disabled={!inviteEmail.trim()}>
                  Send Invitation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Team Stats */}
      {currentTeam?.stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{currentTeam.stats.totalProposals}</div>
                <p className="text-sm text-muted-foreground">Total Proposals</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  ${currentTeam.stats.totalRevenue.toLocaleString()}
                </div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{currentTeam.stats.avgWinRate.toFixed(1)}%</div>
                <p className="text-sm text-muted-foreground">Team Win Rate</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">
            <Users className="h-4 w-4 mr-2" />
            Members ({currentTeam?.members?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="invitations">
            <Mail className="h-4 w-4 mr-2" />
            Invitations ({invitations.filter((i) => i.status === 'pending').length})
          </TabsTrigger>
          <TabsTrigger value="permissions">
            <Shield className="h-4 w-4 mr-2" />
            Permissions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Manage your team members and their roles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentTeam?.members?.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar>
                        <AvatarImage src={member.user.avatarUrl} />
                        <AvatarFallback>
                          {member.user.name?.charAt(0) || member.user.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.user.name || member.user.email}</p>
                        <p className="text-sm text-muted-foreground">{member.user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Badge className={`${ROLE_COLORS[member.role]} text-white`}>
                        {getRoleIcon(member.role)}
                        <span className="ml-1">{ROLE_LABELS[member.role]}</span>
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        {formatDate(member.joinedAt)}
                      </div>
                      {member.role !== 'owner' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setEditingMember(member)}>
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Permissions
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => updateMemberRole(member.id, 'admin')}>
                              <Shield className="h-4 w-4 mr-2" />
                              Make Admin
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateMemberRole(member.id, 'member')}>
                              <UserCog className="h-4 w-4 mr-2" />
                              Make Member
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateMemberRole(member.id, 'viewer')}>
                              <Eye className="h-4 w-4 mr-2" />
                              Make Viewer
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setMemberToRemove(member)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remove from Team
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pending Invitations</CardTitle>
              <CardDescription>Manage invitations to your team</CardDescription>
            </CardHeader>
            <CardContent>
              {invitations.filter((i) => i.status === 'pending').length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No pending invitations
                </div>
              ) : (
                <div className="space-y-4">
                  {invitations
                    .filter((i) => i.status === 'pending')
                    .map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between p-4 border rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                            <Mail className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{invitation.email}</p>
                            <p className="text-sm text-muted-foreground">
                              Invited as {ROLE_LABELS[invitation.role]} • Expires{' '}
                              {formatDate(invitation.expiresAt)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resendInvitation(invitation.id)}
                          >
                            Resend
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => cancelInvitation(invitation.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Role Permissions</CardTitle>
              <CardDescription>Default permissions for each role</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Permission</th>
                      <th className="text-center py-3 px-4">
                        <Badge className={`${ROLE_COLORS.owner} text-white`}>Owner</Badge>
                      </th>
                      <th className="text-center py-3 px-4">
                        <Badge className={`${ROLE_COLORS.admin} text-white`}>Admin</Badge>
                      </th>
                      <th className="text-center py-3 px-4">
                        <Badge className={`${ROLE_COLORS.member} text-white`}>Member</Badge>
                      </th>
                      <th className="text-center py-3 px-4">
                        <Badge className={`${ROLE_COLORS.viewer} text-white`}>Viewer</Badge>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(
                      DEFAULT_PERMISSIONS.reduce(
                        (acc, p) => {
                          if (!acc[p.category]) acc[p.category] = [];
                          acc[p.category].push(p);
                          return acc;
                        },
                        {} as Record<string, Permission[]>
                      )
                    ).map(([category, permissions]) => (
                      <>
                        <tr key={category} className="bg-muted/50">
                          <td colSpan={5} className="py-2 px-4 font-medium text-sm">
                            {category}
                          </td>
                        </tr>
                        {permissions.map((permission) => (
                          <tr key={permission.id} className="border-b">
                            <td className="py-3 px-4">
                              <div>
                                <p className="text-sm">{permission.name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {permission.description}
                                </p>
                              </div>
                            </td>
                            {(['owner', 'admin', 'member', 'viewer'] as TeamRole[]).map((role) => (
                              <td key={role} className="text-center py-3 px-4">
                                {ROLE_DEFAULT_PERMISSIONS[role].includes(permission.id) ? (
                                  <Check className="h-4 w-4 text-green-500 mx-auto" />
                                ) : (
                                  <X className="h-4 w-4 text-muted-foreground mx-auto" />
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Remove Member Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.user.name || memberToRemove?.user.email}{' '}
              from the team? They will lose access to all team resources.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={removeMember} className="bg-destructive text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Permissions Dialog */}
      <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Permissions</DialogTitle>
            <DialogDescription>
              Customize permissions for {editingMember?.user.name || editingMember?.user.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[400px] overflow-y-auto">
            {Object.entries(
              DEFAULT_PERMISSIONS.reduce(
                (acc, p) => {
                  if (!acc[p.category]) acc[p.category] = [];
                  acc[p.category].push(p);
                  return acc;
                },
                {} as Record<string, Permission[]>
              )
            ).map(([category, permissions]) => (
              <div key={category} className="space-y-2">
                <h4 className="font-medium text-sm">{category}</h4>
                {permissions.map((permission) => (
                  <div key={permission.id} className="flex items-center justify-between py-1">
                    <div className="flex-1">
                      <p className="text-sm">{permission.name}</p>
                    </div>
                    <Switch
                      checked={
                        editingMember?.permissions[permission.id] ??
                        ROLE_DEFAULT_PERMISSIONS[editingMember?.role || 'viewer'].includes(permission.id)
                      }
                      onCheckedChange={(checked) => {
                        if (editingMember) {
                          setEditingMember({
                            ...editingMember,
                            permissions: {
                              ...editingMember.permissions,
                              [permission.id]: checked,
                            },
                          });
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                editingMember && updateMemberPermissions(editingMember.id, editingMember.permissions)
              }
            >
              Save Permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
