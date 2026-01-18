import { apiClient } from "./api";
import type { Seat } from "@/types";

export interface LockSeatsRequest {
  eventId: string;
  ownerId: string; // userId for user locks
  seats: string[]; // Backend expects "seats", not "seatIds"
  ttlSeconds?: number; // Optional TTL in seconds (default 300 = 5 minutes)
}

export interface LockSeatsResponse {
  success: boolean;
  lockedSeatIds: string[];
  ownerId: string;
  eventId: string;
  expiresAt: string;
  alreadyLocked?: boolean; // Indicates if seats were already locked by this user
}

export interface ReleaseSeatsRequest {
  eventId: string;
  ownerId: string; // userId who owns the lock
  seats: string[]; // Backend expects "seats", not "seatIds"
}

export interface ExtendLockRequest {
  eventId: string;
  ownerId: string; // userId who owns the lock
  seats: string[]; // Backend expects "seats", not "seatIds"
  ttlSeconds?: number; // Optional TTL in seconds (default 300 = 5 minutes)
}

export const seatService = {
  /**
   * Get available seats for an event
   * Backend endpoint: GET /api/seats/availability/:eventId
   */
  async getSeatsByEvent(eventId: string): Promise<Seat[]> {
    return apiClient.get<Seat[]>(`/api/seats/availability/${eventId}`);
  },

  /**
   * Get all seats for an event (including locked, reserved, sold)
   * Backend endpoint: GET /api/seats/event/:eventId
   */
  async getAllSeatsByEvent(eventId: string): Promise<Seat[]> {
    return apiClient.get<Seat[]>(`/api/seats/event/${eventId}`);
  },

  /**
   * Lock seats for a user
   * Backend endpoint: POST /api/seats/lock
   * Payload: { eventId, ownerId, seats }
   * Note: Backend hardcodes 5-minute lock duration, ttlSeconds is ignored
   */
  async lockSeats(data: LockSeatsRequest): Promise<LockSeatsResponse> {
    return apiClient.post<LockSeatsResponse>("/api/seats/lock", {
      eventId: data.eventId,
      ownerId: data.ownerId,
      seats: data.seats,
      // Note: Backend doesn't accept ttlSeconds - it hardcodes 5 minutes
    });
  },

  /**
   * Release locked seats
   * Backend endpoint: POST /api/seats/release
   * Payload: { eventId, ownerId, seats }
   */
  async releaseSeats(data: ReleaseSeatsRequest): Promise<void> {
    return apiClient.post<void>("/api/seats/release", {
      eventId: data.eventId,
      ownerId: data.ownerId,
      seats: data.seats,
    });
  },

  /**
   * Extend lock duration for seats
   * Backend endpoint: PUT /api/seats/extend-lock
   * Payload: { eventId, ownerId, seats, ttlSeconds? }
   */
  async extendLock(data: ExtendLockRequest): Promise<LockSeatsResponse> {
    return apiClient.put<LockSeatsResponse>("/api/seats/extend-lock", {
      eventId: data.eventId,
      ownerId: data.ownerId,
      seats: data.seats,
      ttlSeconds: data.ttlSeconds || 300, // Default 5 minutes (backend may use this)
    });
  },

  /**
   * Get all seats locked by a user
   * Backend endpoint: GET /api/seats/my-locks/:userId/event/:eventId
   * Returns all seats currently locked by the user for a specific event
   */
  async getMyLocks(userId: string, eventId?: string): Promise<Seat[]> {
    if (eventId) {
      return apiClient.get<Seat[]>(
        `/api/seats/my-locks/${userId}/event/${eventId}`
      );
    }
    return apiClient.get<Seat[]>(`/api/seats/my-locks/${userId}`);
  },
};
