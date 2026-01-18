import { apiClient } from "./api";
import type { Payment } from "@/types";

export interface InitiatePaymentRequest {
  reservationId: string;
  paymentMethod: string; // "CARD" | "PAYPAL" | "BANK_TRANSFER"
  amount: number; // Required: payment amount
  eventId: string; // Required: event ID
  idempotencyKey?: string;
}

export interface ConfirmPaymentRequest {
  paymentId: string;
  transactionId: string;
}

export const paymentService = {
  /**
   * Initiate a payment
   * Backend endpoint: POST /api/payments/initiate
   * Payload: { reservationId, paymentMethod, amount, eventId, idempotencyKey? }
   */
  async initiatePayment(data: InitiatePaymentRequest): Promise<Payment> {
    return apiClient.post<Payment>("/api/payments/initiate", {
      reservationId: data.reservationId,
      paymentMethod: data.paymentMethod,
      amount: data.amount,
      eventId: data.eventId,
      idempotencyKey: data.idempotencyKey,
    });
  },

  async confirmPayment(data: ConfirmPaymentRequest): Promise<Payment> {
    return apiClient.post<Payment>("/api/payments/confirm", data);
  },

  async processPayment(paymentId: string): Promise<Payment> {
    return apiClient.post<Payment>(`/api/payments/process/${paymentId}`);
  },

  async getPayment(id: string): Promise<Payment> {
    return apiClient.get<Payment>(`/api/payments/${id}`);
  },

  async refundPayment(paymentId: string): Promise<Payment> {
    return apiClient.post<Payment>("/api/payments/refund", { paymentId });
  },
};
