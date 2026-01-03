'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingsAPI, actionItemsAPI, notesAPI, tagsAPI, activitiesAPI, templatesAPI, integrationsAPI, notificationLogsAPI, calendarAPI, workspacesAPI, apiClient } from '@/lib/api';
import type { Meeting, ActionItem, Tag, MeetingTemplate, NotificationIntegration, CalendarConnection, Workspace, WorkspaceMember } from '@/lib/api';

// Meetings
export function useMeetings(params?: {
  search?: string;
  status?: string;
  ordering?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: ['meetings', params],
    queryFn: () => meetingsAPI.list(params),
  });
}

export function useMeeting(id: string) {
  return useQuery({
    queryKey: ['meetings', id],
    queryFn: () => meetingsAPI.get(id),
    enabled: !!id,
  });
}

export function useMeetingStats() {
  return useQuery({
    queryKey: ['meetings', 'stats'],
    queryFn: () => meetingsAPI.getStats(),
  });
}

export function useAnalytics(days: number = 30) {
  return useQuery({
    queryKey: ['meetings', 'analytics', days],
    queryFn: () => meetingsAPI.getAnalytics(days),
  });
}

export function useUploadMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (formData: FormData) => meetingsAPI.create(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meetings', 'stats'] });
    },
  });
}

export function useUpdateMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Meeting> }) =>
      meetingsAPI.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meetings', variables.id] });
    },
  });
}

export function useDeleteMeeting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => meetingsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meetings', 'stats'] });
    },
  });
}

export function useShareMeeting() {
  return useMutation({
    mutationFn: (id: string) => meetingsAPI.share(id),
  });
}

// Action Items
export function useActionItems(params?: {
  search?: string;
  status?: string;
  priority?: string;
  meeting?: string;
  ordering?: string;
  page?: number;
}) {
  return useQuery({
    queryKey: ['action-items', params],
    queryFn: () => actionItemsAPI.list(params),
  });
}

export function useActionItem(id: string) {
  return useQuery({
    queryKey: ['action-items', id],
    queryFn: () => actionItemsAPI.get(id),
    enabled: !!id,
  });
}

export function useCreateActionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<ActionItem>) => actionItemsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
      queryClient.invalidateQueries({ queryKey: ['meetings', 'stats'] });
    },
  });
}

export function useUpdateActionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ActionItem> }) =>
      actionItemsAPI.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
      queryClient.invalidateQueries({ queryKey: ['action-items', variables.id] });
      queryClient.invalidateQueries({ queryKey: ['meetings', 'stats'] });
    },
  });
}

export function useCompleteActionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => actionItemsAPI.complete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
      queryClient.invalidateQueries({ queryKey: ['meetings', 'stats'] });
    },
  });
}

export function useDeleteActionItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => actionItemsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-items'] });
      queryClient.invalidateQueries({ queryKey: ['meetings', 'stats'] });
    },
  });
}

// Meeting Notes
export function useMeetingNotes(meetingId?: string) {
  return useQuery({
    queryKey: ['notes', meetingId],
    queryFn: () => notesAPI.list(meetingId),
    enabled: !!meetingId,
  });
}

export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { meeting: string; content: string; timestamp?: number }) =>
      notesAPI.create(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['notes', variables.meeting] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
  });
}

// Tags
export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsAPI.list(),
  });
}

export function useCreateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; color?: string }) => tagsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useUpdateTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tag> }) =>
      tagsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => tagsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });
}

// Favorites
export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => meetingsAPI.toggleFavorite(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      queryClient.invalidateQueries({ queryKey: ['meetings', id] });
    },
  });
}

export function useFavorites() {
  return useQuery({
    queryKey: ['meetings', 'favorites'],
    queryFn: () => meetingsAPI.getFavorites(),
  });
}

// Activities
export function useActivities(limit?: number) {
  return useQuery({
    queryKey: ['activities', limit],
    queryFn: () => activitiesAPI.list(limit),
  });
}

export function useActivity(id: string) {
  return useQuery({
    queryKey: ['activities', id],
    queryFn: () => activitiesAPI.get(id),
    enabled: !!id,
  });
}

// Templates
export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: () => templatesAPI.list(),
  });
}

export function useTemplate(id: string) {
  return useQuery({
    queryKey: ['templates', id],
    queryFn: () => templatesAPI.get(id),
    enabled: !!id,
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<MeetingTemplate>) => templatesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<MeetingTemplate> }) =>
      templatesAPI.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      queryClient.invalidateQueries({ queryKey: ['templates', variables.id] });
    },
  });
}

export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => templatesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

// Integrations
export function useIntegrations() {
  return useQuery({
    queryKey: ['integrations'],
    queryFn: () => integrationsAPI.list(),
  });
}

