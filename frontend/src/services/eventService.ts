import { apiClient } from "./api";
import type { Event, Venue } from "@/types";

export interface EventListParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  status?: string;
}

export interface EventListResponse {
  data: Event[];
  total: number;
  page: number;
  limit: number;
}

export const eventService = {
  async getEvents(params?: EventListParams): Promise<EventListResponse> {
    return apiClient.get<EventListResponse>("/api/events", { params });
  },

  async getEventById(id: string): Promise<Event> {
    return apiClient.get<Event>(`/api/events/${id}`);
  },

  async createEvent(data: Partial<Event>): Promise<Event> {
    return apiClient.post<Event>("/api/events", data);
  },

  async updateEvent(id: string, data: Partial<Event>): Promise<Event> {
    return apiClient.put<Event>(`/api/events/${id}`, data);
  },

  async deleteEvent(id: string): Promise<void> {
    return apiClient.delete<void>(`/api/events/${id}`);
  },

  async getVenues(): Promise<Venue[]> {
    return apiClient.get<Venue[]>("/api/events/venues");
  },

  async getVenueById(id: string): Promise<Venue> {
    return apiClient.get<Venue>(`/api/events/venues/${id}`);
  },
};

