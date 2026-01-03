import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as puppeteer from 'puppeteer';
import { PDFDocument } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';

export interface AuditTrailEntry {
    action: string;
    timestamp: Date;
    ipAddress?: string;
    userAgent?: string;
    email?: string;
    details?: string;
}

export interface CertificateData {
    proposalId: string;
    proposalTitle: string;
    proposalSlug: string;
    ownerName: string;
    ownerEmail: string;
    recipientName?: string;
    recipientEmail?: string;
    signerName: string;
    signerEmail: string;
    signedAt: Date;
    signatureIpAddress?: string;
    auditTrail: AuditTrailEntry[];
    certificateId: string;
    generatedAt: Date;
}

@Injectable()
export class AuditCertificateService {
    private readonly logger = new Logger(AuditCertificateService.name);

    constructor(private prisma: PrismaService) { }

    /**
     * Generate a complete audit certificate for a signed proposal
     */
    async generateCertificate(proposalId: string): Promise<{ certificateUrl: string; pdfBuffer: Buffer }> {
        // Collect all audit data
        const certificateData = await this.collectAuditData(proposalId);

        // Generate certificate HTML
        const certificateHtml = this.createCertificateHtml(certificateData);

        // Convert HTML to PDF using puppeteer
        const certificatePdf = await this.htmlToPdf(certificateHtml);

        // Get the original proposal PDF if exists
        const proposal = await this.prisma.proposal.findUnique({
            where: { id: proposalId },
            select: { pdfUrl: true },
        });

        let finalPdf: Buffer;

        if (proposal?.pdfUrl) {
            // Merge certificate with existing proposal PDF
            finalPdf = await this.mergePdfs(proposal.pdfUrl, certificatePdf);
        } else {
            finalPdf = certificatePdf;
        }

        // For now, return the buffer. In production, upload to S3/R2
        // const certificateUrl = await this.uploadToStorage(finalPdf, proposalId);
        const certificateUrl = `/certificates/${proposalId}-certificate.pdf`;

        return { certificateUrl, pdfBuffer: finalPdf };
    }

    /**
     * Collect all audit trail data for the proposal
     */
    async collectAuditData(proposalId: string): Promise<CertificateData> {
        const proposal = await this.prisma.proposal.findUnique({
            where: { id: proposalId },
            include: {
                user: {
                    select: { name: true, email: true, companyName: true },
                },
                viewSessions: {
                    orderBy: { startedAt: 'asc' },
                    select: {
                        ipAddress: true,
                        userAgent: true,
                        viewerEmail: true,
                        viewerName: true,
                        startedAt: true,
                        totalDuration: true,
                        scrollDepth: true,
                    },
                },
                activities: {
                    orderBy: { createdAt: 'asc' },
                    select: {
                        type: true,
                        metadata: true,
                        createdAt: true,
                    },
                },
            },
        });

        if (!proposal) {
            throw new NotFoundException('Proposal not found');
        }

        // Build audit trail from various sources
        const auditTrail: AuditTrailEntry[] = [];

        // Add creation event
        auditTrail.push({
            action: 'Proposal Created',
            timestamp: proposal.createdAt,
            email: proposal.user.email,
            details: `Created by ${proposal.user.name || proposal.user.email}`,
        });

        // Add sent event
        if (proposal.sentAt) {
            auditTrail.push({
                action: 'Proposal Sent',
                timestamp: proposal.sentAt,
                email: proposal.user.email,
                details: `Sent to ${proposal.recipientEmail}`,
            });
        }

        // Add view sessions
        for (const session of proposal.viewSessions) {
            auditTrail.push({
                action: 'Proposal Viewed',
                timestamp: session.startedAt,
                ipAddress: session.ipAddress || undefined,
                userAgent: session.userAgent || undefined,
                email: session.viewerEmail || undefined,
                details: `Viewed for ${session.totalDuration} seconds, scroll depth: ${session.scrollDepth}%`,
            });
        }

        // Add activities
        for (const activity of proposal.activities) {
            if (activity.type !== 'proposal_viewed') { // Avoid duplicates
                const metadata = activity.metadata as any || {};
                auditTrail.push({
                    action: this.formatActivityType(activity.type),
                    timestamp: activity.createdAt,
                    ipAddress: metadata.ipAddress,
                    userAgent: metadata.userAgent,
                    details: metadata.details,
                });
            }
        }

        // Add signature event
        const signatureData = proposal.signatureData as any || {};
        if (proposal.signedAt) {
            auditTrail.push({
                action: 'Proposal Signed',
                timestamp: proposal.signedAt,
                ipAddress: signatureData.ipAddress,
                email: proposal.signerEmail || undefined,
                details: `Signed by ${proposal.signerName || 'Unknown'}`,
            });
        }

        // Sort by timestamp
        auditTrail.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        return {
            proposalId: proposal.id,
            proposalTitle: proposal.title,
            proposalSlug: proposal.slug,
            ownerName: proposal.user.name || proposal.user.companyName || 'Unknown',
            ownerEmail: proposal.user.email,
            recipientName: proposal.recipientName || undefined,
            recipientEmail: proposal.recipientEmail || undefined,
            signerName: proposal.signerName || signatureData.name || 'Unknown',
            signerEmail: proposal.signerEmail || signatureData.email || 'Unknown',
            signedAt: proposal.signedAt || new Date(),
            signatureIpAddress: signatureData.ipAddress,
            auditTrail,
            certificateId: `CERT-${proposal.id.substring(0, 8).toUpperCase()}-${Date.now()}`,
            generatedAt: new Date(),
        };
    }

