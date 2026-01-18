import { Controller, Get } from "@nestjs/common";

@Controller()
export class AppController {
  @Get()
  root() {
    return {
      service: "api-gateway",
      version: "1.0.0",
      status: "running",
      endpoints: {
        health: "/health",
        auth: "/api/auth, /api/auth/*",
        events: "/api/events, /api/events/*",
        venues: "/api/venues, /api/venues/*",
        seats: "/api/seats, /api/seats/*",
        reservations: "/api/reservations, /api/reservations/*",
        payments: "/api/payments, /api/payments/*",
        tickets: "/api/tickets, /api/tickets/*",
        notifications: "/api/notifications, /api/notifications/*",
      },
    };
  }
}

