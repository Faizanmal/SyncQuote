import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CrmProviderInterface } from '../crm-integrations.service';
import { CrmContactDto, CrmDealDto } from '../dto/crm.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PipedriveService implements CrmProviderInterface {
  private readonly logger = new Logger(PipedriveService.name);
  private readonly authUrl = 'https://oauth.pipedrive.com/oauth/authorize';
  private readonly tokenUrl = 'https://oauth.pipedrive.com/oauth/token';

  constructor(
    private http: HttpService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  getAuthorizationUrl(userId: string): string {
    const clientId = this.config.get('PIPEDRIVE_CLIENT_ID');
    const redirectUri = this.config.get('PIPEDRIVE_REDIRECT_URI');

    return `${this.authUrl}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${userId}`;
  }

  async handleCallback(code: string, userId: string): Promise<any> {
    const clientId = this.config.get('PIPEDRIVE_CLIENT_ID');
    const clientSecret = this.config.get('PIPEDRIVE_CLIENT_SECRET');
    const redirectUri = this.config.get('PIPEDRIVE_REDIRECT_URI');

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await firstValueFrom(
      this.http.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${credentials}`,
          },
        },
      ),
    );

    const { access_token, refresh_token, expires_in, api_domain } = response.data;

    // Get company info
    const userInfo = await firstValueFrom(
      this.http.get(`${api_domain}/api/v1/users/me`, {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
    );

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: new Date(Date.now() + expires_in * 1000),
      metadata: {
        apiDomain: api_domain,
        companyId: userInfo.data.data.company_id,
        companyDomain: userInfo.data.data.company_domain,
      },
    };
  }

  async refreshToken(userId: string): Promise<any> {
    const integration = await this.prisma.crmIntegration.findUnique({
      where: { userId_provider: { userId, provider: 'pipedrive' } },
    });

    if (!integration?.refreshToken) {
      throw new UnauthorizedException('No refresh token available');
    }

    const clientId = this.config.get('PIPEDRIVE_CLIENT_ID');
    const clientSecret = this.config.get('PIPEDRIVE_CLIENT_SECRET');
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const response = await firstValueFrom(
      this.http.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: integration.refreshToken,
        }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${credentials}`,
          },
        },
      ),
    );

    const { access_token, refresh_token, expires_in, api_domain } = response.data;

    await this.prisma.crmIntegration.update({
      where: { userId_provider: { userId, provider: 'pipedrive' } },
      data: {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresAt: new Date(Date.now() + expires_in * 1000),
        metadata: {
          ...((integration.metadata as any) || {}),
          apiDomain: api_domain,
        },
      },
    });

    return { accessToken: access_token };
  }

  private async getCredentials(userId: string): Promise<{ token: string; apiDomain: string }> {
    const integration = await this.prisma.crmIntegration.findUnique({
      where: { userId_provider: { userId, provider: 'pipedrive' } },
    });

    if (!integration?.accessToken) {
      throw new UnauthorizedException('Pipedrive not connected');
    }

    const metadata = integration.metadata as any;
    return {
      token: integration.accessToken,
      apiDomain: metadata?.apiDomain || 'https://api.pipedrive.com',
    };
  }

  async getContacts(userId: string, limit = 100, offset = 0): Promise<CrmContactDto[]> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.get(`${apiDomain}/api/v1/persons`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { start: offset, limit },
      }),
    );

    return (response.data.data || []).map((person: any) => ({
      id: person.id.toString(),
      email: person.email?.[0]?.value || '',
      firstName: person.first_name,
      lastName: person.last_name,
      company: person.org_name,
      phone: person.phone?.[0]?.value,
    }));
  }

  async getContact(userId: string, contactId: string): Promise<CrmContactDto> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.get(`${apiDomain}/api/v1/persons/${contactId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    const person = response.data.data;
    return {
      id: person.id.toString(),
      email: person.email?.[0]?.value || '',
      firstName: person.first_name,
      lastName: person.last_name,
      company: person.org_name,
      phone: person.phone?.[0]?.value,
    };
  }

  async createContact(userId: string, contact: Partial<CrmContactDto>): Promise<CrmContactDto> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.post(
        `${apiDomain}/api/v1/persons`,
        {
          name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown',
          email: contact.email ? [{ value: contact.email, primary: true }] : undefined,
          phone: contact.phone ? [{ value: contact.phone, primary: true }] : undefined,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    const person = response.data.data;
    return {
      id: person.id.toString(),
      email: person.email?.[0]?.value || '',
      firstName: person.first_name,
      lastName: person.last_name,
      phone: person.phone?.[0]?.value,
    };
  }

  async updateContact(
    userId: string,
    contactId: string,
    contact: Partial<CrmContactDto>,
  ): Promise<CrmContactDto> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const updateData: any = {};
    if (contact.firstName || contact.lastName) {
      updateData.name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
    }
    if (contact.email) {
      updateData.email = [{ value: contact.email, primary: true }];
    }
    if (contact.phone) {
      updateData.phone = [{ value: contact.phone, primary: true }];
    }

    await firstValueFrom(
      this.http.put(`${apiDomain}/api/v1/persons/${contactId}`, updateData, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    return this.getContact(userId, contactId);
  }

  async getDeals(userId: string, limit = 100, offset = 0): Promise<CrmDealDto[]> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.get(`${apiDomain}/api/v1/deals`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { start: offset, limit },
      }),
    );

    return (response.data.data || []).map((deal: any) => ({
      id: deal.id.toString(),
      name: deal.title,
      stage: deal.stage_id?.toString(),
      amount: deal.value || 0,
      contactId: deal.person_id?.toString(),
    }));
  }

  async getDeal(userId: string, dealId: string): Promise<CrmDealDto> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.get(`${apiDomain}/api/v1/deals/${dealId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    const deal = response.data.data;
    return {
      id: deal.id.toString(),
      name: deal.title,
      stage: deal.stage_id?.toString(),
      amount: deal.value || 0,
      contactId: deal.person_id?.toString(),
    };
  }

  async createDeal(userId: string, deal: Partial<CrmDealDto>): Promise<CrmDealDto> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.post(
        `${apiDomain}/api/v1/deals`,
        {
          title: deal.name,
          value: deal.amount,
          stage_id: deal.stage ? parseInt(deal.stage) : undefined,
          person_id: deal.contactId ? parseInt(deal.contactId) : undefined,
          ...deal.customFields,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    const createdDeal = response.data.data;
    return {
      id: createdDeal.id.toString(),
      name: createdDeal.title,
      stage: createdDeal.stage_id?.toString(),
      amount: createdDeal.value || 0,
    };
  }

  async updateDeal(userId: string, dealId: string, deal: Partial<CrmDealDto>): Promise<CrmDealDto> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const updateData: any = {};
    if (deal.name) updateData.title = deal.name;
    if (deal.amount !== undefined) updateData.value = deal.amount;
    if (deal.stage) updateData.stage_id = parseInt(deal.stage);

    await firstValueFrom(
      this.http.put(`${apiDomain}/api/v1/deals/${dealId}`, updateData, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    return this.getDeal(userId, dealId);
  }

  async getStages(userId: string): Promise<Array<{ id: string; name: string }>> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.get(`${apiDomain}/api/v1/stages`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    return (response.data.data || []).map((stage: any) => ({
      id: stage.id.toString(),
      name: `${stage.pipeline_name} - ${stage.name}`,
    }));
  }

  async disconnect(userId: string): Promise<void> {
    const { token } = await this.getCredentials(userId);

    // Revoke Pipedrive token
    await firstValueFrom(
      this.http.post(
        'https://oauth.pipedrive.com/oauth/revoke',
        new URLSearchParams({
          token,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      ),
    ).catch((err) => {
      this.logger.warn('Failed to revoke Pipedrive token', err.message);
    });
  }
}
