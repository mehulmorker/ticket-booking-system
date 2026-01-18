import { registerAs } from "@nestjs/config";

export default registerAs("services", () => ({
  reservationServiceUrl:
    process.env.RESERVATION_SERVICE_URL || "http://localhost:3004",
  seatServiceUrl:
    process.env.SEAT_SERVICE_URL || "http://localhost:3003",
  ticketServiceUrl:
    process.env.TICKET_SERVICE_URL || "http://localhost:3006",
}));

