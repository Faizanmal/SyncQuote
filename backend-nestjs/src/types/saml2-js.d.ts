declare module 'saml2-js' {
  export interface Saml2Options {
    entity_id: string;
    private_key: string;
    certificate: string;
    assert_endpoint: string;
    sign_get_request?: boolean;
    allow_unencrypted_assertion?: boolean;
  }

  export interface IdentityProviderOptions {
    sso_login_url: string;
    sso_logout_url?: string;
    certificates: string[];
    sign_get_request?: boolean;
    allow_unencrypted_assertion?: boolean;
  }

  export class ServiceProvider {
    constructor(options: Saml2Options);

    create_login_request_url(
      idp: IdentityProvider,
      options: { relay_state?: string },
      callback: (err: any, loginUrl: string) => void
    ): void;

    post_assert(
      idp: IdentityProvider,
      options: { request_body: { SAMLResponse: string } },
      callback: (err: any, samlAssert: any) => void
    ): void;
  }

  export class IdentityProvider {
    constructor(options: IdentityProviderOptions);
  }
}