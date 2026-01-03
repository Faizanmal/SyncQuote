import { Injectable, BadRequestException } from '@nestjs/common';
import * as saml2 from 'saml2-js';
import { SsoService } from './sso.service';

@Injectable()
export class SamlService {
  constructor(private ssoService: SsoService) {}

  /**
   * Create SAML login URL
   */
  async createLoginUrl(configId: string, relayState?: string): Promise<string> {
    const config = await this.ssoService.getSsoConfigWithSecrets(configId);

    if (!config.entryPoint || !config.issuer) {
      throw new BadRequestException('Invalid SAML configuration');
    }

    const spOptions = {
      entity_id: config.issuer,
      private_key: config.privateKey || undefined,
      certificate: config.certificate || undefined,
      assert_endpoint: `${process.env.APP_URL}/api/sso/saml/callback`,
    };

    const idpOptions = {
      sso_login_url: config.entryPoint,
      sso_logout_url: config.entryPoint, // Often the same
      certificates: config.certificate ? [config.certificate] : [],
    };

    const sp = new saml2.ServiceProvider(spOptions);
    const idp = new saml2.IdentityProvider(idpOptions);

    return new Promise((resolve, reject) => {
      sp.create_login_request_url(idp, { relay_state: relayState }, (err, loginUrl) => {
        if (err) {
          reject(new BadRequestException('Failed to create SAML login URL'));
        } else {
          resolve(loginUrl);
        }
      });
    });
  }

  /**
   * Process SAML callback
   */
  async processCallback(configId: string, samlResponse: string): Promise<any> {
    const config = await this.ssoService.getSsoConfigWithSecrets(configId);

    if (!config.certificate || !config.issuer) {
      throw new BadRequestException('Invalid SAML configuration');
    }

    const spOptions = {
      entity_id: config.issuer,
      private_key: config.privateKey || undefined,
      certificate: config.certificate || undefined,
      assert_endpoint: `${process.env.APP_URL}/api/sso/saml/callback`,
    };

    const idpOptions = {
      sso_login_url: config.entryPoint!,
      sso_logout_url: config.entryPoint!,
      certificates: [config.certificate],
    };

    const sp = new saml2.ServiceProvider(spOptions);
    const idp = new saml2.IdentityProvider(idpOptions);

    return new Promise((resolve, reject) => {
      sp.post_assert(idp, { request_body: { SAMLResponse: samlResponse } }, (err, samlAssert) => {
        if (err) {
          reject(new BadRequestException('SAML assertion failed'));
        } else {
          // Extract user info from SAML assertion
          const userInfo = {
            nameId: samlAssert.user.name_id,
            email: samlAssert.user.email || samlAssert.user.name_id,
            firstName: samlAssert.user.given_name,
            lastName: samlAssert.user.surname,
            attributes: samlAssert.user.attributes,
          };
          resolve(userInfo);
        }
      });
    });
  }

  /**
   * Get SAML metadata
   */
  async getMetadata(configId: string): Promise<string> {
    const config = await this.ssoService.getSsoConfigWithSecrets(configId);

    const spOptions = {
      entity_id: config.issuer || `${process.env.APP_URL}/saml`,
      private_key: config.privateKey || undefined,
      certificate: config.certificate || undefined,
      assert_endpoint: `${process.env.APP_URL}/api/sso/saml/callback`,
    };

    const sp = new saml2.ServiceProvider(spOptions);
    return sp.create_metadata();
  }
}
