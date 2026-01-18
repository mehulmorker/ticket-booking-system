import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AxiosRequestConfig } from "axios";

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly services: Record<string, string>;
  // Services that use /api prefix for their endpoints
  private readonly servicesWithApiPrefix = [
    "seat",
    "reservation",
    "payment",
    "ticket",
    "notification",
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService
  ) {
    const servicesConfig = this.configService.get("services");
    this.services = {
      auth: servicesConfig.auth,
      event: servicesConfig.event,
      seat: servicesConfig.seat,
      reservation: servicesConfig.reservation,
      payment: servicesConfig.payment,
      ticket: servicesConfig.ticket,
      notification: servicesConfig.notification,
    };
  }

  async checkAllServices(): Promise<Record<string, any>> {
    const healthChecks: Record<string, any> = {};
    const serviceNames = Object.keys(this.services);

    await Promise.allSettled(
      serviceNames.map(async (serviceName) => {
        try {
          // Use /api/health for services with api prefix, /health for others
          const healthPath = this.servicesWithApiPrefix.includes(serviceName)
            ? "/api/health"
            : "/health";
          const url = `${this.services[serviceName]}${healthPath}`;
          const config: AxiosRequestConfig = {
            method: "GET",
            url,
            timeout: 5000,
          };

          const response = await firstValueFrom(
            this.httpService.request(config)
          );
          healthChecks[serviceName] = {
            status: "healthy",
            data: response.data,
          };
        } catch (error: any) {
          healthChecks[serviceName] = {
            status: "unhealthy",
            error: error.message || "Service unavailable",
          };
          this.logger.warn(`Health check failed for ${serviceName}: ${error.message}`);
        }
      })
    );

    const allHealthy = Object.values(healthChecks).every(
      (check) => check.status === "healthy"
    );

    return {
      status: allHealthy ? "healthy" : "degraded",
      services: healthChecks,
      timestamp: new Date().toISOString(),
    };
  }
}

