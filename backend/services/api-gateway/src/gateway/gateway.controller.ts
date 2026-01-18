import {
  Controller,
  All,
  Req,
  Res,
  Body,
  Get,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { ProxyService } from "./services/proxy.service";
import { HealthService } from "./services/health.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Public } from "../auth/decorators/public.decorator";

@Controller()
export class GatewayController {
  private readonly logger = new Logger(GatewayController.name);

  constructor(
    private readonly proxyService: ProxyService,
    private readonly healthService: HealthService
  ) {}

  @Get("health")
  @Public()
  async health(@Res() res: Response) {
    try {
      const healthStatus = await this.healthService.checkAllServices();
      return res.status(200).json({
        status: "ok",
        service: "api-gateway",
        timestamp: new Date().toISOString(),
        services: healthStatus,
      });
    } catch (error) {
      this.logger.error(`Health check error: ${error.message}`, error.stack);
      return res.status(200).json({
        status: "ok",
        service: "api-gateway",
        timestamp: new Date().toISOString(),
        note: "Service health checks unavailable",
      });
    }
  }

  // Auth Service routes (no /api prefix in service)
  @All("api/auth*")
  @Public()
  async proxyAuth(@Req() req: Request, @Res() res: Response, @Body() body?: any) {
    return this.proxyRequest(req, res, "auth", body);
  }

  // Event Service routes (no /api prefix in service)
  @All("api/venues*")
  async proxyVenues(@Req() req: Request, @Res() res: Response, @Body() body?: any) {
    return this.proxyRequest(req, res, "event", body);
  }

  @All("api/events*")
  async proxyEvents(@Req() req: Request, @Res() res: Response, @Body() body?: any) {
    return this.proxyRequest(req, res, "event", body);
  }

  // Seat Service routes (has /api prefix in service)
  @All("api/seats*")
  async proxySeats(@Req() req: Request, @Res() res: Response, @Body() body?: any) {
    return this.proxyRequest(req, res, "seat", body);
  }

  // Reservation Service routes (has /api prefix in service)
  @All("api/reservations*")
  @UseGuards(JwtAuthGuard)
  async proxyReservations(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body?: any
  ) {
    return this.proxyRequest(req, res, "reservation", body);
  }

  // Payment Service routes (has /api prefix in service)
  @All("api/payments*")
  @UseGuards(JwtAuthGuard)
  async proxyPayments(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body?: any
  ) {
    return this.proxyRequest(req, res, "payment", body);
  }

  // Ticket Service routes (has /api prefix in service)
  @All("api/tickets*")
  @UseGuards(JwtAuthGuard)
  async proxyTickets(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body?: any
  ) {
    return this.proxyRequest(req, res, "ticket", body);
  }

  // Notification Service routes (has /api prefix in service)
  @All("api/notifications*")
  @UseGuards(JwtAuthGuard)
  async proxyNotifications(
    @Req() req: Request,
    @Res() res: Response,
    @Body() body?: any
  ) {
    return this.proxyRequest(req, res, "notification", body);
  }

  private async proxyRequest(
    req: Request,
    res: Response,
    serviceName: string,
    body?: any
  ) {
    try {
      // Strip only /api from the path, preserving the service controller path
      // e.g., /api/auth/register -> /auth/register
      // e.g., /api/seats/event/123 -> /api/seats/event/123 (for services with /api prefix)
      let path = req.url;
      
      if (path.startsWith("/api/")) {
        path = path.replace("/api", "") || "/";
      }
      
      // For services with global /api prefix, we need to add it back
      // Services with /api prefix: seat, reservation, payment, ticket, notification
      const servicesWithApiPrefix = ["seat", "reservation", "payment", "ticket", "notification"];
      if (servicesWithApiPrefix.includes(serviceName)) {
        path = `/api${path}`;
      }

      const method = req.method;
      const headers: Record<string, string> = {};

      if (req.headers.authorization) {
        headers.Authorization = req.headers.authorization;
      }

      if (req.headers["content-type"]) {
        headers["Content-Type"] = req.headers["content-type"] as string;
      }

      const response = await this.proxyService.proxyRequest(
        serviceName,
        path,
        method,
        body || req.body,
        headers
      );

      return res.status(200).json(response);
    } catch (error: any) {
      this.logger.error(
        `Proxy error for ${serviceName}: ${error.message}`,
        error.stack
      );

      const status = error.status || 500;
      const message = error.message || "Internal server error";

      return res.status(status).json({
        statusCode: status,
        message,
        path: req.url,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private getServicePrefix(serviceName: string): string {
    const prefixes: Record<string, string> = {
      auth: "auth",
      event: "events",
      seat: "seats",
      reservation: "reservations",
      payment: "payments",
      ticket: "tickets",
      notification: "notifications",
    };
    return prefixes[serviceName] || serviceName;
  }
}