export function useIntegration(id: string) {
  return useQuery({
    queryKey: ['integrations', id],
    queryFn: () => integrationsAPI.get(id),
    enabled: !!id,
  });
}

export function useCreateIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<NotificationIntegration>) => integrationsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useUpdateIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NotificationIntegration> }) =>
      integrationsAPI.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      queryClient.invalidateQueries({ queryKey: ['integrations', variables.id] });
    },
  });
}

export function useDeleteIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => integrationsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
    },
  });
}

export function useTestIntegration() {
  return useMutation({
    mutationFn: ({ id, testMessage }: { id: string; testMessage?: string }) =>
      integrationsAPI.test(id, testMessage),
  });
}

// Notification Logs
export function useNotificationLogs() {
  return useQuery({
    queryKey: ['notification-logs'],
    queryFn: () => notificationLogsAPI.list(),
  });
}

// Calendar Connections
export function useCalendarConnections() {
  return useQuery({
    queryKey: ['calendar-connections'],
    queryFn: () => calendarAPI.listConnections(),
  });
}

export function useCalendarConnection(id: string) {
  return useQuery({
    queryKey: ['calendar-connections', id],
    queryFn: () => calendarAPI.getConnection(id),
    enabled: !!id,
  });
}

export function useCreateCalendarConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<CalendarConnection>) => calendarAPI.createConnection(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
    },
  });
}

export function useUpdateCalendarConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CalendarConnection> }) =>
      calendarAPI.updateConnection(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-connections', variables.id] });
    },
  });
}

export function useDeleteCalendarConnection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => calendarAPI.deleteConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
    },
  });
}

export function useSyncCalendar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => calendarAPI.syncConnection(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-connections'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-events'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-sync-logs'] });
    },
  });
}

// Calendar Events
export function useCalendarEvents() {
  return useQuery({
    queryKey: ['calendar-events'],
    queryFn: () => calendarAPI.listEvents(),
  });
}

// Calendar Sync Logs
export function useCalendarSyncLogs() {
  return useQuery({
    queryKey: ['calendar-sync-logs'],
    queryFn: () => calendarAPI.listSyncLogs(),
  });
}

// Workspaces
export function useWorkspaces() {
  return useQuery({
    queryKey: ['workspaces'],
    queryFn: () => workspacesAPI.list(),
  });
}

export function useWorkspace(id: string) {
  return useQuery({
    queryKey: ['workspaces', id],
    queryFn: () => workspacesAPI.get(id),
    enabled: !!id,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<Workspace>) => workspacesAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Workspace> }) =>
      workspacesAPI.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces', variables.id] });
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workspacesAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    },
  });
}

// Workspace Members
export function useWorkspaceMembers() {
  return useQuery({
    queryKey: ['workspace-members'],
    queryFn: () => workspacesAPI.listMembers(),
  });
}

export function useUpdateWorkspaceMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<WorkspaceMember> }) =>
      workspacesAPI.updateMember(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
    },
  });
}

export function useRemoveWorkspaceMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workspacesAPI.removeMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
    },
  });
}

// Workspace Invitations
export function useWorkspaceInvitations() {
  return useQuery({
    queryKey: ['workspace-invitations'],
    queryFn: () => workspacesAPI.listInvitations(),
  });
}

export function useInviteWorkspaceMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { workspace: string; email: string; role: string; message?: string }) =>
      workspacesAPI.createInvitation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-invitations'] });
    },
  });
}

export function useAcceptWorkspaceInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workspacesAPI.acceptInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-invitations'] });
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      queryClient.invalidateQueries({ queryKey: ['workspace-members'] });
    },
  });
}

export function useDeclineWorkspaceInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => workspacesAPI.declineInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-invitations'] });
    },
  });
}

// ============================================
// NEW FEATURES - Proposal Management Hooks
// ============================================

// View Analytics
export function useProposalViewAnalytics(proposalId: string) {
  return useQuery({
    queryKey: ['view-analytics', proposalId],
    queryFn: () => apiClient.get(`/view-analytics/proposal/${proposalId}`),
    enabled: !!proposalId,
  });
}

export function useProposalHeatmap(proposalId: string) {
  return useQuery({
    queryKey: ['view-analytics', 'heatmap', proposalId],
    queryFn: () => apiClient.get(`/view-analytics/proposal/${proposalId}/heatmap`),
    enabled: !!proposalId,
  });
}

export function useTrackProposalView() {
  return useMutation({
    mutationFn: (data: { proposalId: string; event: string; metadata?: Record<string, unknown> }) =>
      apiClient.post('/view-analytics/track', data),
  });
}

