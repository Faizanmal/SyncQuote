import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CrmProviderInterface } from '../crm-integrations.service';
import { CrmContactDto, CrmDealDto } from '../dto/crm.dto';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class ZohoService implements CrmProviderInterface {
  private readonly logger = new Logger(ZohoService.name);
  private readonly authUrl = 'https://accounts.zoho.com/oauth/v2/auth';
  private readonly tokenUrl = 'https://accounts.zoho.com/oauth/v2/token';

  constructor(
    private http: HttpService,
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  getAuthorizationUrl(userId: string): string {
    const clientId = this.config.get('ZOHO_CLIENT_ID');
    const redirectUri = this.config.get('ZOHO_REDIRECT_URI');
    const scope = 'ZohoCRM.modules.ALL,ZohoCRM.settings.ALL';

    return `${this.authUrl}?scope=${scope}&client_id=${clientId}&response_type=code&access_type=offline&redirect_uri=${encodeURIComponent(redirectUri)}&state=${userId}`;
  }

  async handleCallback(code: string, userId: string): Promise<any> {
    const clientId = this.config.get('ZOHO_CLIENT_ID');
    const clientSecret = this.config.get('ZOHO_CLIENT_SECRET');
    const redirectUri = this.config.get('ZOHO_REDIRECT_URI');

    const response = await firstValueFrom(
      this.http.post(this.tokenUrl, null, {
        params: {
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code,
        },
      }),
    );

    const { access_token, refresh_token, expires_in, api_domain } = response.data;

    // Get org info
    const orgResponse = await firstValueFrom(
      this.http.get(`${api_domain}/crm/v5/org`, {
        headers: { Authorization: `Zoho-oauthtoken ${access_token}` },
      }),
    ).catch(() => ({ data: { org: [{}] } }));

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: new Date(Date.now() + expires_in * 1000),
      metadata: {
        apiDomain: api_domain,
        accountDomain: orgResponse.data.org?.[0]?.domain,
        organizationId: orgResponse.data.org?.[0]?.id,
      },
    };
  }

  async refreshToken(userId: string): Promise<any> {
    const integration = await this.prisma.crmIntegration.findUnique({
      where: { userId_provider: { userId, provider: 'zoho' } },
    });

    if (!integration?.refreshToken) {
      throw new UnauthorizedException('No refresh token available');
    }

    const clientId = this.config.get('ZOHO_CLIENT_ID');
    const clientSecret = this.config.get('ZOHO_CLIENT_SECRET');

    const response = await firstValueFrom(
      this.http.post(this.tokenUrl, null, {
        params: {
          grant_type: 'refresh_token',
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: integration.refreshToken,
        },
      }),
    );

    const { access_token, expires_in, api_domain } = response.data;

    await this.prisma.crmIntegration.update({
      where: { userId_provider: { userId, provider: 'zoho' } },
      data: {
        accessToken: access_token,
        expiresAt: new Date(Date.now() + expires_in * 1000),
        metadata: {
          ...((integration.metadata as any) || {}),
          apiDomain: api_domain || (integration.metadata as any)?.apiDomain,
        },
      },
    });

    return { accessToken: access_token };
  }

  private async getCredentials(userId: string): Promise<{ token: string; apiDomain: string }> {
    const integration = await this.prisma.crmIntegration.findUnique({
      where: { userId_provider: { userId, provider: 'zoho' } },
    });

    if (!integration?.accessToken) {
      throw new UnauthorizedException('Zoho CRM not connected');
    }

    const metadata = integration.metadata as any;
    return {
      token: integration.accessToken,
      apiDomain: metadata?.apiDomain || 'https://www.zohoapis.com',
    };
  }

  async getContacts(userId: string, limit = 100, offset = 0): Promise<CrmContactDto[]> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.get(`${apiDomain}/crm/v5/Contacts`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
        params: {
          per_page: limit,
          page: Math.floor(offset / limit) + 1,
          fields: 'Email,First_Name,Last_Name,Account_Name,Phone',
        },
      }),
    );

    return (response.data.data || []).map((contact: any) => ({
      id: contact.id,
      email: contact.Email,
      firstName: contact.First_Name,
      lastName: contact.Last_Name,
      company: contact.Account_Name?.name,
      phone: contact.Phone,
    }));
  }

  async getContact(userId: string, contactId: string): Promise<CrmContactDto> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.get(`${apiDomain}/crm/v5/Contacts/${contactId}`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      }),
    );

    const contact = response.data.data[0];
    return {
      id: contact.id,
      email: contact.Email,
      firstName: contact.First_Name,
      lastName: contact.Last_Name,
      company: contact.Account_Name?.name,
      phone: contact.Phone,
    };
  }

  async createContact(userId: string, contact: Partial<CrmContactDto>): Promise<CrmContactDto> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.post(
        `${apiDomain}/crm/v5/Contacts`,
        {
          data: [
            {
              Email: contact.email,
              First_Name: contact.firstName,
              Last_Name: contact.lastName || 'Unknown',
              Phone: contact.phone,
            },
          ],
        },
        {
          headers: { Authorization: `Zoho-oauthtoken ${token}` },
        },
      ),
    );

    const createdContact = response.data.data[0].details;
    return {
      id: createdContact.id,
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
    const { token, apiDomain } = await this.getCredentials(userId);

    const updateData: any = { id: contactId };
    if (contact.email) updateData.Email = contact.email;
    if (contact.firstName) updateData.First_Name = contact.firstName;
    if (contact.lastName) updateData.Last_Name = contact.lastName;
    if (contact.phone) updateData.Phone = contact.phone;

    await firstValueFrom(
      this.http.put(
        `${apiDomain}/crm/v5/Contacts`,
        {
          data: [updateData],
        },
        {
          headers: { Authorization: `Zoho-oauthtoken ${token}` },
        },
      ),
    );

    return this.getContact(userId, contactId);
  }

  async getDeals(userId: string, limit = 100, offset = 0): Promise<CrmDealDto[]> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.get(`${apiDomain}/crm/v5/Deals`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
        params: {
          per_page: limit,
          page: Math.floor(offset / limit) + 1,
          fields: 'Deal_Name,Stage,Amount,Contact_Name',
        },
      }),
    );

    return (response.data.data || []).map((deal: any) => ({
      id: deal.id,
      name: deal.Deal_Name,
      stage: deal.Stage,
      amount: deal.Amount || 0,
      contactId: deal.Contact_Name?.id,
    }));
  }

  async getDeal(userId: string, dealId: string): Promise<CrmDealDto> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.get(`${apiDomain}/crm/v5/Deals/${dealId}`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
      }),
    );

    const deal = response.data.data[0];
    return {
      id: deal.id,
      name: deal.Deal_Name,
      stage: deal.Stage,
      amount: deal.Amount || 0,
      contactId: deal.Contact_Name?.id,
    };
  }

  async createDeal(userId: string, deal: Partial<CrmDealDto>): Promise<CrmDealDto> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.post(
        `${apiDomain}/crm/v5/Deals`,
        {
          data: [
            {
              Deal_Name: deal.name,
              Amount: deal.amount,
              Stage: deal.stage || 'Qualification',
              Contact_Name: deal.contactId ? { id: deal.contactId } : undefined,
              ...deal.customFields,
            },
          ],
        },
        {
          headers: { Authorization: `Zoho-oauthtoken ${token}` },
        },
      ),
    );

    const createdDeal = response.data.data[0].details;
    return {
      id: createdDeal.id,
      name: deal.name!,
      stage: deal.stage,
      amount: deal.amount,
    };
  }

  async updateDeal(userId: string, dealId: string, deal: Partial<CrmDealDto>): Promise<CrmDealDto> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const updateData: any = { id: dealId };
    if (deal.name) updateData.Deal_Name = deal.name;
    if (deal.amount !== undefined) updateData.Amount = deal.amount;
    if (deal.stage) updateData.Stage = deal.stage;

    await firstValueFrom(
      this.http.put(
        `${apiDomain}/crm/v5/Deals`,
        {
          data: [updateData],
        },
        {
          headers: { Authorization: `Zoho-oauthtoken ${token}` },
        },
      ),
    );

    return this.getDeal(userId, dealId);
  }

  async getStages(userId: string): Promise<Array<{ id: string; name: string }>> {
    const { token, apiDomain } = await this.getCredentials(userId);

    const response = await firstValueFrom(
      this.http.get(`${apiDomain}/crm/v5/settings/pipeline`, {
        headers: { Authorization: `Zoho-oauthtoken ${token}` },
        params: { module: 'Deals' },
      }),
    );

    const stages: Array<{ id: string; name: string }> = [];
    for (const pipeline of response.data.pipeline || []) {
      for (const stage of pipeline.maps || []) {
        stages.push({
          id: stage.id || stage.display_value,
          name: `${pipeline.display_value} - ${stage.display_value}`,
        });
      }
    }

    return stages;
  }

  async disconnect(userId: string): Promise<void> {
    const { token } = await this.getCredentials(userId);

    // Revoke Zoho token
    await firstValueFrom(
      this.http.post('https://accounts.zoho.com/oauth/v2/token/revoke', null, {
        params: { token },
      }),
    ).catch((err) => {
      this.logger.warn('Failed to revoke Zoho token', err.message);
    });
  }
}
