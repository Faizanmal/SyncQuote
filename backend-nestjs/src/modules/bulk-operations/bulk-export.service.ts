import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { BulkExportDto, BulkAnalyticsReportDto, ExportFormat } from './dto/bulk.dto';
import * as PDFDocument from 'pdfkit';
import { Readable } from 'stream';

@Injectable()
export class BulkExportService {
  private readonly logger = new Logger(BulkExportService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private storage: StorageService,
  ) {}

  // Export proposals in various formats
  async exportProposals(
    userId: string,
    dto: BulkExportDto,
  ): Promise<{ downloadUrl: string; expiresAt: Date }> {
    // Verify ownership
    const proposals = await this.prisma.proposal.findMany({
      where: {
        id: { in: dto.proposalIds },
        userId,
      },
      include: {
        blocks:
          dto.format !== ExportFormat.CSV
            ? {
                include: { pricingItems: true },
              }
            : undefined,
        comments: dto.includeComments ? true : undefined,
        viewSessions: dto.includeAnalytics ? true : undefined,
      },
    });

    if (proposals.length === 0) {
      throw new NotFoundException('No proposals found');
    }

    let fileBuffer: Buffer;
    let fileName: string;
    let contentType: string;

    switch (dto.format) {
      case ExportFormat.PDF:
        fileBuffer = await this.generatePdfExport(proposals, dto);
        fileName = `proposals-export-${Date.now()}.pdf`;
        contentType = 'application/pdf';
        break;

      case ExportFormat.CSV:
        fileBuffer = this.generateCsvExport(proposals, dto);
        fileName = `proposals-export-${Date.now()}.csv`;
        contentType = 'text/csv';
        break;

      case ExportFormat.JSON:
        fileBuffer = this.generateJsonExport(proposals, dto);
        fileName = `proposals-export-${Date.now()}.json`;
        contentType = 'application/json';
        break;

      case ExportFormat.XLSX:
        fileBuffer = await this.generateXlsxExport(proposals, dto);
        fileName = `proposals-export-${Date.now()}.xlsx`;
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
    }

    // Upload to storage
    const key = `exports/${userId}/${fileName}`;
    const uploadUrl = await this.storage.uploadBuffer(fileBuffer, key, contentType);

    // Generate pre-signed download URL
    const downloadUrl = await this.storage.getSignedUrl(key, 3600); // 1 hour expiry
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    return { downloadUrl, expiresAt };
  }

  // Generate analytics report
  async generateAnalyticsReport(
    userId: string,
    dto: BulkAnalyticsReportDto,
  ): Promise<{ downloadUrl: string; expiresAt: Date }> {
    const whereClause: any = { userId };

    if (dto.proposalIds?.length) {
      whereClause.id = { in: dto.proposalIds };
    }

    if (dto.startDate || dto.endDate) {
      whereClause.createdAt = {};
      if (dto.startDate) whereClause.createdAt.gte = new Date(dto.startDate);
      if (dto.endDate) whereClause.createdAt.lte = new Date(dto.endDate);
    }

    const proposals = await this.prisma.proposal.findMany({
      where: whereClause,
      include: {
        viewSessions: true,
        activities: true,
      },
    });

    // Calculate analytics
    const report = proposals.map((proposal) => {
      const views = proposal.viewSessions?.length || 0;
      const totalDuration =
        proposal.viewSessions?.reduce((sum, s) => sum + (s.totalDuration || 0), 0) || 0;

      return {
        proposalId: proposal.id,
        title: proposal.title,
        status: proposal.status,
        recipientEmail: proposal.recipientEmail,
        createdAt: proposal.createdAt,
        sentAt: proposal.sentAt,
        views,
        avgViewDuration: views > 0 ? totalDuration / views : 0,
        firstViewedAt: proposal.firstViewedAt,
        lastViewedAt: proposal.lastViewedAt,
        approvedAt: proposal.approvedAt,
        signedAt: proposal.signedAt,
        conversionTime:
          proposal.signedAt && proposal.sentAt
            ? Math.round(
                (proposal.signedAt.getTime() - proposal.sentAt.getTime()) / (1000 * 60 * 60 * 24),
              )
            : null,
      };
    });

    // Summary stats
    const summary = {
      totalProposals: proposals.length,
      totalViews: report.reduce((sum, r) => sum + r.views, 0),
      avgViewsPerProposal:
        proposals.length > 0 ? report.reduce((sum, r) => sum + r.views, 0) / proposals.length : 0,
      statusBreakdown: this.getStatusBreakdown(proposals),
      conversionRate: this.calculateConversionRate(proposals),
      avgConversionTime: this.calculateAvgConversionTime(report),
    };

    let fileBuffer: Buffer;
    let fileName: string;
    let contentType: string;

    switch (dto.format) {
      case ExportFormat.CSV:
        fileBuffer = this.generateAnalyticsCsv(report, summary);
        fileName = `analytics-report-${Date.now()}.csv`;
        contentType = 'text/csv';
        break;

      case ExportFormat.JSON:
        fileBuffer = Buffer.from(JSON.stringify({ summary, proposals: report }, null, 2));
        fileName = `analytics-report-${Date.now()}.json`;
        contentType = 'application/json';
        break;

      case ExportFormat.PDF:
        fileBuffer = await this.generateAnalyticsPdf(report, summary);
        fileName = `analytics-report-${Date.now()}.pdf`;
        contentType = 'application/pdf';
        break;

      default:
        fileBuffer = this.generateAnalyticsCsv(report, summary);
        fileName = `analytics-report-${Date.now()}.csv`;
        contentType = 'text/csv';
    }

    // Upload to storage
    const key = `exports/${userId}/${fileName}`;
    await this.storage.uploadBuffer(fileBuffer, key, contentType);

    // Generate pre-signed download URL
    const downloadUrl = await this.storage.getSignedUrl(key, 3600);
    const expiresAt = new Date(Date.now() + 3600 * 1000);

    return { downloadUrl, expiresAt };
  }

