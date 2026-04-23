declare module 'google-auth-library' {
  export class OAuth2Client {
    constructor(clientId?: string, clientSecret?: string, redirectUri?: string);
    generateAuthUrl(options: any): string;
    getToken(code: string): Promise<any>;
    setCredentials(credentials: any): void;
    refreshAccessToken(): Promise<any>;
  }
}