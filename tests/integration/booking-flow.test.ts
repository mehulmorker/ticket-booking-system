import {
  TestClient,
  createTestUser,
  createTestVenue,
  createTestEvent,
} from "../utils/test-helpers";

describe("End-to-End Booking Flow Integration Tests", () => {
  let client: TestClient;
  let user: Awaited<ReturnType<typeof createTestUser>>;
  let adminUser: Awaited<ReturnType<typeof createTestUser>>;
  let venue: Awaited<ReturnType<typeof createTestVenue>>;
  let event: Awaited<ReturnType<typeof createTestEvent>>;

  beforeAll(async () => {
    client = new TestClient();

    // Create admin user for event creation
    adminUser = await createTestUser(client);
    client.setAuthToken(adminUser.token);

    // Create venue and event
    venue = await createTestVenue(client, adminUser.token);
    event = await createTestEvent(client, venue.id!, adminUser.token);

    // Create regular user for booking
    user = await createTestUser(client);
    client.setAuthToken(user.token);
  });

  describe("Complete Booking Flow", () => {
    it("should complete full booking flow: Get Seats → Lock Seats → Create Reservation → Initiate Payment → Process Payment", async () => {
      // Step 1: Get available seats for event
      const seats = await client.getSeatsByEvent(event.id!);
      expect(Array.isArray(seats)).toBe(true);
      expect(seats.length).toBeGreaterThan(0);

      // Step 2: Lock seats
      const availableSeats = seats.filter((s: any) => s.status === "AVAILABLE");
      if (availableSeats.length === 0) {
        console.warn("No available seats for testing");
        return;
      }

      const seatIds = availableSeats.slice(0, 2).map((s: any) => s.id);
      const lockResponse = await client.lockSeats(event.id!, seatIds);

      expect(lockResponse).toHaveProperty("lockedSeats");
      expect(lockResponse.lockedSeats.length).toBe(seatIds.length);

      // Step 3: Create reservation
      const reservation = await client.createReservation(
        event.id!,
        seatIds,
        `test-${Date.now()}`
      );

      expect(reservation).toHaveProperty("id");
      expect(reservation.status).toBe("PENDING");
      expect(reservation.seatIds).toEqual(expect.arrayContaining(seatIds));

      // Step 4: Initiate payment
      const payment = await client.initiatePayment(
        reservation.id,
        `payment-${Date.now()}`
      );

      expect(payment).toHaveProperty("id");
      expect(payment.status).toBe("PENDING");
      expect(payment.reservationId).toBe(reservation.id);

      // Step 5: Process payment
      const processedPayment = await client.processPayment(payment.id);

      expect(processedPayment.status).toBe("COMPLETED");
    }, 60000); // 60 second timeout for full flow

    it("should handle idempotent reservation creation", async () => {
      const seats = await client.getSeatsByEvent(event.id!);
      const availableSeats = seats.filter((s: any) => s.status === "AVAILABLE");
      
      if (availableSeats.length === 0) {
        console.warn("No available seats for testing");
        return;
      }

      const seatIds = availableSeats.slice(0, 1).map((s: any) => s.id);
      const idempotencyKey = `idempotent-${Date.now()}`;

      // Create reservation twice with same idempotency key
      const reservation1 = await client.createReservation(
        event.id!,
        seatIds,
        idempotencyKey
      );

      const reservation2 = await client.createReservation(
        event.id!,
        seatIds,
        idempotencyKey
      );

      // Should return the same reservation
      expect(reservation1.id).toBe(reservation2.id);
    }, 30000);
  });

  describe("Seat Locking", () => {
    it("should lock and release seats", async () => {
      const seats = await client.getSeatsByEvent(event.id!);
      const availableSeats = seats.filter((s: any) => s.status === "AVAILABLE");
      
      if (availableSeats.length === 0) {
        console.warn("No available seats for testing");
        return;
      }

      const seatIds = availableSeats.slice(0, 1).map((s: any) => s.id);

      // Lock seats
      const lockResponse = await client.lockSeats(event.id!, seatIds);
      expect(lockResponse.lockedSeats.length).toBe(seatIds.length);

      // Release seats
      await client.releaseSeats(seatIds);

      // Verify seats are released (should be available again)
      const updatedSeats = await client.getSeatsByEvent(event.id!);
      const releasedSeat = updatedSeats.find((s: any) => s.id === seatIds[0]);
      expect(releasedSeat?.status).toBe("AVAILABLE");
    }, 30000);
  });
});

