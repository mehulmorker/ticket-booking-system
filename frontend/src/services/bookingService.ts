import { apiClient } from "./api";
import type { Reservation } from "@/types";

export interface CreateReservationRequest {
  eventId: string;
  seatIds: string[];
  totalAmount: number; // Required: total amount for the reservation
  idempotencyKey?: string;
}

export const bookingService = {
  /**
   * Create a reservation
   * Backend endpoint: POST /api/reservations
   * Payload: { eventId, seatIds, totalAmount, idempotencyKey? }
   */
  async createReservation(
    data: CreateReservationRequest
  ): Promise<Reservation> {
    return apiClient.post<Reservation>("/api/reservations", {
      eventId: data.eventId,
      seatIds: data.seatIds,
      totalAmount: data.totalAmount,
      idempotencyKey: data.idempotencyKey,
    });
  },

  async getReservation(id: string): Promise<Reservation> {
    return apiClient.get<Reservation>(`/api/reservations/${id}`);
  },

  async extendReservation(id: string, duration: number): Promise<Reservation> {
    return apiClient.post<Reservation>(`/api/reservations/${id}/extend`, {
      duration,
    });
  },

  async cancelReservation(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/reservations/${id}`);
  },

  /**
   * Get user reservations
   * Backend endpoint: GET /api/reservations/user/:userId
   * Note: Backend will use the authenticated user's ID from JWT token, ignoring the userId parameter
   * This ensures users can only see their own reservations
   */
  async getUserReservations(userId: string): Promise<Reservation[]> {
    // The userId parameter is kept for API compatibility but backend will use JWT token
    return apiClient.get<Reservation[]>(`/api/reservations/user/${userId}`);
  },
};
