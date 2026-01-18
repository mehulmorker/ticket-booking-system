import { TestClient, createTestUser } from "../utils/test-helpers";

describe("API Gateway Integration Tests", () => {
  let client: TestClient;

  beforeAll(() => {
    client = new TestClient();
  });

  describe("Health Check", () => {
    it("should return gateway health status", async () => {
      const health = await client.gatewayHealth();

      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("service");
      expect(health.service).toBe("api-gateway");
    });

    it("should aggregate health checks from all services", async () => {
      const health = await client.gatewayHealth();

      expect(health).toHaveProperty("services");
      if (health.services) {
        expect(health.services).toHaveProperty("auth");
        expect(health.services).toHaveProperty("event");
        expect(health.services).toHaveProperty("seat");
      }
    });
  });

  describe("Request Routing", () => {
    it("should route requests to Event Service through gateway", async () => {
      const events = await client.gatewayGetEvents();

      expect(events).toBeDefined();
    });

    it("should require authentication for protected routes", async () => {
      client.clearAuthToken();

      await expect(client.gatewayGetEvents()).rejects.toThrow();
    });

    it("should allow public access to auth endpoints", async () => {
      client.clearAuthToken();

      const user = {
        email: `gateway-test-${Date.now()}@example.com`,
        password: "Test123!",
        firstName: "Gateway",
        lastName: "Test",
      };

      const response = await client.register(user);
      expect(response).toHaveProperty("accessToken");
    });
  });

  describe("JWT Validation", () => {
    it("should validate JWT tokens for protected routes", async () => {
      const user = await createTestUser(client);
      client.setAuthToken(user.token);

      // Should work with valid token
      const events = await client.gatewayGetEvents();
      expect(events).toBeDefined();
    });

    it("should reject invalid tokens", async () => {
      client.setAuthToken("invalid-token");

      await expect(client.gatewayGetEvents()).rejects.toThrow();
    });
  });
});