    /**
     * Generate HTML for the certificate
     */
    private createCertificateHtml(data: CertificateData): string {
        const formatDate = (date: Date) => {
            return new Date(date).toLocaleString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                timeZoneName: 'short',
            });
        };

        const auditRows = data.auditTrail.map((entry, index) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${index + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${formatDate(entry.timestamp)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${entry.action}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${entry.ipAddress || '-'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${entry.email || '-'}</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px;">${entry.details || '-'}</td>
      </tr>
    `).join('');

        return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Certificate of Completion</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 40px;
      color: #1f2937;
      background: #fff;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #2563eb;
      margin: 0;
      font-size: 28px;
    }
    .header p {
      color: #6b7280;
      margin: 10px 0 0;
    }
    .section {
      margin-bottom: 30px;
    }
    .section h2 {
      color: #1f2937;
      font-size: 18px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 8px;
      margin-bottom: 15px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 15px;
    }
    .info-item {
      background: #f9fafb;
      padding: 12px;
      border-radius: 6px;
    }
    .info-item label {
      font-weight: 600;
      font-size: 12px;
      color: #6b7280;
      display: block;
      margin-bottom: 4px;
    }
    .info-item span {
      font-size: 14px;
      color: #1f2937;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
    }
    th {
      background: #f3f4f6;
      padding: 10px 8px;
      text-align: left;
      font-size: 12px;
      font-weight: 600;
      color: #374151;
    }
    .signature-block {
      background: #f0fdf4;
      border: 2px solid #22c55e;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
    }
    .signature-block h3 {
      color: #15803d;
      margin: 0 0 15px;
    }
    .certificate-id {
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
    }
    .certificate-id code {
      background: #f3f4f6;
      padding: 8px 16px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 14px;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      font-size: 11px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>📜 Certificate of Completion</h1>
    <p>Digital Signature Verification & Audit Trail</p>
  </div>

  <div class="section">
    <h2>Document Information</h2>
    <div class="info-grid">
      <div class="info-item">
        <label>Proposal Title</label>
        <span>${data.proposalTitle}</span>
      </div>
      <div class="info-item">
        <label>Document ID</label>
        <span>${data.proposalSlug}</span>
      </div>
      <div class="info-item">
        <label>Sent By</label>
        <span>${data.ownerName} (${data.ownerEmail})</span>
      </div>
      <div class="info-item">
        <label>Recipient</label>
        <span>${data.recipientName || 'N/A'} (${data.recipientEmail || 'N/A'})</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="signature-block">
      <h3>✓ Document Signed</h3>
      <p><strong>Signed by:</strong> ${data.signerName} (${data.signerEmail})</p>
      <p><strong>Signed at:</strong> ${formatDate(data.signedAt)}</p>
      <p><strong>IP Address:</strong> ${data.signatureIpAddress || 'Not recorded'}</p>
    </div>
  </div>

  <div class="section">
    <h2>Complete Audit Trail</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Timestamp</th>
          <th>Action</th>
          <th>IP Address</th>
          <th>Email</th>
          <th>Details</th>
        </tr>
      </thead>
      <tbody>
        ${auditRows}
      </tbody>
    </table>
  </div>

  <div class="certificate-id">
    <p><strong>Certificate ID:</strong></p>
    <code>${data.certificateId}</code>
    <p style="margin-top: 10px; font-size: 12px; color: #6b7280;">
      Generated on ${formatDate(data.generatedAt)}
    </p>
  </div>

  <div class="footer">
    <p>This certificate is generated by SyncQuote and provides a complete audit trail of all document activities.</p>
    <p>For verification, please contact support with the Certificate ID above.</p>
  </div>
</body>
</html>
    `;
    }

    /**
     * Convert HTML to PDF using puppeteer
     */
    private async htmlToPdf(html: string): Promise<Buffer> {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        try {
            const page = await browser.newPage();
            await page.setContent(html, { waitUntil: 'networkidle0' });

            const pdfBuffer = await page.pdf({
                format: 'A4',
                margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' },
                printBackground: true,
            });

            return Buffer.from(pdfBuffer);
        } finally {
            await browser.close();
        }
    }

    /**
     * Merge certificate PDF with the original proposal PDF
     */
    private async mergePdfs(originalPdfUrl: string, certificatePdf: Buffer): Promise<Buffer> {
        try {
            // Fetch the original PDF
            const response = await fetch(originalPdfUrl);
            const originalPdfBytes = await response.arrayBuffer();

            // Load both PDFs
            const originalDoc = await PDFDocument.load(originalPdfBytes);
            const certificateDoc = await PDFDocument.load(certificatePdf);

            // Copy certificate pages to the original document
            const certificatePages = await originalDoc.copyPages(
                certificateDoc,
                certificateDoc.getPageIndices(),
            );

            // Add certificate pages at the end
            for (const page of certificatePages) {
                originalDoc.addPage(page);
            }

            // Save merged PDF
            const mergedPdfBytes = await originalDoc.save();
            return Buffer.from(mergedPdfBytes);
        } catch (error) {
            this.logger.error('Failed to merge PDFs, returning certificate only', error);
            return certificatePdf;
        }
    }

    /**
     * Format activity type for display
     */
    private formatActivityType(type: string): string {
        const typeMap: Record<string, string> = {
            proposal_created: 'Proposal Created',
            proposal_sent: 'Proposal Sent',
            proposal_viewed: 'Proposal Viewed',
            proposal_approved: 'Proposal Approved',
            proposal_declined: 'Proposal Declined',
            proposal_signed: 'Proposal Signed',
            comment_added: 'Comment Added',
            proposal_updated: 'Proposal Updated',
            pricing_updated: 'Pricing Updated',
        };
        return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
}
