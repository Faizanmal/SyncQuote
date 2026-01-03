import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CrmProviderInterface } from '../crm-integrations.service';
import { CrmContactDto, CrmDealDto } from '../dto/crm.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class HubspotService implements CrmProviderInterface {
  private readonly logger = new Logger(HubspotService.name);
  private readonly baseUrl = 'https://api.hubapi.com';
  private readonly authUrl = 'https://app.hubspot.com/oauth/authorize';
  private readonly tokenUrl = 'https://api.hubapi.com/oauth/v1/token';

  constructor(
    private http: HttpService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  getAuthorizationUrl(userId: string): string {
    const clientId = this.config.get('HUBSPOT_CLIENT_ID');
    const redirectUri = this.config.get('HUBSPOT_REDIRECT_URI');
    const scopes = [
      'crm.objects.contacts.read',
      'crm.objects.contacts.write',
      'crm.objects.deals.read',
      'crm.objects.deals.write',
      'crm.schemas.deals.read',
    ].join(' ');

    return `${this.authUrl}?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}&state=${userId}`;
  }

  async handleCallback(code: string, userId: string): Promise<any> {
    const clientId = this.config.get('HUBSPOT_CLIENT_ID');
    const clientSecret = this.config.get('HUBSPOT_CLIENT_SECRET');
    const redirectUri = this.config.get('HUBSPOT_REDIRECT_URI');

    const response = await firstValueFrom(
      this.http.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      ),
    );

    const { access_token, refresh_token, expires_in } = response.data;

    // Get account info
    const accountInfo = await firstValueFrom(
      this.http.get(`${this.baseUrl}/account-info/v3/api-usage/daily/private-apps`, {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
    ).catch(() => ({ data: {} }));

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: new Date(Date.now() + expires_in * 1000),
      metadata: {
        portalId: accountInfo.data?.portalId,
      },
    };
  }

  async refreshToken(userId: string): Promise<any> {
    const integration = await this.prisma.crmIntegration.findUnique({
      where: { userId_provider: { userId, provider: 'hubspot' } },
    });

    if (!integration?.refreshToken) {
      throw new UnauthorizedException('No refresh token available');
    }

    const clientId = this.config.get('HUBSPOT_CLIENT_ID');
    const clientSecret = this.config.get('HUBSPOT_CLIENT_SECRET');

    const response = await firstValueFrom(
      this.http.post(
        this.tokenUrl,
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: integration.refreshToken,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      ),
    );

    const { access_token, refresh_token, expires_in } = response.data;

    await this.prisma.crmIntegration.update({
      where: { userId_provider: { userId, provider: 'hubspot' } },
      data: {
        accessToken: access_token,
        refreshToken: refresh_token || integration.refreshToken,
        expiresAt: new Date(Date.now() + expires_in * 1000),
      },
    });

    return { accessToken: access_token };
  }

  private async getAccessToken(userId: string): Promise<string> {
    const integration = await this.prisma.crmIntegration.findUnique({
      where: { userId_provider: { userId, provider: 'hubspot' } },
    });

    if (!integration?.accessToken) {
      throw new UnauthorizedException('HubSpot not connected');
    }

    return integration.accessToken;
  }

  async getContacts(userId: string, limit = 100, offset = 0): Promise<CrmContactDto[]> {
    const token = await this.getAccessToken(userId);

    const response = await firstValueFrom(
      this.http.get(`${this.baseUrl}/crm/v3/objects/contacts`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          limit,
          after: offset > 0 ? offset : undefined,
          properties: 'firstname,lastname,email,company,phone',
        },
      }),
    );

    return response.data.results.map((contact: any) => ({
      id: contact.id,
      email: contact.properties.email,
      firstName: contact.properties.firstname,
      lastName: contact.properties.lastname,
      company: contact.properties.company,
      phone: contact.properties.phone,
      customFields: contact.properties,
    }));
  }

  async getContact(userId: string, contactId: string): Promise<CrmContactDto> {
    const token = await this.getAccessToken(userId);

    const response = await firstValueFrom(
      this.http.get(`${this.baseUrl}/crm/v3/objects/contacts/${contactId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          properties: 'firstname,lastname,email,company,phone',
        },
      }),
    );

    const contact = response.data;
    return {
      id: contact.id,
      email: contact.properties.email,
      firstName: contact.properties.firstname,
      lastName: contact.properties.lastname,
      company: contact.properties.company,
      phone: contact.properties.phone,
      customFields: contact.properties,
    };
  }

  async createContact(userId: string, contact: Partial<CrmContactDto>): Promise<CrmContactDto> {
    const token = await this.getAccessToken(userId);

    const response = await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/crm/v3/objects/contacts`,
        {
          properties: {
            email: contact.email,
            firstname: contact.firstName,
            lastname: contact.lastName,
            company: contact.company,
            phone: contact.phone,
            ...contact.customFields,
          },
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    return {
      id: response.data.id,
      email: response.data.properties.email,
      firstName: response.data.properties.firstname,
      lastName: response.data.properties.lastname,
      company: response.data.properties.company,
      phone: response.data.properties.phone,
    };
  }

  async updateContact(
    userId: string,
    contactId: string,
    contact: Partial<CrmContactDto>,
  ): Promise<CrmContactDto> {
    const token = await this.getAccessToken(userId);

    const properties: any = {};
    if (contact.email) properties.email = contact.email;
    if (contact.firstName) properties.firstname = contact.firstName;
    if (contact.lastName) properties.lastname = contact.lastName;
    if (contact.company) properties.company = contact.company;
    if (contact.phone) properties.phone = contact.phone;
    if (contact.customFields) Object.assign(properties, contact.customFields);

    const response = await firstValueFrom(
      this.http.patch(
        `${this.baseUrl}/crm/v3/objects/contacts/${contactId}`,
        {
          properties,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    return {
      id: response.data.id,
      email: response.data.properties.email,
      firstName: response.data.properties.firstname,
      lastName: response.data.properties.lastname,
      company: response.data.properties.company,
      phone: response.data.properties.phone,
    };
  }

  async getDeals(userId: string, limit = 100, offset = 0): Promise<CrmDealDto[]> {
    const token = await this.getAccessToken(userId);

    const response = await firstValueFrom(
      this.http.get(`${this.baseUrl}/crm/v3/objects/deals`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          limit,
          after: offset > 0 ? offset : undefined,
          properties: 'dealname,dealstage,amount,closedate',
        },
      }),
    );

    return response.data.results.map((deal: any) => ({
      id: deal.id,
      name: deal.properties.dealname,
      stage: deal.properties.dealstage,
      amount: parseFloat(deal.properties.amount) || 0,
      customFields: deal.properties,
    }));
  }

  async getDeal(userId: string, dealId: string): Promise<CrmDealDto> {
    const token = await this.getAccessToken(userId);

    const response = await firstValueFrom(
      this.http.get(`${this.baseUrl}/crm/v3/objects/deals/${dealId}`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          properties: 'dealname,dealstage,amount,closedate',
        },
      }),
    );

    return {
      id: response.data.id,
      name: response.data.properties.dealname,
      stage: response.data.properties.dealstage,
      amount: parseFloat(response.data.properties.amount) || 0,
      customFields: response.data.properties,
    };
  }

  async createDeal(userId: string, deal: Partial<CrmDealDto>): Promise<CrmDealDto> {
    const token = await this.getAccessToken(userId);

    const response = await firstValueFrom(
      this.http.post(
        `${this.baseUrl}/crm/v3/objects/deals`,
        {
          properties: {
            dealname: deal.name,
            amount: deal.amount?.toString(),
            dealstage: deal.stage,
            ...deal.customFields,
          },
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    return {
      id: response.data.id,
      name: response.data.properties.dealname,
      stage: response.data.properties.dealstage,
      amount: parseFloat(response.data.properties.amount) || 0,
    };
  }

  async updateDeal(userId: string, dealId: string, deal: Partial<CrmDealDto>): Promise<CrmDealDto> {
    const token = await this.getAccessToken(userId);

    const properties: any = {};
    if (deal.name) properties.dealname = deal.name;
    if (deal.amount !== undefined) properties.amount = deal.amount.toString();
    if (deal.stage) properties.dealstage = deal.stage;
    if (deal.customFields) Object.assign(properties, deal.customFields);

    const response = await firstValueFrom(
      this.http.patch(
        `${this.baseUrl}/crm/v3/objects/deals/${dealId}`,
        {
          properties,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    return {
      id: response.data.id,
      name: response.data.properties.dealname,
      stage: response.data.properties.dealstage,
      amount: parseFloat(response.data.properties.amount) || 0,
    };
  }

  async getStages(userId: string): Promise<Array<{ id: string; name: string }>> {
    const token = await this.getAccessToken(userId);

    const response = await firstValueFrom(
      this.http.get(`${this.baseUrl}/crm/v3/pipelines/deals`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    const stages: Array<{ id: string; name: string }> = [];
    for (const pipeline of response.data.results) {
      for (const stage of pipeline.stages) {
        stages.push({
          id: stage.id,
          name: `${pipeline.label} - ${stage.label}`,
        });
      }
    }

    return stages;
  }

  async disconnect(userId: string): Promise<void> {
    // HubSpot tokens can't be revoked via API, just remove from our DB
    this.logger.log(`Disconnecting HubSpot for user ${userId}`);
  }
}
