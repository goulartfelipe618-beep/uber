export interface SupabaseConfig {
  url: string;
  anonKey: string;
  projectRef: string;
  managementToken: string;
}

export interface SupabaseHealthReport {
  configured: boolean;
  publicApiReachable: boolean;
  managementApiReachable: boolean;
  projectRef: string;
  region: string | null;
  projectStatus: string | null;
  authProviders: {
    email: boolean;
    phone: boolean;
  } | null;
}

export class SupabaseService {
  constructor(private readonly config: SupabaseConfig) {}

  public isConfigured(): boolean {
    return Boolean(this.config.url && this.config.anonKey && this.config.projectRef);
  }

  public async checkHealth(): Promise<SupabaseHealthReport> {
    const baseReport: SupabaseHealthReport = {
      configured: this.isConfigured(),
      publicApiReachable: false,
      managementApiReachable: false,
      projectRef: this.config.projectRef || "not-configured",
      region: null,
      projectStatus: null,
      authProviders: null,
    };

    if (!baseReport.configured) {
      return baseReport;
    }

    const publicHeaders = {
      apikey: this.config.anonKey,
      Authorization: `Bearer ${this.config.anonKey}`,
    };

    const authResponse = await fetch(`${this.config.url}/auth/v1/settings`, {
      method: "GET",
      headers: publicHeaders,
    });

    if (authResponse.ok) {
      const authSettings = (await authResponse.json()) as {
        external?: { email?: boolean; phone?: boolean };
      };

      baseReport.publicApiReachable = true;
      baseReport.authProviders = {
        email: Boolean(authSettings.external?.email),
        phone: Boolean(authSettings.external?.phone),
      };
    }

    if (!this.config.managementToken) {
      return baseReport;
    }

    const managementResponse = await fetch(
      `https://api.supabase.com/v1/projects/${this.config.projectRef}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.managementToken}`,
        },
      },
    );

    if (managementResponse.ok) {
      const project = (await managementResponse.json()) as {
        region?: string;
        status?: string;
      };

      baseReport.managementApiReachable = true;
      baseReport.region = project.region ?? null;
      baseReport.projectStatus = project.status ?? null;
    }

    return baseReport;
  }
}
