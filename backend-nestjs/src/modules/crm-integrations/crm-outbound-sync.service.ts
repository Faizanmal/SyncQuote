import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

export interface SyncAction {
    action: 'update_stage' | 'upload_attachment' | 'add_note' | 'update_deal';
    data: any;
}

export interface OutboundSyncResult {
    success: boolean;
    provider: string;
    dealId: string;
    error?: string;
}

@Injectable()
export class CrmOutboundSyncService {
    private readonly logger = new Logger(CrmOutboundSyncService.name);

    constructor(
        private prisma: PrismaService,
        private config: ConfigService,
    ) { }

    /**
     * Sync proposal status to all linked CRM deals
     */
    async syncProposalToCrm(proposalId: string): Promise<OutboundSyncResult[]> {
        const results: OutboundSyncResult[] = [];

        // Get all CRM links for this proposal
        const dealLinks = await this.prisma.crmDealLink.findMany({
            where: { proposalId },
            include: {
                crmIntegration: true,
            },
        });

        for (const link of dealLinks) {
            if (!link.crmIntegration || link.syncDirection === 'from_crm') continue;

            try {
                const result = await this.syncToProvider(link.crmIntegration, link.externalDealId, proposalId);
                results.push({
                    success: true,
                    provider: link.crmIntegration.provider,
                    dealId: link.externalDealId,
                });
            } catch (error: any) {
                this.logger.error(`Failed to sync to ${link.crmIntegration.provider}`, error);
                results.push({
                    success: false,
                    provider: link.crmIntegration.provider,
                    dealId: link.externalDealId,
                    error: error.message,
                });
            }
        }

        return results;
    }

    /**
     * Sync to a specific CRM provider
     */
    private async syncToProvider(integration: any, dealId: string, proposalId: string): Promise<void> {
        const proposal = await this.prisma.proposal.findUnique({
            where: { id: proposalId },
            select: {
                status: true,
                title: true,
                totalAmount: true,
                signedAt: true,
                pdfUrl: true,
                signerName: true,
                signerEmail: true,
            },
        });

        if (!proposal) throw new NotFoundException('Proposal not found');

        switch (integration.provider) {
            case 'hubspot':
                await this.syncToHubspot(integration, dealId, proposal);
                break;
            case 'salesforce':
                await this.syncToSalesforce(integration, dealId, proposal);
                break;
            case 'pipedrive':
                await this.syncToPipedrive(integration, dealId, proposal);
                break;
            case 'zoho':
                await this.syncToZoho(integration, dealId, proposal);
                break;
            default:
                this.logger.warn(`Unknown CRM provider: ${integration.provider}`);
        }
    }

    // ==================== HUBSPOT ====================

    private async syncToHubspot(integration: any, dealId: string, proposal: any): Promise<void> {
        const accessToken = integration.accessToken;
        const stageMappings = (integration.stageMappings as any[]) || [];

        // Find target stage based on proposal status
        const targetStage = this.getTargetStage(stageMappings, proposal.status, 'hubspot');

        // Update deal stage
        if (targetStage) {
            await axios.patch(
                `https://api.hubapi.com/crm/v3/objects/deals/${dealId}`,
                {
                    properties: {
                        dealstage: targetStage,
                        hs_lastmodifieddate: new Date().toISOString(),
                        ...(proposal.status === 'SIGNED' && {
                            closedate: proposal.signedAt?.toISOString(),
                            amount: proposal.totalAmount,
                        }),
                    },
                },
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                },
            );
            this.logger.log(`Updated HubSpot deal ${dealId} to stage ${targetStage}`);
        }

        // Add note about proposal status
        await this.addHubspotNote(accessToken, dealId, proposal);

