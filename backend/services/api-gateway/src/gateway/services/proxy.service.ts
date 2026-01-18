import { Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { AxiosRequestConfig, AxiosResponse } from "axios";

@Injectable()
export class ProxyService {
  private readonly logger = new Logger(ProxyService.name);
  private readonly services: Record<string, string>;

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

  async proxyRequest(
    serviceName: string,
    path: string,
    method: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<any> {
    const baseUrl = this.services[serviceName];

    if (!baseUrl) {
      throw new HttpException(
        `Service ${serviceName} not found`,
        HttpStatus.BAD_GATEWAY
      );
    }

    const url = `${baseUrl}${path}`;
    const config: AxiosRequestConfig = {
      method: method as any,
      url,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      ...(body && { data: body }),
      timeout: 30000,
    };

    try {
      this.logger.log(`Proxying ${method} ${url}`);
      const response: AxiosResponse = await firstValueFrom(
        this.httpService.request(config)
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Proxy error for ${serviceName}: ${error.message}`,
        error.stack
      );

      if (error.response) {
        throw new HttpException(
          error.response.data || error.message,
          error.response.status || HttpStatus.BAD_GATEWAY
        );
      }

      if (error.code === "ECONNREFUSED") {
        throw new HttpException(
          `Service ${serviceName} is unavailable`,
          HttpStatus.SERVICE_UNAVAILABLE
        );
      }

      throw new HttpException(
        `Proxy error: ${error.message}`,
        HttpStatus.BAD_GATEWAY
      );
    }
  }

  getServiceUrl(serviceName: string): string {
    return this.services[serviceName] || "";
  }
}

