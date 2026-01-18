import {
  TestClient,
  createTestUser,
  createTestVenue,
  createTestEvent,
} from "../utils/test-helpers";

describe("Event Service Integration Tests", () => {
  let client: TestClient;
  let adminUser: Awaited<ReturnType<typeof createTestUser>>;
  let venue: Awaited<ReturnType<typeof createTestVenue>>;

  beforeAll(async () => {
    client = new TestClient();
    adminUser = await createTestUser(client);
    client.setAuthToken(adminUser.token);
    venue = await createTestVenue(client, adminUser.token);
  });

  describe("Event CRUD Operations", () => {
    it("should create a new event", async () => {
      const event = await createTestEvent(client, venue.id!, adminUser.token);

      expect(event).toHaveProperty("id");
      expect(event.name).toBe("Test Event");
      expect(event.venueId).toBe(venue.id);
    });

    it("should get all events", async () => {
      const events = await client.getEvents();

      expect(Array.isArray(events.data || events)).toBe(true);
    });

    it("should get event by ID", async () => {
      const event = await createTestEvent(client, venue.id!, adminUser.token);
      const fetchedEvent = await client.getEventById(event.id!);

      expect(fetchedEvent.id).toBe(event.id);
      expect(fetchedEvent.name).toBe(event.name);
    });
  });

  describe("Venue Management", () => {
    it("should create a new venue", async () => {
      const newVenue = await client.createVenue(
        {
          name: "New Test Venue",
          address: "456 New St",
          city: "New City",
          state: "NC",
          zipCode: "54321",
          capacity: 200,
        },
        adminUser.token
      );

      expect(newVenue).toHaveProperty("id");
      expect(newVenue.name).toBe("New Test Venue");
      expect(newVenue.capacity).toBe(200);
    });
  });
});