        // Upload signed PDF as attachment if available
        if (proposal.status === 'SIGNED' && proposal.pdfUrl) {
            await this.uploadHubspotAttachment(accessToken, dealId, proposal);
        }
    }

    private async addHubspotNote(accessToken: string, dealId: string, proposal: any): Promise<void> {
        try {
            const noteBody = proposal.status === 'SIGNED'
                ? `✅ Proposal "${proposal.title}" was signed by ${proposal.signerName || 'client'} on ${proposal.signedAt?.toLocaleDateString()}`
                : `📋 Proposal "${proposal.title}" status updated to ${proposal.status}`;

            await axios.post(
                'https://api.hubapi.com/crm/v3/objects/notes',
                {
                    properties: {
                        hs_note_body: noteBody,
                        hs_timestamp: new Date().toISOString(),
                    },
                    associations: [
                        {
                            to: { id: dealId },
                            types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: 214 }],
                        },
                    ],
                },
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                },
            );
        } catch (error) {
            this.logger.warn('Failed to add HubSpot note', error);
        }
    }

    private async uploadHubspotAttachment(accessToken: string, dealId: string, proposal: any): Promise<void> {
        try {
            // Fetch PDF from URL
            const pdfResponse = await axios.get(proposal.pdfUrl, { responseType: 'arraybuffer' });
            const pdfBuffer = Buffer.from(pdfResponse.data);

            // Upload to HubSpot Files
            const formData = new FormData();
            formData.append('file', new Blob([pdfBuffer]), `proposal-${proposal.title}-signed.pdf`);
            formData.append('options', JSON.stringify({
                access: 'PRIVATE',
                ttl: 'P3M', // 3 months
                duplicateValidationStrategy: 'NONE',
            }));
            formData.append('folderPath', '/signed-proposals');

            const uploadResponse = await axios.post(
                'https://api.hubapi.com/files/v3/files',
                formData,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'multipart/form-data',
                    },
                },
            );

            // Associate file with deal
            const fileId = uploadResponse.data.id;
            await axios.post(
                `https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/files/${fileId}/RELATED_ATTACHMENT`,
                {},
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                },
            );

            this.logger.log(`Uploaded signed PDF to HubSpot deal ${dealId}`);
        } catch (error) {
            this.logger.warn('Failed to upload PDF to HubSpot', error);
        }
    }

    // ==================== SALESFORCE ====================

    private async syncToSalesforce(integration: any, opportunityId: string, proposal: any): Promise<void> {
        const accessToken = integration.accessToken;
        const instanceUrl = (integration.metadata as any)?.instanceUrl;
        const stageMappings = (integration.stageMappings as any[]) || [];

        if (!instanceUrl) {
            throw new Error('Salesforce instance URL not found');
        }

        // Find target stage
        const targetStage = this.getTargetStage(stageMappings, proposal.status, 'salesforce');

        // Update Opportunity
        if (targetStage || proposal.status === 'SIGNED') {
            await axios.patch(
                `${instanceUrl}/services/data/v58.0/sobjects/Opportunity/${opportunityId}`,
                {
                    ...(targetStage && { StageName: targetStage }),
                    ...(proposal.status === 'SIGNED' && {
                        CloseDate: proposal.signedAt?.toISOString().split('T')[0],
                        Amount: proposal.totalAmount,
                    }),
                },
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                },
            );
            this.logger.log(`Updated Salesforce Opportunity ${opportunityId}`);
        }

        // Upload attachment if signed
        if (proposal.status === 'SIGNED' && proposal.pdfUrl) {
            await this.uploadSalesforceAttachment(accessToken, instanceUrl, opportunityId, proposal);
        }
    }

    private async uploadSalesforceAttachment(
        accessToken: string,
        instanceUrl: string,
        opportunityId: string,
        proposal: any,
    ): Promise<void> {
        try {
            // Fetch PDF
            const pdfResponse = await axios.get(proposal.pdfUrl, { responseType: 'arraybuffer' });
            const pdfBase64 = Buffer.from(pdfResponse.data).toString('base64');

            // Create ContentVersion
            const versionResponse = await axios.post(
                `${instanceUrl}/services/data/v58.0/sobjects/ContentVersion`,
                {
                    Title: `Proposal - ${proposal.title} (Signed)`,
                    PathOnClient: `proposal-${proposal.title}-signed.pdf`,
                    VersionData: pdfBase64,
                },
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                },
            );

            // Get ContentDocumentId
            const contentDocResponse = await axios.get(
                `${instanceUrl}/services/data/v58.0/sobjects/ContentVersion/${versionResponse.data.id}`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                },
            );

            // Link to Opportunity
            await axios.post(
                `${instanceUrl}/services/data/v58.0/sobjects/ContentDocumentLink`,
                {
                    ContentDocumentId: contentDocResponse.data.ContentDocumentId,
                    LinkedEntityId: opportunityId,
                    ShareType: 'V',
                },
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                },
            );

            this.logger.log(`Uploaded signed PDF to Salesforce Opportunity ${opportunityId}`);
        } catch (error) {
            this.logger.warn('Failed to upload PDF to Salesforce', error);
        }
    }

    // ==================== PIPEDRIVE ====================

    private async syncToPipedrive(integration: any, dealId: string, proposal: any): Promise<void> {
        const apiToken = integration.accessToken;
        const stageMappings = (integration.stageMappings as any[]) || [];

        // Find target stage
        const targetStage = this.getTargetStage(stageMappings, proposal.status, 'pipedrive');

        // Update deal
        const updateData: any = {};
        if (targetStage) updateData.stage_id = parseInt(targetStage);
        if (proposal.status === 'SIGNED') {
            updateData.status = 'won';
            updateData.won_time = proposal.signedAt?.toISOString();
            updateData.value = proposal.totalAmount;
        }

        if (Object.keys(updateData).length > 0) {
            await axios.put(
                `https://api.pipedrive.com/v1/deals/${dealId}`,
                updateData,
                {
                    params: { api_token: apiToken },
                },
            );
            this.logger.log(`Updated Pipedrive deal ${dealId}`);
        }

        // Add note
        await axios.post(
            'https://api.pipedrive.com/v1/notes',
            {
                deal_id: parseInt(dealId),
                content: proposal.status === 'SIGNED'
                    ? `✅ Proposal "${proposal.title}" signed by ${proposal.signerName || 'client'}`
                    : `📋 Proposal "${proposal.title}" status: ${proposal.status}`,
            },
            {
                params: { api_token: apiToken },
            },
        );
    }

    // ==================== ZOHO ====================

    private async syncToZoho(integration: any, dealId: string, proposal: any): Promise<void> {
        const accessToken = integration.accessToken;
        const stageMappings = (integration.stageMappings as any[]) || [];

        // Find target stage
        const targetStage = this.getTargetStage(stageMappings, proposal.status, 'zoho');

        // Update deal
        const updateData: any = {};
        if (targetStage) updateData.Stage = targetStage;
        if (proposal.status === 'SIGNED') {
            updateData.Closing_Date = proposal.signedAt?.toISOString().split('T')[0];
            updateData.Amount = proposal.totalAmount;
        }

        if (Object.keys(updateData).length > 0) {
            await axios.put(
                `https://www.zohoapis.com/crm/v2/Deals/${dealId}`,
                { data: [updateData] },
                {
                    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
                },
            );
            this.logger.log(`Updated Zoho deal ${dealId}`);
        }

        // Add note
        await axios.post(
            `https://www.zohoapis.com/crm/v2/Deals/${dealId}/Notes`,
            {
                data: [{
                    Note_Title: 'Proposal Update',
                    Note_Content: proposal.status === 'SIGNED'
                        ? `Proposal "${proposal.title}" signed by ${proposal.signerName}`
                        : `Proposal "${proposal.title}" status: ${proposal.status}`,
                }],
            },
            {
                headers: { Authorization: `Zoho-oauthtoken ${accessToken}` },
            },
        );
    }

    // ==================== HELPERS ====================

    /**
     * Get target CRM stage based on proposal status
     */
    private getTargetStage(
        stageMappings: any[],
        proposalStatus: string,
        provider: string,
    ): string | null {
        const mapping = stageMappings.find((m) => m.syncQuoteStatus === proposalStatus);

        if (!mapping) {
            // Default mappings for common statuses
            const defaults: Record<string, Record<string, string>> = {
                SIGNED: {
                    hubspot: 'closedwon',
                    salesforce: 'Closed Won',
                    pipedrive: 'won',
                    zoho: 'Closed Won',
                },
            };
            return defaults[proposalStatus]?.[provider] || null;
        }

        return mapping.crmStageId || mapping.crmStageName || null;
    }

    /**
     * Trigger outbound sync for a specific proposal event
     */
    async triggerSync(proposalId: string, event: 'signed' | 'approved' | 'sent' | 'viewed'): Promise<void> {
        this.logger.log(`Triggering CRM sync for proposal ${proposalId} on event: ${event}`);

        // Only sync on significant events
        if (['signed', 'approved', 'sent'].includes(event)) {
            await this.syncProposalToCrm(proposalId);
        }
    }
}
