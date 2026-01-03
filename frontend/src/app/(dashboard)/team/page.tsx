'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { 
  Users, 
  UserPlus, 
  Crown, 
  Shield, 
  User, 
  MoreHorizontal, 
  Mail, 
  Clock, 
  Check, 
  X, 
  Settings,
  Building,
  Copy,
  Edit,
  Trash2,
  Eye,
  Ban,
  Activity
} from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { api } from '@/lib/api'

interface TeamMember {
  id: string
  name: string
  email: string
  role: 'owner' | 'admin' | 'member'
  avatar?: string
  status: 'active' | 'pending' | 'suspended'
  lastActive: string
  joinedAt: string
  invitedBy?: string
  permissions: string[]
}

interface TeamInvitation {
  id: string
  email: string
  role: 'admin' | 'member'
  status: 'pending' | 'expired'
  invitedBy: string
  invitedAt: string
  expiresAt: string
}

interface Workspace {
  id: string
  name: string
  domain: string
  plan: string
  memberCount: number
  maxMembers: number
  createdAt: string
  settings: {
    allowInvitations: boolean
    requireApproval: boolean
    defaultRole: 'admin' | 'member'
  }
}

const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'member']),
  message: z.string().optional(),
})

const createWorkspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters'),
  domain: z.string().min(3, 'Domain must be at least 3 characters').regex(/^[a-zA-Z0-9-]+$/, 'Domain can only contain letters, numbers, and hyphens'),
})

type InviteMemberForm = z.infer<typeof inviteMemberSchema>
type CreateWorkspaceForm = z.infer<typeof createWorkspaceSchema>

