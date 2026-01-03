import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CrmProviderInterface } from '../crm-integrations.service';
import { CrmContactDto, CrmDealDto } from '../dto/crm.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class SalesforceService implements CrmProviderInterface {
  private readonly logger = new Logger(SalesforceService.name);
  private readonly authUrl = 'https://login.salesforce.com/services/oauth2/authorize';
  private readonly tokenUrl = 'https://login.salesforce.com/services/oauth2/token';

  constructor(
    private http: HttpService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  getAuthorizationUrl(userId: string): string {
    const clientId = this.config.get('SALESFORCE_CLIENT_ID');
    const redirectUri = this.config.get('SALESFORCE_REDIRECT_URI');

    return `${this.authUrl}?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${userId}`;
  }

  async handleCallback(code: string, userId: string): Promise<any> {
    const clientId = this.config.get('SALESFORCE_CLIENT_ID');
    const clientSecret = this.config.get('SALESFORCE_CLIENT_SECRET');
    const redirectUri = this.config.get('SALESFORCE_REDIRECT_URI');

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

    const { access_token, refresh_token, instance_url, id } = response.data;

    // Get org info
    const identityResponse = await firstValueFrom(
      this.http.get(id, {
        headers: { Authorization: `Bearer ${access_token}` },
      }),
    );

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000), // Salesforce tokens typically expire in 2 hours
      metadata: {
        instanceUrl: instance_url,
        organizationId: identityResponse.data.organization_id,
        userId: identityResponse.data.user_id,
      },
    };
  }

  async refreshToken(userId: string): Promise<any> {
    const integration = await this.prisma.crmIntegration.findUnique({
      where: { userId_provider: { userId, provider: 'salesforce' } },
    });

    if (!integration?.refreshToken) {
      throw new UnauthorizedException('No refresh token available');
    }

    const clientId = this.config.get('SALESFORCE_CLIENT_ID');
    const clientSecret = this.config.get('SALESFORCE_CLIENT_SECRET');

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

    const { access_token, instance_url } = response.data;

    await this.prisma.crmIntegration.update({
      where: { userId_provider: { userId, provider: 'salesforce' } },
      data: {
        accessToken: access_token,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
        metadata: {
          ...((integration.metadata as any) || {}),
          instanceUrl: instance_url,
        },
      },
    });

    return { accessToken: access_token };
  }

  private async getCredentials(userId: string): Promise<{ token: string; instanceUrl: string }> {
    const integration = await this.prisma.crmIntegration.findUnique({
      where: { userId_provider: { userId, provider: 'salesforce' } },
    });

    if (!integration?.accessToken) {
      throw new UnauthorizedException('Salesforce not connected');
    }

    const metadata = integration.metadata as any;
    return {
      token: integration.accessToken,
      instanceUrl: metadata?.instanceUrl || 'https://na1.salesforce.com',
    };
  }

  async getContacts(userId: string, limit = 100, offset = 0): Promise<CrmContactDto[]> {
    const { token, instanceUrl } = await this.getCredentials(userId);

    const query = `SELECT Id, Email, FirstName, LastName, Account.Name, Phone FROM Contact LIMIT ${limit} OFFSET ${offset}`;

    const response = await firstValueFrom(
      this.http.get(`${instanceUrl}/services/data/v58.0/query`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { q: query },
      }),
    );

    return response.data.records.map((contact: any) => ({
      id: contact.Id,
      email: contact.Email,
      firstName: contact.FirstName,
      lastName: contact.LastName,
      company: contact.Account?.Name,
      phone: contact.Phone,
    }));
  }

  async getContact(userId: string, contactId: string): Promise<CrmContactDto> {
    const { token, instanceUrl } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.get(`${instanceUrl}/services/data/v58.0/sobjects/Contact/${contactId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    return {
      id: response.data.Id,
      email: response.data.Email,
      firstName: response.data.FirstName,
      lastName: response.data.LastName,
      company: response.data.Account?.Name,
      phone: response.data.Phone,
    };
  }

  async createContact(userId: string, contact: Partial<CrmContactDto>): Promise<CrmContactDto> {
    const { token, instanceUrl } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.post(
        `${instanceUrl}/services/data/v58.0/sobjects/Contact`,
        {
          Email: contact.email,
          FirstName: contact.firstName,
          LastName: contact.lastName || 'Unknown',
          Phone: contact.phone,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    return {
      id: response.data.id,
      email: contact.email!,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
    };
  }

  async updateContact(
    userId: string,
    contactId: string,
    contact: Partial<CrmContactDto>,
  ): Promise<CrmContactDto> {
    const { token, instanceUrl } = await this.getCredentials(userId);

    const updateData: any = {};
    if (contact.email) updateData.Email = contact.email;
    if (contact.firstName) updateData.FirstName = contact.firstName;
    if (contact.lastName) updateData.LastName = contact.lastName;
    if (contact.phone) updateData.Phone = contact.phone;

    await firstValueFrom(
      this.http.patch(
        `${instanceUrl}/services/data/v58.0/sobjects/Contact/${contactId}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    return this.getContact(userId, contactId);
  }

  async getDeals(userId: string, limit = 100, offset = 0): Promise<CrmDealDto[]> {
    const { token, instanceUrl } = await this.getCredentials(userId);

    const query = `SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity LIMIT ${limit} OFFSET ${offset}`;

    const response = await firstValueFrom(
      this.http.get(`${instanceUrl}/services/data/v58.0/query`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { q: query },
      }),
    );

    return response.data.records.map((opp: any) => ({
      id: opp.Id,
      name: opp.Name,
      stage: opp.StageName,
      amount: opp.Amount || 0,
    }));
  }

  async getDeal(userId: string, dealId: string): Promise<CrmDealDto> {
    const { token, instanceUrl } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.get(`${instanceUrl}/services/data/v58.0/sobjects/Opportunity/${dealId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    return {
      id: response.data.Id,
      name: response.data.Name,
      stage: response.data.StageName,
      amount: response.data.Amount || 0,
    };
  }

  async createDeal(userId: string, deal: Partial<CrmDealDto>): Promise<CrmDealDto> {
    const { token, instanceUrl } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.post(
        `${instanceUrl}/services/data/v58.0/sobjects/Opportunity`,
        {
          Name: deal.name,
          Amount: deal.amount,
          StageName: deal.stage || 'Prospecting',
          CloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          ...deal.customFields,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    return {
      id: response.data.id,
      name: deal.name!,
      stage: deal.stage,
      amount: deal.amount,
    };
  }

  async updateDeal(userId: string, dealId: string, deal: Partial<CrmDealDto>): Promise<CrmDealDto> {
    const { token, instanceUrl } = await this.getCredentials(userId);

    const updateData: any = {};
    if (deal.name) updateData.Name = deal.name;
    if (deal.amount !== undefined) updateData.Amount = deal.amount;
    if (deal.stage) updateData.StageName = deal.stage;

    await firstValueFrom(
      this.http.patch(
        `${instanceUrl}/services/data/v58.0/sobjects/Opportunity/${dealId}`,
        updateData,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      ),
    );

    return this.getDeal(userId, dealId);
  }

  async getStages(userId: string): Promise<Array<{ id: string; name: string }>> {
    const { token, instanceUrl } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.get(`${instanceUrl}/services/data/v58.0/sobjects/Opportunity/describe`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );

    const stageField = response.data.fields.find((f: any) => f.name === 'StageName');
    if (!stageField?.picklistValues) {
      return [];
    }

    return stageField.picklistValues
      .filter((pv: any) => pv.active)
      .map((pv: any) => ({
        id: pv.value,
        name: pv.label,
      }));
  }

  async disconnect(userId: string): Promise<void> {
    const { token } = await this.getCredentials(userId);

    // Revoke Salesforce token
    await firstValueFrom(
      this.http.post(
        'https://login.salesforce.com/services/oauth2/revoke',
        new URLSearchParams({
          token,
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        },
      ),
    ).catch((err) => {
      this.logger.warn('Failed to revoke Salesforce token', err.message);
    });
  }
}
