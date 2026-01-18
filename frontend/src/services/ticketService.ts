import { apiClient } from "./api";
import type { Ticket } from "@/types";

export const ticketService = {
  /**
   * Get ticket by reservation ID
   * Backend endpoint: GET /api/tickets/reservation/:reservationId
   * Returns: Ticket[] (array), we take the first one
   */
  async getTicketByReservation(reservationId: string): Promise<Ticket> {
    const tickets = await apiClient.get<Ticket[]>(
      `/api/tickets/reservation/${reservationId}`
    );
    // Backend returns array, take the first ticket
    if (!tickets || tickets.length === 0) {
      throw new Error("No ticket found for this reservation");
    }
    return tickets[0];
  },

  /**
   * Get ticket by ID
   * Backend endpoint: GET /api/tickets/:id
   */
  async getTicket(id: string): Promise<Ticket> {
    return apiClient.get<Ticket>(`/api/tickets/${id}`);
  },

  /**
   * Download ticket PDF
   * Backend endpoint: GET /api/tickets/:id/download
   * Returns download URL (S3 presigned URL)
   * Backend returns: { downloadUrl: string }
   */
  async getDownloadUrl(id: string): Promise<string> {
    const response = await apiClient.get<{ downloadUrl: string }>(
      `/api/tickets/${id}/download`
    );
    return response.downloadUrl;
  },

  /**
   * Verify ticket by QR code
   * Backend endpoint: GET /api/tickets/verify/:qrCode
   */
  async verifyTicket(qrCode: string): Promise<Ticket> {
    return apiClient.get<Ticket>(`/api/tickets/verify/${qrCode}`);
  },

  /**
   * Get user tickets
   * Backend endpoint: GET /api/tickets/user/:userId
   */
  async getUserTickets(userId: string): Promise<Ticket[]> {
    return apiClient.get<Ticket[]>(`/api/tickets/user/${userId}`);
  },
};