  // Private helper methods
  private async generatePdfExport(proposals: any[], dto: BulkExportDto): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50 });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title page
      doc.fontSize(24).text('Proposals Export', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.fontSize(12).text(`Total Proposals: ${proposals.length}`, { align: 'center' });
      doc.addPage();

      // Each proposal
      for (let i = 0; i < proposals.length; i++) {
        const proposal = proposals[i];

        if (i > 0) doc.addPage();

        doc.fontSize(18).text(proposal.title);
        doc.moveDown(0.5);

        doc.fontSize(10).fillColor('#666666');
        doc.text(`Status: ${proposal.status}`);
        doc.text(
          `Recipient: ${proposal.recipientName || 'N/A'} (${proposal.recipientEmail || 'N/A'})`,
        );
        doc.text(`Created: ${proposal.createdAt.toLocaleDateString()}`);
        if (proposal.sentAt) doc.text(`Sent: ${proposal.sentAt.toLocaleDateString()}`);
        doc.fillColor('#000000');
        doc.moveDown();

        // Add blocks content
        if (proposal.blocks) {
          for (const block of proposal.blocks) {
            if (block.type === 'RICH_TEXT') {
              doc.fontSize(11).text(this.stripHtml(block.content?.html || ''));
              doc.moveDown(0.5);
            } else if (block.type === 'PRICING_TABLE' && block.pricingItems?.length) {
              doc.fontSize(12).text('Pricing', { underline: true });
              doc.moveDown(0.25);

              for (const item of block.pricingItems) {
                doc.fontSize(10).text(`• ${item.name}: $${item.price.toFixed(2)}`);
              }
              doc.moveDown(0.5);
            }
          }
        }

        // Analytics if requested
        if (dto.includeAnalytics && proposal.viewSessions?.length) {
          doc.moveDown();
          doc.fontSize(12).text('Analytics', { underline: true });
          doc.fontSize(10).text(`Total Views: ${proposal.viewSessions.length}`);
          doc.text(
            `Unique Viewers: ${new Set(proposal.viewSessions.map((s: any) => s.visitorId || s.sessionId)).size}`,
          );
        }

        // Comments if requested
        if (dto.includeComments && proposal.comments?.length) {
          doc.moveDown();
          doc.fontSize(12).text('Comments', { underline: true });
          for (const comment of proposal.comments) {
            doc.fontSize(10).text(`${comment.authorName}: ${comment.content}`);
          }
        }
      }

      doc.end();
    });
  }

  private generateCsvExport(proposals: any[], dto: BulkExportDto): Buffer {
    const headers = [
      'ID',
      'Title',
      'Status',
      'Recipient Name',
      'Recipient Email',
      'Created At',
      'Sent At',
      'Views',
      'First Viewed',
      'Last Viewed',
      'Approved At',
      'Signed At',
    ];

    const rows = proposals.map((p) => [
      p.id,
      `"${p.title.replace(/"/g, '""')}"`,
      p.status,
      p.recipientName || '',
      p.recipientEmail || '',
      p.createdAt.toISOString(),
      p.sentAt?.toISOString() || '',
      p.viewCount || 0,
      p.firstViewedAt?.toISOString() || '',
      p.lastViewedAt?.toISOString() || '',
      p.approvedAt?.toISOString() || '',
      p.signedAt?.toISOString() || '',
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    return Buffer.from(csv, 'utf-8');
  }

  private generateJsonExport(proposals: any[], dto: BulkExportDto): Buffer {
    const data = proposals.map((p) => ({
      id: p.id,
      title: p.title,
      status: p.status,
      recipient: {
        name: p.recipientName,
        email: p.recipientEmail,
      },
      dates: {
        created: p.createdAt,
        sent: p.sentAt,
        firstViewed: p.firstViewedAt,
        lastViewed: p.lastViewedAt,
        approved: p.approvedAt,
        signed: p.signedAt,
      },
      analytics: dto.includeAnalytics
        ? {
            views: p.viewCount,
            sessions: p.viewSessions?.length || 0,
          }
        : undefined,
      blocks: p.blocks?.map((b: any) => ({
        type: b.type,
        content: b.content,
        pricingItems: b.pricingItems,
      })),
      comments: dto.includeComments ? p.comments : undefined,
    }));

    return Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
  }

  private async generateXlsxExport(proposals: any[], dto: BulkExportDto): Promise<Buffer> {
    // For XLSX, we'll generate a simple CSV that Excel can open
    // In production, you'd use a library like 'exceljs'
    return this.generateCsvExport(proposals, dto);
  }

  private generateAnalyticsCsv(report: any[], summary: any): Buffer {
    const headers = [
      'Proposal ID',
      'Title',
      'Status',
      'Recipient',
      'Created',
      'Sent',
      'Views',
      'Avg View Duration (s)',
      'First Viewed',
      'Last Viewed',
      'Approved',
      'Signed',
      'Conversion Time (days)',
    ];

    const rows = report.map((r) => [
      r.proposalId,
      `"${r.title.replace(/"/g, '""')}"`,
      r.status,
      r.recipientEmail || '',
      r.createdAt.toISOString(),
      r.sentAt?.toISOString() || '',
      r.views,
      r.avgViewDuration.toFixed(2),
      r.firstViewedAt?.toISOString() || '',
      r.lastViewedAt?.toISOString() || '',
      r.approvedAt?.toISOString() || '',
      r.signedAt?.toISOString() || '',
      r.conversionTime !== null ? r.conversionTime : '',
    ]);

    // Add summary section
    const summaryRows = [
      '',
      'SUMMARY',
      `Total Proposals,${summary.totalProposals}`,
      `Total Views,${summary.totalViews}`,
      `Avg Views Per Proposal,${summary.avgViewsPerProposal.toFixed(2)}`,
      `Conversion Rate,${(summary.conversionRate * 100).toFixed(2)}%`,
      `Avg Conversion Time (days),${summary.avgConversionTime?.toFixed(1) || 'N/A'}`,
    ];

    const csv = [headers.join(','), ...rows.map((r) => r.join(',')), ...summaryRows].join('\n');

    return Buffer.from(csv, 'utf-8');
  }

  private async generateAnalyticsPdf(report: any[], summary: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50 });

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Title
      doc.fontSize(24).text('Analytics Report', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown(2);

      // Summary
      doc.fontSize(16).text('Summary');
      doc.moveDown(0.5);
      doc.fontSize(11);
      doc.text(`Total Proposals: ${summary.totalProposals}`);
      doc.text(`Total Views: ${summary.totalViews}`);
      doc.text(`Average Views per Proposal: ${summary.avgViewsPerProposal.toFixed(2)}`);
      doc.text(`Conversion Rate: ${(summary.conversionRate * 100).toFixed(2)}%`);
      doc.text(`Average Conversion Time: ${summary.avgConversionTime?.toFixed(1) || 'N/A'} days`);
      doc.moveDown(2);

      // Status breakdown
      doc.fontSize(14).text('Status Breakdown');
      doc.moveDown(0.5);
      for (const [status, count] of Object.entries(summary.statusBreakdown)) {
        doc.fontSize(10).text(`${status}: ${count}`);
      }
      doc.moveDown(2);

      // Top proposals
      doc.fontSize(14).text('Proposal Details');
      doc.moveDown(0.5);

      for (const item of report.slice(0, 20)) {
        doc.fontSize(10);
        doc.text(`${item.title} - ${item.status}`);
        doc.fillColor('#666666');
        doc.text(`  Views: ${item.views} | Recipient: ${item.recipientEmail || 'N/A'}`);
        doc.fillColor('#000000');
        doc.moveDown(0.25);
      }

      doc.end();
    });
  }

  private getStatusBreakdown(proposals: any[]): Record<string, number> {
    return proposals.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {});
  }

  private calculateConversionRate(proposals: any[]): number {
    const sent = proposals.filter((p) => p.sentAt).length;
    const signed = proposals.filter((p) => p.signedAt).length;
    return sent > 0 ? signed / sent : 0;
  }

  private calculateAvgConversionTime(report: any[]): number | null {
    const conversions = report.filter((r) => r.conversionTime !== null);
    if (conversions.length === 0) return null;
    return conversions.reduce((sum, r) => sum + r.conversionTime, 0) / conversions.length;
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .trim();
  }
}
