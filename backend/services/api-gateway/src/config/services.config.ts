import { registerAs } from "@nestjs/config";

export default registerAs("services", () => ({
  auth: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
  event: process.env.EVENT_SERVICE_URL || "http://localhost:3002",
  seat: process.env.SEAT_SERVICE_URL || "http://localhost:3003",
  reservation: process.env.RESERVATION_SERVICE_URL || "http://localhost:3004",
  payment: process.env.PAYMENT_SERVICE_URL || "http://localhost:3005",
  ticket: process.env.TICKET_SERVICE_URL || "http://localhost:3006",
  notification: process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3007",
}));