// Snippets Library
export function useSnippets(params?: { category?: string; search?: string }) {
  return useQuery({
    queryKey: ['snippets', params],
    queryFn: () => apiClient.get('/snippets', { params }),
  });
}

export function useSnippet(id: string) {
  return useQuery({
    queryKey: ['snippets', id],
    queryFn: () => apiClient.get(`/snippets/${id}`),
    enabled: !!id,
  });
}

export function useCreateSnippet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; content: string; category?: string; tags?: string[]; variables?: Record<string, string> }) =>
      apiClient.post('/snippets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snippets'] });
    },
  });
}

export function useUpdateSnippet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; content: string; category?: string; tags?: string[] }> }) =>
      apiClient.patch(`/snippets/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['snippets'] });
      queryClient.invalidateQueries({ queryKey: ['snippets', variables.id] });
    },
  });
}

export function useDeleteSnippet() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/snippets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['snippets'] });
    },
  });
}

// Automation Workflows
export function useAutomationWorkflows(params?: { trigger?: string; isActive?: boolean }) {
  return useQuery({
    queryKey: ['automation-workflows', params],
    queryFn: () => apiClient.get('/automation/workflows', { params }),
  });
}

export function useAutomationWorkflow(id: string) {
  return useQuery({
    queryKey: ['automation-workflows', id],
    queryFn: () => apiClient.get(`/automation/workflows/${id}`),
    enabled: !!id,
  });
}

export function useCreateAutomationWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; trigger: string; conditions?: Record<string, unknown>; actions: Array<{ type: string; config: Record<string, unknown> }> }) =>
      apiClient.post('/automation/workflows', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-workflows'] });
    },
  });
}

export function useUpdateAutomationWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; isActive: boolean; conditions?: Record<string, unknown>; actions?: Array<{ type: string; config: Record<string, unknown> }> }> }) =>
      apiClient.patch(`/automation/workflows/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['automation-workflows'] });
      queryClient.invalidateQueries({ queryKey: ['automation-workflows', variables.id] });
    },
  });
}

export function useDeleteAutomationWorkflow() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/automation/workflows/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-workflows'] });
    },
  });
}

export function useAutomationExecutions(workflowId?: string) {
  return useQuery({
    queryKey: ['automation-executions', workflowId],
    queryFn: () => apiClient.get('/automation/executions', { params: { workflowId } }),
  });
}

// Payments
export function useProposalPayments(proposalId: string) {
  return useQuery({
    queryKey: ['payments', 'proposal', proposalId],
    queryFn: () => apiClient.get(`/payments/proposal/${proposalId}`),
    enabled: !!proposalId,
  });
}

export function useCreatePaymentIntent() {
  return useMutation({
    mutationFn: (data: { proposalId: string; amount: number; currency?: string; type?: string }) =>
      apiClient.post('/payments/create-intent', data),
  });
}

export function useConfirmPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (paymentIntentId: string) =>
      apiClient.post(`/payments/${paymentIntentId}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

export function useRefundPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ paymentId, amount }: { paymentId: string; amount?: number }) =>
      apiClient.post(`/payments/${paymentId}/refund`, { amount }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}

// Revenue Forecasting
export function usePipelineData() {
  return useQuery({
    queryKey: ['forecasting', 'pipeline'],
    queryFn: () => apiClient.get('/forecasting/pipeline'),
  });
}

export function useRevenueForecasts(params?: { period?: string }) {
  return useQuery({
    queryKey: ['forecasting', 'forecast', params],
    queryFn: () => apiClient.get('/forecasting/forecast', { params }),
  });
}

export function useWinRateAnalysis() {
  return useQuery({
    queryKey: ['forecasting', 'win-rate'],
    queryFn: () => apiClient.get('/forecasting/win-rate'),
  });
}

export function useTeamPerformance() {
  return useQuery({
    queryKey: ['forecasting', 'team-performance'],
    queryFn: () => apiClient.get('/forecasting/team-performance'),
  });
}

export function useUpdatePipelineStage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ proposalId, stageId }: { proposalId: string; stageId: string }) =>
      apiClient.patch(`/forecasting/proposals/${proposalId}/stage`, { stageId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forecasting'] });
    },
  });
}

// Teams Management
export function useTeams() {
  return useQuery({
    queryKey: ['teams'],
    queryFn: () => apiClient.get('/teams'),
  });
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: ['teams', id],
    queryFn: () => apiClient.get(`/teams/${id}`),
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { name: string; slug?: string }) =>
      apiClient.post('/teams', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; settings: Record<string, unknown> }> }) =>
      apiClient.patch(`/teams/${id}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['teams', variables.id] });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/teams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}

