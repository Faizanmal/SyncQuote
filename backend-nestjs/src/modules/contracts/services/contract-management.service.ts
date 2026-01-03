import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../email/email.service';
import { StorageService } from '../../storage/storage.service';
import { v4 as uuidv4 } from 'uuid';

export interface ContractTemplate {
  id: string;
  name: string;
  description?: string;
  content: string; // HTML/Markdown template
  variables: string[]; // Variable placeholders
  category: string;
  isDefault: boolean;
}

export interface ContractData {
  proposalId: string;
  templateId?: string;
  customContent?: string;
  variables?: Record<string, string>;
  expiresAt?: Date;
  requiresSignature?: boolean;
  signerInfo?: {
    name: string;
    email: string;
    title?: string;
    company?: string;
  };
}

export interface Contract {
  id: string;
  proposalId: string;
  userId: string;
  title: string;
  content: string;
  status: 'draft' | 'sent' | 'viewed' | 'signed' | 'expired' | 'cancelled';
  pdfUrl?: string;
  signatureData?: {
    signedAt: Date;
    signatureUrl: string;
    signerName: string;
    signerEmail: string;
    signerIp?: string;
  };
  expiresAt?: Date;
  sentAt?: Date;
  viewedAt?: Date;
  signedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class ContractManagementService {
  private readonly logger = new Logger(ContractManagementService.name);

  // Default contract templates
  private readonly defaultTemplates: Omit<ContractTemplate, 'id'>[] = [
    {
      name: 'Standard Service Agreement',
      description: 'Basic service agreement template',
      category: 'service',
      isDefault: true,
      variables: ['client_name', 'client_company', 'provider_name', 'provider_company', 'service_description', 'total_amount', 'payment_terms', 'start_date', 'end_date'],
      content: `
# SERVICE AGREEMENT

This Service Agreement ("Agreement") is entered into as of {{start_date}} by and between:

**Service Provider:**
{{provider_name}}
{{provider_company}}

**Client:**
{{client_name}}
{{client_company}}

## 1. SERVICES

The Service Provider agrees to provide the following services:

{{service_description}}

## 2. COMPENSATION

The Client agrees to pay the Service Provider a total of **{{total_amount}}** for the services described above.

**Payment Terms:** {{payment_terms}}

## 3. TERM

This Agreement shall commence on {{start_date}} and continue until {{end_date}}, unless terminated earlier in accordance with this Agreement.

## 4. CONFIDENTIALITY

Both parties agree to maintain the confidentiality of any proprietary or confidential information shared during the course of this Agreement.

## 5. INTELLECTUAL PROPERTY

All intellectual property created as part of the services shall be owned by the Client upon full payment.

## 6. TERMINATION

Either party may terminate this Agreement with 30 days written notice. In the event of termination, the Client shall pay for all services rendered up to the termination date.

## 7. LIMITATION OF LIABILITY

The Service Provider's liability under this Agreement shall be limited to the total amount paid by the Client.

## 8. GOVERNING LAW

This Agreement shall be governed by and construed in accordance with the laws of the jurisdiction in which the Service Provider operates.

---

**AGREED AND ACCEPTED:**

Service Provider Signature: _________________________
Date: _________________________

Client Signature: _________________________
Date: _________________________
      `,
    },
    {
      name: 'Non-Disclosure Agreement',
      description: 'Mutual NDA template',
      category: 'nda',
      isDefault: true,
      variables: ['party_a_name', 'party_a_company', 'party_b_name', 'party_b_company', 'effective_date', 'duration_years'],
      content: `
# MUTUAL NON-DISCLOSURE AGREEMENT

This Mutual Non-Disclosure Agreement ("Agreement") is entered into as of {{effective_date}}.

**Between:**
{{party_a_name}}, {{party_a_company}} ("Party A")

**And:**
{{party_b_name}}, {{party_b_company}} ("Party B")

## 1. PURPOSE

The parties wish to explore a potential business relationship and may need to share confidential information.

## 2. DEFINITION OF CONFIDENTIAL INFORMATION

"Confidential Information" means any information disclosed by either party that is marked as confidential or should reasonably be understood to be confidential.

## 3. OBLIGATIONS

Each party agrees to:
- Keep Confidential Information strictly confidential
- Use Confidential Information only for the purpose of evaluating the business relationship
- Not disclose Confidential Information to third parties without prior written consent

## 4. EXCEPTIONS

This Agreement does not apply to information that:
- Is publicly available
- Was known prior to disclosure
- Is independently developed
- Is required to be disclosed by law

## 5. TERM

This Agreement shall remain in effect for {{duration_years}} years from the Effective Date.

## 6. RETURN OF INFORMATION

Upon request, each party shall return or destroy all Confidential Information.

---

**AGREED AND ACCEPTED:**

Party A Signature: _________________________
Date: _________________________

Party B Signature: _________________________
Date: _________________________
      `,
    },
    {
      name: 'Statement of Work',
      description: 'Project scope and deliverables',
      category: 'sow',
      isDefault: true,
      variables: ['project_name', 'client_name', 'client_company', 'provider_name', 'provider_company', 'scope', 'deliverables', 'timeline', 'total_amount', 'payment_schedule'],
      content: `
# STATEMENT OF WORK

**Project:** {{project_name}}
**Date:** {{effective_date}}

## PARTIES

**Service Provider:** {{provider_name}}, {{provider_company}}
**Client:** {{client_name}}, {{client_company}}

## 1. PROJECT SCOPE

{{scope}}

## 2. DELIVERABLES

{{deliverables}}

## 3. TIMELINE

{{timeline}}

## 4. PRICING

**Total Project Cost:** {{total_amount}}

**Payment Schedule:**
{{payment_schedule}}

## 5. ASSUMPTIONS

- Client will provide timely feedback (within 3 business days)
- Client will provide necessary access and resources
- Changes to scope may affect timeline and pricing

## 6. ACCEPTANCE

Deliverables will be considered accepted if no written objection is received within 5 business days of delivery.

---

**AGREED AND ACCEPTED:**

Service Provider: _________________________
Date: _________________________

Client: _________________________
Date: _________________________
      `,
    },
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    private readonly storageService: StorageService,
  ) {}

  async getContractTemplates(userId: string): Promise<ContractTemplate[]> {
    // In a full implementation, this would fetch from database
    // For now, return default templates with generated IDs
    return this.defaultTemplates.map((t, i) => ({
      ...t,
      id: `template-${i + 1}`,
    }));
  }

  async createContractFromProposal(
    userId: string,
    data: ContractData,
  ): Promise<Contract> {
    this.logger.log(`Creating contract for proposal ${data.proposalId}`);

    // Get the proposal
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: data.proposalId, userId },
      include: {
        user: { select: { name: true, companyName: true, email: true } },
        blocks: { include: { pricingItems: true } },
      },
    });

    if (!proposal) {
      throw new BadRequestException('Proposal not found');
    }

    // Get template content
    let content = data.customContent || '';
    if (data.templateId) {
      const templates = await this.getContractTemplates(userId);
      const template = templates.find(t => t.id === data.templateId);
      if (template) {
        content = template.content;
      }
    }

    // Replace variables
    const variables = {
      client_name: data.signerInfo?.name || proposal.recipientName || '',
      client_company: data.signerInfo?.company || '',
      client_email: data.signerInfo?.email || proposal.recipientEmail || '',
      provider_name: proposal.user.name || '',
      provider_company: proposal.user.companyName || '',
      provider_email: proposal.user.email,
      project_name: proposal.title,
      total_amount: `$${(proposal.totalAmount || proposal.estimatedValue || 0).toLocaleString()}`,
      start_date: new Date().toLocaleDateString(),
      end_date: data.expiresAt?.toLocaleDateString() || '',
      effective_date: new Date().toLocaleDateString(),
      ...data.variables,
    };

    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }

    // Create contract record
    const contractId = uuidv4();
    
    // Store in proposal metadata (in production, would have dedicated Contract table)
    const contractData: Contract = {
      id: contractId,
      proposalId: data.proposalId,
      userId,
      title: `Contract - ${proposal.title}`,
      content,
      status: 'draft',
      expiresAt: data.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.prisma.proposal.update({
      where: { id: data.proposalId },
      data: {
        metadata: {
          ...(proposal.metadata as any),
          contract: contractData,
        },
      },
    });

    return contractData;
  }

  async sendContract(
    userId: string,
    proposalId: string,
    recipientEmail: string,
  ): Promise<void> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, userId },
    });

    if (!proposal) {
      throw new BadRequestException('Proposal not found');
    }

    const contract = (proposal.metadata as any)?.contract as Contract;
    if (!contract) {
      throw new BadRequestException('Contract not found for this proposal');
    }

    const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://app.syncquote.com';
    const contractUrl = `${frontendUrl}/contracts/${contract.id}`;

    // Send email
    await this.emailService.sendEmail({
      to: recipientEmail,
      subject: `Contract Ready for Signature: ${contract.title}`,
      html: `
        <h2>Contract Ready for Your Signature</h2>
        <p>A contract has been prepared for you to review and sign.</p>
        <p><strong>Contract:</strong> ${contract.title}</p>
        <p><a href="${contractUrl}" style="background: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Review & Sign Contract</a></p>
        ${contract.expiresAt ? `<p><small>This contract expires on ${new Date(contract.expiresAt).toLocaleDateString()}</small></p>` : ''}
      `,
    });

    // Update contract status
    contract.status = 'sent';
    contract.sentAt = new Date();
    contract.updatedAt = new Date();

    await this.prisma.proposal.update({
      where: { id: proposalId },
      data: {
        metadata: {
          ...(proposal.metadata as any),
          contract,
        },
      },
    });

    this.logger.log(`Contract sent to ${recipientEmail}`);
  }

  async signContract(
    proposalId: string,
    signatureData: {
      signatureUrl: string;
      signerName: string;
      signerEmail: string;
      signerIp?: string;
    },
  ): Promise<Contract> {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new BadRequestException('Proposal not found');
    }

    const contract = (proposal.metadata as any)?.contract as Contract;
    if (!contract) {
      throw new BadRequestException('Contract not found');
    }

    contract.status = 'signed';
    contract.signedAt = new Date();
    contract.signatureData = {
      signedAt: new Date(),
      ...signatureData,
    };
    contract.updatedAt = new Date();

    await this.prisma.proposal.update({
      where: { id: proposalId },
      data: {
        metadata: {
          ...(proposal.metadata as any),
          contract,
        },
      },
    });

    // Generate signed PDF
    await this.generateSignedContractPdf(proposalId, contract);

    this.logger.log(`Contract signed for proposal ${proposalId}`);

    return contract;
  }

  async getContract(proposalId: string): Promise<Contract | null> {
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) return null;

    return (proposal.metadata as any)?.contract || null;
  }

  async getContractsByUser(userId: string): Promise<Contract[]> {
    const proposals = await this.prisma.proposal.findMany({
      where: {
        userId,
        metadata: { path: ['contract'], not: null },
      },
      select: { metadata: true },
    });

    return proposals
      .map(p => (p.metadata as any)?.contract)
      .filter(Boolean);
  }

  private async generateSignedContractPdf(
    proposalId: string,
    contract: Contract,
  ): Promise<string> {
    // In production, use a PDF generation library like puppeteer or pdfkit
    // For now, simulate PDF generation
    const pdfContent = `
      PDF Content for Contract: ${contract.title}
      Signed by: ${contract.signatureData?.signerName}
      Date: ${contract.signatureData?.signedAt}
    `;

    // Upload to storage
    const fileName = `contracts/${proposalId}/${contract.id}-signed.pdf`;
    
    // Mock upload - in production use actual storage service
    const pdfUrl = `https://storage.syncquote.com/${fileName}`;

    // Update contract with PDF URL
    const proposal = await this.prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (proposal) {
      contract.pdfUrl = pdfUrl;
      await this.prisma.proposal.update({
        where: { id: proposalId },
        data: {
          metadata: {
            ...(proposal.metadata as any),
            contract,
          },
        },
      });
    }

    return pdfUrl;
  }

  async cancelContract(userId: string, proposalId: string): Promise<void> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, userId },
    });

    if (!proposal) {
      throw new BadRequestException('Proposal not found');
    }

    const contract = (proposal.metadata as any)?.contract as Contract;
    if (!contract) {
      throw new BadRequestException('Contract not found');
    }

    contract.status = 'cancelled';
    contract.updatedAt = new Date();

    await this.prisma.proposal.update({
      where: { id: proposalId },
      data: {
        metadata: {
          ...(proposal.metadata as any),
          contract,
        },
      },
    });
  }
}