export default function TeamPage() {
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('main')
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false)
  const queryClient = useQueryClient()

  const { register: registerInvite, handleSubmit: handleInviteSubmit, formState: { errors: inviteErrors }, reset: resetInvite } = useForm<InviteMemberForm>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { role: 'member' }
  })

  const { register: registerWorkspace, handleSubmit: handleWorkspaceSubmit, formState: { errors: workspaceErrors }, reset: resetWorkspace } = useForm<CreateWorkspaceForm>()

  // Fetch team data
  const { data: workspace } = useQuery({
    queryKey: ['workspace', selectedWorkspace],
    queryFn: () => api.get(`/workspaces/${selectedWorkspace}`).then(res => res.data),
  })

  const { data: members } = useQuery({
    queryKey: ['team', 'members', selectedWorkspace],
    queryFn: () => api.get(`/workspaces/${selectedWorkspace}/members`).then(res => res.data),
  })

  const { data: invitations } = useQuery({
    queryKey: ['team', 'invitations', selectedWorkspace],
    queryFn: () => api.get(`/workspaces/${selectedWorkspace}/invitations`).then(res => res.data),
  })

  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => api.get('/workspaces').then(res => res.data),
  })

  // Mutations
  const inviteMemberMutation = useMutation({
    mutationFn: (data: InviteMemberForm) => api.post(`/workspaces/${selectedWorkspace}/invitations`, data),
    onSuccess: () => {
      toast.success('Invitation sent successfully!')
      setInviteDialogOpen(false)
      resetInvite()
      queryClient.invalidateQueries({ queryKey: ['team', 'invitations', selectedWorkspace] })
    },
    onError: () => {
      toast.error('Failed to send invitation')
    }
  })

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string, role: string }) => 
      api.patch(`/workspaces/${selectedWorkspace}/members/${memberId}/role`, { role }),
    onSuccess: () => {
      toast.success('Member role updated successfully!')
      queryClient.invalidateQueries({ queryKey: ['team', 'members', selectedWorkspace] })
    },
    onError: () => {
      toast.error('Failed to update member role')
    }
  })

  const removeMemberMutation = useMutation({
    mutationFn: (memberId: string) => api.delete(`/workspaces/${selectedWorkspace}/members/${memberId}`),
    onSuccess: () => {
      toast.success('Member removed successfully!')
      queryClient.invalidateQueries({ queryKey: ['team', 'members', selectedWorkspace] })
    },
    onError: () => {
      toast.error('Failed to remove member')
    }
  })

  const suspendMemberMutation = useMutation({
    mutationFn: (memberId: string) => api.patch(`/workspaces/${selectedWorkspace}/members/${memberId}/suspend`),
    onSuccess: () => {
      toast.success('Member suspended successfully!')
      queryClient.invalidateQueries({ queryKey: ['team', 'members', selectedWorkspace] })
    },
    onError: () => {
      toast.error('Failed to suspend member')
    }
  })

  const cancelInvitationMutation = useMutation({
    mutationFn: (invitationId: string) => api.delete(`/workspaces/${selectedWorkspace}/invitations/${invitationId}`),
    onSuccess: () => {
      toast.success('Invitation cancelled successfully!')
      queryClient.invalidateQueries({ queryKey: ['team', 'invitations', selectedWorkspace] })
    },
    onError: () => {
      toast.error('Failed to cancel invitation')
    }
  })

  const createWorkspaceMutation = useMutation({
    mutationFn: (data: CreateWorkspaceForm) => api.post('/workspaces', data),
    onSuccess: () => {
      toast.success('Workspace created successfully!')
      setWorkspaceDialogOpen(false)
      resetWorkspace()
      queryClient.invalidateQueries({ queryKey: ['workspaces'] })
    },
    onError: () => {
      toast.error('Failed to create workspace')
    }
  })

  const onInviteMember = (data: InviteMemberForm) => {
    inviteMemberMutation.mutate(data)
  }

  const onCreateWorkspace = (data: CreateWorkspaceForm) => {
    createWorkspaceMutation.mutate(data)
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner':
        return <Crown className="h-4 w-4 text-yellow-500" />
      case 'admin':
        return <Shield className="h-4 w-4 text-blue-500" />
      case 'member':
        return <User className="h-4 w-4 text-gray-500" />
      default:
        return <User className="h-4 w-4 text-gray-500" />
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default'
      case 'admin':
        return 'secondary'
      case 'member':
        return 'outline'
      default:
        return 'outline'
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'pending':
        return 'secondary'
      case 'suspended':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Team Management</h2>
          <p className="text-muted-foreground">
            Manage your team members, roles, and workspace settings
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedWorkspace} onValueChange={setSelectedWorkspace}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {workspaces?.map((ws: Workspace) => (
                <SelectItem key={ws.id} value={ws.id}>
                  <div className="flex items-center space-x-2">
                    <Building className="h-4 w-4" />
                    <span>{ws.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Dialog open={workspaceDialogOpen} onOpenChange={setWorkspaceDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Building className="mr-2 h-4 w-4" />
                New Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Workspace</DialogTitle>
                <DialogDescription>
                  Create a new workspace to organize your team and projects
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleWorkspaceSubmit(onCreateWorkspace)} className="space-y-4">
                <div>
                  <Label htmlFor="name">Workspace Name</Label>
                  <Input
                    id="name"
                    {...registerWorkspace('name')}
                    placeholder="Acme Corp"
                  />
                  {workspaceErrors.name && (
                    <p className="text-sm text-red-500 mt-1">{workspaceErrors.name.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="domain">Domain</Label>
                  <Input
                    id="domain"
                    {...registerWorkspace('domain')}
                    placeholder="acme-corp"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    This will be used for your workspace URL: syncquote.com/w/your-domain
                  </p>
                  {workspaceErrors.domain && (
                    <p className="text-sm text-red-500 mt-1">{workspaceErrors.domain.message}</p>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setWorkspaceDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createWorkspaceMutation.isPending}>
                    {createWorkspaceMutation.isPending ? 'Creating...' : 'Create Workspace'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Workspace Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center space-x-2">
                <Building className="h-5 w-5" />
                <span>{workspace?.name}</span>
                <Badge variant="outline">{workspace?.plan}</Badge>
              </CardTitle>
              <CardDescription>
                {workspace?.memberCount || 0} of {workspace?.maxMembers || 10} members
              </CardDescription>
            </div>
            <Button variant="outline" size="sm">
              <Settings className="mr-2 h-4 w-4" />
              Workspace Settings
            </Button>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="activity">Activity Log</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Team Members</h3>
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Invite Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite Team Member</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join your workspace
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleInviteSubmit(onInviteMember)} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      {...registerInvite('email')}
                      placeholder="john@example.com"
                    />
                    {inviteErrors.email && (
                      <p className="text-sm text-red-500 mt-1">{inviteErrors.email.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select {...registerInvite('role')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="message">Personal Message (Optional)</Label>
                    <Input
                      id="message"
                      {...registerInvite('message')}
                      placeholder="Welcome to the team!"
                    />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={inviteMemberMutation.isPending}>
                      {inviteMemberMutation.isPending ? 'Sending...' : 'Send Invitation'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead>Joined</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members?.map((member: TeamMember) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarImage src={member.avatar} />
                          <AvatarFallback>
                            {member.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-sm text-muted-foreground">{member.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        {getRoleIcon(member.role)}
                        <Badge variant={getRoleBadgeVariant(member.role)}>
                          {member.role}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(member.status)}>
                        {member.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>{member.lastActive}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {member.joinedAt}
                    </TableCell>
                    <TableCell>
                      {member.role !== 'owner' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => {}}>
                              <Eye className="mr-2 h-4 w-4" />
                              View Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {}}>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Role
                            </DropdownMenuItem>
                            {member.status === 'active' ? (
                              <DropdownMenuItem
                                className="text-orange-600"
                                onClick={() => suspendMemberMutation.mutate(member.id)}
                              >
                                <Ban className="mr-2 h-4 w-4" />
                                Suspend
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => {}}>
                                <Check className="mr-2 h-4 w-4" />
                                Reactivate
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => removeMemberMutation.mutate(member.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <h3 className="text-lg font-medium">Pending Invitations</h3>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Invited By</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations?.map((invitation: TeamInvitation) => (
                  <TableRow key={invitation.id}>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span>{invitation.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getRoleBadgeVariant(invitation.role)}>
                        {invitation.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {invitation.invitedBy}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {invitation.invitedAt}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {invitation.expiresAt}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {}}>
                            <Copy className="mr-2 h-4 w-4" />
                            Copy Link
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => {}}>
                            <Mail className="mr-2 h-4 w-4" />
                            Resend
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-red-600"
                            onClick={() => cancelInvitationMutation.mutate(invitation.id)}
                          >
                            <X className="mr-2 h-4 w-4" />
                            Cancel
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="roles" className="space-y-4">
          <h3 className="text-lg font-medium">Roles & Permissions</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  <span>Owner</span>
                </CardTitle>
                <CardDescription>
                  Full access to all workspace features and settings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1">
                  <li>• Manage all members and roles</li>
                  <li>• Access billing and subscription</li>
                  <li>• Configure workspace settings</li>
                  <li>• Delete workspace</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-blue-500" />
                  <span>Admin</span>
                </CardTitle>
                <CardDescription>
                  Manage members and most workspace features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1">
                  <li>• Invite and manage members</li>
                  <li>• Create and edit proposals</li>
                  <li>• View analytics</li>
                  <li>• Configure integrations</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5 text-gray-500" />
                  <span>Member</span>
                </CardTitle>
                <CardDescription>
                  Standard access to create and manage proposals
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-sm space-y-1">
                  <li>• Create proposals</li>
                  <li>• Edit own proposals</li>
                  <li>• View team proposals</li>
                  <li>• Basic analytics access</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <h3 className="text-lg font-medium">Activity Log</h3>
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {/* Activity feed items */}
                {Array.from({ length: 10 }).map((_, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 rounded border">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>JD</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm">
                        <span className="font-medium">John Doe</span> invited{' '}
                        <span className="font-medium">jane@example.com</span> to the workspace
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        <Activity className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">2 hours ago</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}