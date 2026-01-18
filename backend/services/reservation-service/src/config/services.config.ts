import { registerAs } from "@nestjs/config";

export default registerAs("services", () => ({
  seatServiceUrl:
    process.env.SEAT_SERVICE_URL || "http://localhost:3003",
}));

