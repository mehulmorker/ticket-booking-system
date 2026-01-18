import { TestClient, createTestUser } from "../utils/test-helpers";

describe("Auth Service Integration Tests", () => {
  let client: TestClient;

  beforeAll(() => {
    client = new TestClient();
  });

  describe("User Registration", () => {
    it("should register a new user successfully", async () => {
      const user = {
        email: `test-${Date.now()}@example.com`,
        password: "Test123!",
        firstName: "John",
        lastName: "Doe",
      };

      const response = await client.register(user);

      expect(response).toHaveProperty("accessToken");
      expect(response).toHaveProperty("user");
      expect(response.user.email).toBe(user.email);
      expect(response.user.firstName).toBe(user.firstName);
      expect(response.user.lastName).toBe(user.lastName);
      expect(response.user.role).toBe("USER");
    });

    it("should fail to register with duplicate email", async () => {
      const user = {
        email: `duplicate-${Date.now()}@example.com`,
        password: "Test123!",
        firstName: "John",
        lastName: "Doe",
      };

      await client.register(user);

      await expect(client.register(user)).rejects.toThrow();
    });
  });

  describe("User Login", () => {
    it("should login with valid credentials", async () => {
      const user = await createTestUser(client);

      const response = await client.login(user.email, user.password);

      expect(response).toHaveProperty("accessToken");
      expect(response).toHaveProperty("user");
      expect(response.user.email).toBe(user.email);
    });

    it("should fail to login with invalid credentials", async () => {
      await expect(
        client.login("invalid@example.com", "WrongPassword123!")
      ).rejects.toThrow();
    });
  });

  describe("Profile Management", () => {
    it("should get user profile with valid token", async () => {
      const user = await createTestUser(client);
      client.setAuthToken(user.token);

      const profile = await client.getProfile();

      expect(profile.email).toBe(user.email);
      expect(profile.firstName).toBe(user.firstName);
      expect(profile.lastName).toBe(user.lastName);
    });

    it("should fail to get profile without token", async () => {
      client.clearAuthToken();

      await expect(client.getProfile()).rejects.toThrow();
    });
  });
});
