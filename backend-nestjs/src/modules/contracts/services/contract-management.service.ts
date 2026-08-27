import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '../../email/email.service';
import { StorageService } from '../../storage/storage.service';

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
      variables: [
        'client_name',
        'client_company',
        'provider_name',
        'provider_company',
        'service_description',
        'total_amount',
        'payment_terms',
        'start_date',
        'end_date',
      ],
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
      variables: [
        'party_a_name',
        'party_a_company',
        'party_b_name',
        'party_b_company',
        'effective_date',
        'duration_years',
      ],
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
      variables: [
        'project_name',
        'client_name',
        'client_company',
        'provider_name',
        'provider_company',
        'scope',
        'deliverables',
        'timeline',
        'total_amount',
        'payment_schedule',
      ],
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

  async createContractFromProposal(userId: string, data: ContractData): Promise<Contract> {
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
      const template = templates.find((t) => t.id === data.templateId);
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

    const contract = await this.prisma.contract.create({
      data: {
        proposalId: data.proposalId,
        userId,
        title: `Contract - ${proposal.title}`,
        content,
        status: 'draft',
        expiresAt: data.expiresAt,
        recipientEmail: data.signerInfo?.email || proposal.recipientEmail,
      },
    });

    return this.serializeContract(contract);
  }

  async sendContract(userId: string, contractId: string, recipientEmail: string): Promise<void> {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, userId },
    });

    if (!contract) {
      throw new BadRequestException('Contract not found');
    }

    const frontendUrl = this.configService.get('FRONTEND_URL') || 'https://app.syncquote.com';
    const contractUrl = `${frontendUrl}/contracts/${contract.id}`;

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

    await this.prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: 'sent',
        sentAt: new Date(),
        recipientEmail,
      },
    });

    this.logger.log(`Contract sent to ${recipientEmail}`);
  }

  async signContract(
    contractId: string,
    signatureData: {
      signatureUrl: string;
      signerName: string;
      signerEmail: string;
      signerIp?: string;
    },
  ): Promise<Contract> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (!contract) {
      throw new BadRequestException('Contract not found');
    }

    if (contract.status === 'cancelled') {
      throw new BadRequestException('Contract is cancelled');
    }

    const updated = await this.prisma.contract.update({
      where: { id: contractId },
      data: {
        status: 'signed',
        signedAt: new Date(),
        signatureData: {
          signedAt: new Date().toISOString(),
          ...signatureData,
        },
      },
    });

    const pdfUrl = await this.generateSignedContractPdf(updated);
    const signed = await this.prisma.contract.update({
      where: { id: contractId },
      data: { pdfUrl },
    });

    this.logger.log(`Contract signed ${contractId}`);
    return this.serializeContract(signed);
  }

  async getContract(contractId: string): Promise<Contract | null> {
    const contract = await this.prisma.contract.findUnique({
      where: { id: contractId },
    });

    if (contract) {
      if (contract.status === 'sent') {
        await this.prisma.contract.update({
          where: { id: contractId },
          data: { status: 'viewed', viewedAt: new Date() },
        });
      }
      return this.serializeContract(contract);
    }

    const proposal = await this.prisma.proposal.findUnique({
      where: { id: contractId },
    });
    const legacy = (proposal?.metadata as any)?.contract as Contract | undefined;
    return legacy || null;
  }

  async getContractsByUser(userId: string): Promise<Contract[]> {
    const contracts = await this.prisma.contract.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return contracts.map((contract) => this.serializeContract(contract));
  }

  private serializeContract(contract: {
    id: string;
    proposalId: string;
    userId: string;
    title: string;
    content: string;
    status: string;
    pdfUrl: string | null;
    signatureData: unknown;
    expiresAt: Date | null;
    sentAt: Date | null;
    viewedAt: Date | null;
    signedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Contract {
    return {
      id: contract.id,
      proposalId: contract.proposalId,
      userId: contract.userId,
      title: contract.title,
      content: contract.content,
      status: contract.status as Contract['status'],
      pdfUrl: contract.pdfUrl || undefined,
      signatureData: contract.signatureData as Contract['signatureData'],
      expiresAt: contract.expiresAt || undefined,
      sentAt: contract.sentAt || undefined,
      viewedAt: contract.viewedAt || undefined,
      signedAt: contract.signedAt || undefined,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    };
  }

  private async generateSignedContractPdf(contract: {
    id: string;
    proposalId: string;
    title: string;
    content: string;
    signatureData: unknown;
  }): Promise<string> {
    const { PDFDocument, StandardFonts } = await import('pdf-lib');
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const signature = contract.signatureData as { signerName?: string; signedAt?: string } | null;
    const lines = [
      contract.title,
      '',
      contract.content.replace(/<[^>]+>/g, ' ').slice(0, 2500),
      '',
      `Signed by: ${signature?.signerName || ''}`,
      `Date: ${signature?.signedAt || new Date().toISOString()}`,
    ];
    let y = 750;
    for (const line of lines) {
      const wrapped = line.split('\n');
      for (const wrap of wrapped) {
        page.drawText(wrap.slice(0, 90), { x: 50, y, size: 10, font });
        y -= 14;
        if (y < 40) {
          break;
        }
      }
    }
    const bytes = await pdf.save();
    const key = `contracts/${contract.proposalId}/${contract.id}-signed.pdf`;
    try {
      await this.storageService.uploadFile(Buffer.from(bytes), key, 'application/pdf');
      return await this.storageService.getSignedUrl(key, 60 * 60 * 24 * 30);
    } catch (error) {
      this.logger.warn(`Contract PDF stored as download route: ${(error as Error).message}`);
      return `/api/v1/contracts/${contract.id}/pdf`;
    }
  }

  async cancelContract(userId: string, contractId: string): Promise<void> {
    const contract = await this.prisma.contract.findFirst({
      where: { id: contractId, userId },
    });

    if (!contract) {
      throw new BadRequestException('Contract not found');
    }

    await this.prisma.contract.update({
      where: { id: contractId },
      data: { status: 'cancelled' },
    });
  }
}
