import axios, { AxiosInstance } from "axios";

const API_GATEWAY_URL = process.env.API_GATEWAY_URL || "http://localhost:3000";
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || "http://localhost:3001";
const EVENT_SERVICE_URL = process.env.EVENT_SERVICE_URL || "http://localhost:3002";
const SEAT_SERVICE_URL = process.env.SEAT_SERVICE_URL || "http://localhost:3003";
const RESERVATION_SERVICE_URL =
  process.env.RESERVATION_SERVICE_URL || "http://localhost:3004";
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || "http://localhost:3005";

export interface TestUser {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  token?: string;
  id?: string;
}

export interface TestEvent {
  id?: string;
  name: string;
  description: string;
  category: string;
  venueId: string;
  startDate: string;
  endDate: string;
}

export interface TestVenue {
  id?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  capacity: number;
}

export class TestClient {
  private authClient: AxiosInstance;
  private eventClient: AxiosInstance;
  private seatClient: AxiosInstance;
  private reservationClient: AxiosInstance;
  private paymentClient: AxiosInstance;
  private gatewayClient: AxiosInstance;

  constructor() {
    this.authClient = axios.create({ baseURL: AUTH_SERVICE_URL });
    this.eventClient = axios.create({ baseURL: EVENT_SERVICE_URL });
    this.seatClient = axios.create({ baseURL: SEAT_SERVICE_URL });
    this.reservationClient = axios.create({ baseURL: RESERVATION_SERVICE_URL });
    this.paymentClient = axios.create({ baseURL: PAYMENT_SERVICE_URL });
    this.gatewayClient = axios.create({ baseURL: API_GATEWAY_URL });
  }

  setAuthToken(token: string) {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    this.eventClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    this.seatClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    this.reservationClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    this.paymentClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    this.gatewayClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  }

  clearAuthToken() {
    delete this.eventClient.defaults.headers.common["Authorization"];
    delete this.seatClient.defaults.headers.common["Authorization"];
    delete this.reservationClient.defaults.headers.common["Authorization"];
    delete this.paymentClient.defaults.headers.common["Authorization"];
    delete this.gatewayClient.defaults.headers.common["Authorization"];
  }

  // Auth Service Methods
  async register(user: TestUser) {
    const response = await this.authClient.post("/auth/register", {
      email: user.email,
      password: user.password,
      firstName: user.firstName,
      lastName: user.lastName,
    });
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.authClient.post("/auth/login", { email, password });
    return response.data;
  }

  async getProfile() {
    const response = await this.authClient.get("/auth/profile");
    return response.data;
  }

  // Event Service Methods
  async createEvent(event: Partial<TestEvent>, token?: string) {
    if (token) this.setAuthToken(token);
    const response = await this.eventClient.post("/events", event);
    return response.data;
  }

  async getEvents() {
    const response = await this.eventClient.get("/events");
    return response.data;
  }

  async getEventById(id: string) {
    const response = await this.eventClient.get(`/events/${id}`);
    return response.data;
  }

  async createVenue(venue: Partial<TestVenue>, token?: string) {
    if (token) this.setAuthToken(token);
    const response = await this.eventClient.post("/events/venues", venue);
    return response.data;
  }

  // Seat Service Methods
  async getSeatsByEvent(eventId: string) {
    const response = await this.seatClient.get(`/seats/event/${eventId}`);
    return response.data;
  }

  async lockSeats(eventId: string, seatIds: string[]) {
    const response = await this.seatClient.post("/seats/lock", {
      eventId,
      seatIds,
    });
    return response.data;
  }

  async releaseSeats(seatIds: string[]) {
    const response = await this.seatClient.post("/seats/release", { seatIds });
    return response.data;
  }

  // Reservation Service Methods
  async createReservation(eventId: string, seatIds: string[], idempotencyKey?: string) {
    const response = await this.reservationClient.post("/reservations", {
      eventId,
      seatIds,
      idempotencyKey,
    });
    return response.data;
  }

  async getReservation(id: string) {
    const response = await this.reservationClient.get(`/reservations/${id}`);
    return response.data;
  }

  // Payment Service Methods
  async initiatePayment(reservationId: string, idempotencyKey?: string) {
    const response = await this.paymentClient.post("/payments/initiate", {
      reservationId,
      paymentMethod: "CARD",
      idempotencyKey,
    });
    return response.data;
  }

  async processPayment(paymentId: string) {
    const response = await this.paymentClient.post(`/payments/process/${paymentId}`);
    return response.data;
  }

  async getPayment(id: string) {
    const response = await this.paymentClient.get(`/payments/${id}`);
    return response.data;
  }

  // Gateway Methods
  async gatewayHealth() {
    const response = await this.gatewayClient.get("/health");
    return response.data;
  }

  async gatewayGetEvents() {
    const response = await this.gatewayClient.get("/api/events");
    return response.data;
  }
}

export async function createTestUser(client: TestClient): Promise<TestUser & { token: string }> {
  const user: TestUser = {
    email: `test-${Date.now()}@example.com`,
    password: "Test123!",
    firstName: "Test",
    lastName: "User",
  };

  const registerResponse = await client.register(user);
  return {
    ...user,
    token: registerResponse.accessToken,
    id: registerResponse.user.id,
  };
}

export async function createTestVenue(
  client: TestClient,
  token: string
): Promise<TestVenue> {
  const venue = await client.createVenue(
    {
      name: "Test Venue",
      address: "123 Test St",
      city: "Test City",
      state: "TS",
      zipCode: "12345",
      capacity: 100,
    },
    token
  );
  return venue;
}

export async function createTestEvent(
  client: TestClient,
  venueId: string,
  token: string
): Promise<TestEvent> {
  const event = await client.createEvent(
    {
      name: "Test Event",
      description: "Test Event Description",
      category: "CONCERT",
      venueId,
      startDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      endDate: new Date(Date.now() + 86400000 + 7200000).toISOString(), // Tomorrow + 2 hours
    },
    token
  );
  return event;
}

