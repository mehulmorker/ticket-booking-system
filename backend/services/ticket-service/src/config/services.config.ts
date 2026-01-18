import { registerAs } from "@nestjs/config";

export default registerAs("services", () => ({
  eventServiceUrl: process.env.EVENT_SERVICE_URL || "http://localhost:3002",
  seatServiceUrl: process.env.SEAT_SERVICE_URL || "http://localhost:3003",
  reservationServiceUrl:
    process.env.RESERVATION_SERVICE_URL || "http://localhost:3004",
  authServiceUrl: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
  apiGatewayUrl: process.env.API_GATEWAY_URL || "http://localhost:3000",
}));
