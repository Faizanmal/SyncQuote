import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { google, drive_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';

export interface DocumentFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  url?: string;
  thumbnailUrl?: string;
  createdAt?: Date;
  modifiedAt?: Date;
  provider: 'google_drive' | 'dropbox' | 'onedrive';
}

export interface UploadResult {
  id: string;
  name: string;
  url: string;
  provider: string;
}

@Injectable()
export class DocumentManagementService {
  private readonly logger = new Logger(DocumentManagementService.name);
  private googleOAuth2Client: OAuth2Client;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.googleOAuth2Client = new OAuth2Client(
      this.configService.get('GOOGLE_CLIENT_ID'),
      this.configService.get('GOOGLE_CLIENT_SECRET'),
      this.configService.get('GOOGLE_DRIVE_REDIRECT_URI'),
    );
  }

  // ==================== Google Drive ====================

  async getGoogleDriveAuthUrl(userId: string): Promise<string> {
    const scopes = [
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
    ];

    return this.googleOAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: userId,
      prompt: 'consent',
    });
  }

  async handleGoogleDriveCallback(userId: string, code: string): Promise<void> {
    const { tokens } = await this.googleOAuth2Client.getToken(code);

    await this.prisma.oAuthToken.upsert({
      where: {
        userId_provider: { userId, provider: 'google_drive' },
      },
      create: {
        userId,
        provider: 'google_drive',
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      },
      update: {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token || undefined,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      },
    });

    this.logger.log(`Google Drive connected for user ${userId}`);
  }

  async listGoogleDriveFiles(
    userId: string,
    folderId?: string,
    query?: string,
  ): Promise<DocumentFile[]> {
    const drive = await this.getGoogleDrive(userId);

    let q = "trashed = false";
    if (folderId) {
      q += ` and '${folderId}' in parents`;
    }
    if (query) {
      q += ` and name contains '${query}'`;
    }

    const result = await drive.files.list({
      q,
      fields: 'files(id, name, mimeType, size, webViewLink, thumbnailLink, createdTime, modifiedTime)',
      orderBy: 'modifiedTime desc',
      pageSize: 50,
    });

    return (result.data.files || []).map(file => ({
      id: file.id!,
      name: file.name!,
      mimeType: file.mimeType!,
      size: file.size ? parseInt(file.size) : undefined,
      url: file.webViewLink || undefined,
      thumbnailUrl: file.thumbnailLink || undefined,
      createdAt: file.createdTime ? new Date(file.createdTime) : undefined,
      modifiedAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
      provider: 'google_drive' as const,
    }));
  }

  async uploadToGoogleDrive(
    userId: string,
    file: Buffer,
    fileName: string,
    mimeType: string,
    folderId?: string,
  ): Promise<UploadResult> {
    const drive = await this.getGoogleDrive(userId);

    const fileMetadata: drive_v3.Schema$File = {
      name: fileName,
      parents: folderId ? [folderId] : undefined,
    };

    const media = {
      mimeType,
      body: require('stream').Readable.from(file),
    };

    const result = await drive.files.create({
      requestBody: fileMetadata,
      media,
      fields: 'id, name, webViewLink',
    });

    return {
      id: result.data.id!,
      name: result.data.name!,
      url: result.data.webViewLink!,
      provider: 'google_drive',
    };
  }

  async downloadFromGoogleDrive(userId: string, fileId: string): Promise<Buffer> {
    const drive = await this.getGoogleDrive(userId);

    const response = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' },
    );

    return Buffer.from(response.data as ArrayBuffer);
  }

  async createGoogleDriveFolder(userId: string, folderName: string, parentId?: string): Promise<string> {
    const drive = await this.getGoogleDrive(userId);

    const fileMetadata: drive_v3.Schema$File = {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
    };

    const result = await drive.files.create({
      requestBody: fileMetadata,
      fields: 'id',
    });

    return result.data.id!;
  }

  // ==================== Dropbox ====================

  async getDropboxAuthUrl(userId: string): Promise<string> {
    const clientId = this.configService.get('DROPBOX_CLIENT_ID');
    const redirectUri = this.configService.get('DROPBOX_REDIRECT_URI');

    return `https://www.dropbox.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&state=${userId}&token_access_type=offline`;
  }

  async handleDropboxCallback(userId: string, code: string): Promise<void> {
    const clientId = this.configService.get('DROPBOX_CLIENT_ID');
    const clientSecret = this.configService.get('DROPBOX_CLIENT_SECRET');
    const redirectUri = this.configService.get('DROPBOX_REDIRECT_URI');

    const response = await axios.post(
      'https://api.dropboxapi.com/oauth2/token',
      new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    await this.prisma.oAuthToken.upsert({
      where: {
        userId_provider: { userId, provider: 'dropbox' },
      },
      create: {
        userId,
        provider: 'dropbox',
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: response.data.expires_in 
          ? new Date(Date.now() + response.data.expires_in * 1000) 
          : undefined,
      },
      update: {
        accessToken: response.data.access_token,
        refreshToken: response.data.refresh_token,
        expiresAt: response.data.expires_in 
          ? new Date(Date.now() + response.data.expires_in * 1000) 
          : undefined,
      },
    });

    this.logger.log(`Dropbox connected for user ${userId}`);
  }

  async listDropboxFiles(userId: string, path = ''): Promise<DocumentFile[]> {
    const accessToken = await this.getDropboxToken(userId);

    const response = await axios.post(
      'https://api.dropboxapi.com/2/files/list_folder',
      { path: path || '', limit: 50 },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    return response.data.entries.map((entry: any) => ({
      id: entry.id,
      name: entry.name,
      mimeType: entry['.tag'] === 'folder' ? 'folder' : this.getMimeType(entry.name),
      size: entry.size,
      modifiedAt: entry.server_modified ? new Date(entry.server_modified) : undefined,
      provider: 'dropbox' as const,
    }));
  }

  async uploadToDropbox(
    userId: string,
    file: Buffer,
    fileName: string,
    path = '',
  ): Promise<UploadResult> {
    const accessToken = await this.getDropboxToken(userId);
    const filePath = path ? `${path}/${fileName}` : `/${fileName}`;

    const response = await axios.post(
      'https://content.dropboxapi.com/2/files/upload',
      file,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/octet-stream',
          'Dropbox-API-Arg': JSON.stringify({
            path: filePath,
            mode: 'add',
            autorename: true,
          }),
        },
      },
    );

    // Get shareable link
    const shareResponse = await axios.post(
      'https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings',
      { path: response.data.path_lower },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    ).catch(() => ({ data: { url: '' } }));

    return {
      id: response.data.id,
      name: response.data.name,
      url: shareResponse.data.url,
      provider: 'dropbox',
    };
  }

  async downloadFromDropbox(userId: string, path: string): Promise<Buffer> {
    const accessToken = await this.getDropboxToken(userId);

    const response = await axios.post(
      'https://content.dropboxapi.com/2/files/download',
      null,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Dropbox-API-Arg': JSON.stringify({ path }),
        },
        responseType: 'arraybuffer',
      },
    );

    return Buffer.from(response.data);
  }

  // ==================== Proposal Integration ====================

  async saveProposalToCloud(
    userId: string,
    proposalId: string,
    provider: 'google_drive' | 'dropbox',
  ): Promise<UploadResult> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, userId },
      include: { blocks: true },
    });

    if (!proposal) {
      throw new BadRequestException('Proposal not found');
    }

    // Generate proposal content as JSON
    const content = JSON.stringify({
      title: proposal.title,
      status: proposal.status,
      blocks: proposal.blocks,
      createdAt: proposal.createdAt,
      updatedAt: proposal.updatedAt,
    }, null, 2);

    const fileName = `SyncQuote_${proposal.title.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.json`;

    if (provider === 'google_drive') {
      return this.uploadToGoogleDrive(
        userId,
        Buffer.from(content),
        fileName,
        'application/json',
      );
    } else {
      return this.uploadToDropbox(userId, Buffer.from(content), fileName);
    }
  }

  async attachFileToProposal(
    userId: string,
    proposalId: string,
    fileId: string,
    provider: 'google_drive' | 'dropbox',
  ): Promise<void> {
    const proposal = await this.prisma.proposal.findFirst({
      where: { id: proposalId, userId },
    });

    if (!proposal) {
      throw new BadRequestException('Proposal not found');
    }

    // Store attachment reference in proposal metadata
    const currentMetadata = (proposal.metadata as any) || {};
    const attachments = currentMetadata.attachments || [];
    
    attachments.push({
      fileId,
      provider,
      attachedAt: new Date().toISOString(),
    });

    await this.prisma.proposal.update({
      where: { id: proposalId },
      data: {
        metadata: { ...currentMetadata, attachments },
      },
    });
  }

  // ==================== Helper Methods ====================

  private async getGoogleDrive(userId: string): Promise<drive_v3.Drive> {
    const token = await this.prisma.oAuthToken.findUnique({
      where: {
        userId_provider: { userId, provider: 'google_drive' },
      },
    });

    if (!token) {
      throw new BadRequestException('Google Drive not connected');
    }

    this.googleOAuth2Client.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken || undefined,
    });

    if (token.expiresAt && token.expiresAt < new Date()) {
      const { credentials } = await this.googleOAuth2Client.refreshAccessToken();
      
      await this.prisma.oAuthToken.update({
        where: { id: token.id },
        data: {
          accessToken: credentials.access_token!,
          expiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined,
        },
      });

      this.googleOAuth2Client.setCredentials(credentials);
    }

    return google.drive({ version: 'v3', auth: this.googleOAuth2Client });
  }

  private async getDropboxToken(userId: string): Promise<string> {
    const token = await this.prisma.oAuthToken.findUnique({
      where: {
        userId_provider: { userId, provider: 'dropbox' },
      },
    });

    if (!token) {
      throw new BadRequestException('Dropbox not connected');
    }

    // Refresh token if expired
    if (token.expiresAt && token.expiresAt < new Date() && token.refreshToken) {
      const clientId = this.configService.get('DROPBOX_CLIENT_ID');
      const clientSecret = this.configService.get('DROPBOX_CLIENT_SECRET');

      const response = await axios.post(
        'https://api.dropboxapi.com/oauth2/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: token.refreshToken,
          client_id: clientId,
          client_secret: clientSecret,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      await this.prisma.oAuthToken.update({
        where: { id: token.id },
        data: {
          accessToken: response.data.access_token,
          expiresAt: new Date(Date.now() + response.data.expires_in * 1000),
        },
      });

      return response.data.access_token;
    }

    return token.accessToken;
  }

  private getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      txt: 'text/plain',
      csv: 'text/csv',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  async getConnectionStatus(userId: string): Promise<{
    googleDrive: boolean;
    dropbox: boolean;
    oneDrive: boolean;
  }> {
    const tokens = await this.prisma.oAuthToken.findMany({
      where: { userId, provider: { in: ['google_drive', 'dropbox', 'onedrive'] } },
      select: { provider: true },
    });

    return {
      googleDrive: tokens.some(t => t.provider === 'google_drive'),
      dropbox: tokens.some(t => t.provider === 'dropbox'),
      oneDrive: tokens.some(t => t.provider === 'onedrive'),
    };
  }

  async disconnectProvider(userId: string, provider: string): Promise<void> {
    await this.prisma.oAuthToken.deleteMany({
      where: { userId, provider },
    });
    this.logger.log(`${provider} disconnected for user ${userId}`);
  }
}