export function useTeamMembers(teamId: string) {
  return useQuery({
    queryKey: ['teams', teamId, 'members'],
    queryFn: () => apiClient.get(`/teams/${teamId}/members`),
    enabled: !!teamId,
  });
}

export function useUpdateTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, memberId, data }: { teamId: string; memberId: string; data: { role?: string; permissions?: Record<string, boolean> } }) =>
      apiClient.patch(`/teams/${teamId}/members/${memberId}`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams', variables.teamId, 'members'] });
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, memberId }: { teamId: string; memberId: string }) =>
      apiClient.delete(`/teams/${teamId}/members/${memberId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams', variables.teamId, 'members'] });
    },
  });
}

export function useTeamInvitations(teamId: string) {
  return useQuery({
    queryKey: ['teams', teamId, 'invitations'],
    queryFn: () => apiClient.get(`/teams/${teamId}/invitations`),
    enabled: !!teamId,
  });
}

export function useInviteTeamMember() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, data }: { teamId: string; data: { email: string; role: string } }) =>
      apiClient.post(`/teams/${teamId}/invitations`, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams', variables.teamId, 'invitations'] });
    },
  });
}

export function useCancelTeamInvitation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ teamId, invitationId }: { teamId: string; invitationId: string }) =>
      apiClient.delete(`/teams/${teamId}/invitations/${invitationId}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['teams', variables.teamId, 'invitations'] });
    },
  });
}

export function useResendTeamInvitation() {
  return useMutation({
    mutationFn: ({ teamId, invitationId }: { teamId: string; invitationId: string }) =>
      apiClient.post(`/teams/${teamId}/invitations/${invitationId}/resend`),
  });
}

// AI Content Generation
export function useGenerateAIContent() {
  return useMutation({
    mutationFn: (data: { prompt: string; context?: Record<string, unknown>; conversationHistory?: Array<{ role: string; content: string }> }) =>
      apiClient.post('/ai/generate', data),
  });
}

export function useImproveContent() {
  return useMutation({
    mutationFn: (data: { content: string; instruction: string }) =>
      apiClient.post('/ai/improve', data),
  });
}

export function useSuggestContent() {
  return useMutation({
    mutationFn: (data: { context: string; type: string }) =>
      apiClient.post('/ai/suggest', data),
  });
}

// ============================================
// NEW FEATURES - 5 Feature Implementation
// ============================================

// Feature 1: Interactive Pricing Calculator
export function useProposalPricing(slug: string) {
  return useQuery({
    queryKey: ['proposal-pricing', slug],
    queryFn: () => apiClient.get(`/public/proposals/${slug}/pricing`),
    enabled: !!slug,
  });
}

export function useUpdatePricingSelections() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slug, selections }: {
      slug: string;
      selections: Array<{ itemId: string; selected: boolean; quantity?: number }>
    }) => apiClient.post(`/public/proposals/${slug}/pricing`, { selections }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['proposal-pricing', variables.slug] });
    },
  });
}

// Feature 3: AI Smart Rewrite & URL Drafting
export function useSmartRewrite() {
  return useMutation({
    mutationFn: (data: {
      content: string;
      instruction: string;
      style?: 'persuasive' | 'concise' | 'professional' | 'friendly' | 'formal' | 'simplified';
      industry?: string;
      audience?: string;
    }) => apiClient.post('/ai/smart-rewrite', data),
  });
}

export function useDraftFromUrl() {
  return useMutation({
    mutationFn: (data: {
      url: string;
      blockType: 'introduction' | 'scope' | 'terms' | 'pricing' | 'conclusion' | 'custom';
      additionalContext?: string;
      proposalId?: string;
      serviceType?: string;
    }) => apiClient.post('/ai/draft-from-url', data),
  });
}

// Feature 4: Audit Certificate
export function useAuditCertificate(proposalId: string) {
  return useQuery({
    queryKey: ['audit-certificate', proposalId],
    queryFn: () => apiClient.get(`/proposals/${proposalId}/certificate`),
    enabled: !!proposalId,
  });
}

// Feature 5: CRM Sync Status
export function useCrmSyncStatus(proposalId: string) {
  return useQuery({
    queryKey: ['crm-sync', proposalId],
    queryFn: () => apiClient.get(`/crm-integrations/sync-status/${proposalId}`),
    enabled: !!proposalId,
  });
}

export function useTriggerCrmSync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (proposalId: string) =>
      apiClient.post(`/crm-integrations/sync/${proposalId}`),
    onSuccess: (_, proposalId) => {
      queryClient.invalidateQueries({ queryKey: ['crm-sync', proposalId] });
    },
  });
}

export const useApi = () => apiClient;
