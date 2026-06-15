export interface HealthStatus {
  service: string;
  status: string;
}

export class HealthService {
  constructor(private readonly serviceName: string) {}

  public check(): HealthStatus {
    return {
      service: this.serviceName,
      status: "ok",
    };
  }
}
