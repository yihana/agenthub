// Type declarations for SAP modules
declare module '@sap/xsenv' {
  export function readServices(): any;
  export function loadCertificates(): any;
}

declare module '@sap/xssec' {
  export interface SecurityContext {
    checkScope(scope: string): boolean;
    getToken(): string;
    getTokenValue(): string;
    getHdbToken(): string;
    getLogonName(): string;
    getGivenName(): string;
    getFamilyName(): string;
    getEmail(): string;
    getIdentityZone(): string;
    getOrigin(): string;
    getClientId(): string;
    getExpirationDate(): Date;
    getGrantType(): string;
    [key: string]: any;
  }

  export function createSecurityContext(
    token: string,
    config: any,
    callback: (error: any, securityContext: SecurityContext, tokenInfo: any) => void
  ): void;
}

