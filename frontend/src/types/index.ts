export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "USER" | "ADMIN";
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface Event {
  id: string;
  title: string; // Backend uses 'title', not 'name'
  description?: string;
  category?: string;
  venueId?: string; // Backend has venue relation, not venueId directly
  venue?: Venue;
  eventDate: string; // Backend uses 'eventDate', not 'startDate'
  startTime?: string;
  endTime?: string;
  imageUrl?: string;
  status: "UPCOMING" | "ONGOING" | "COMPLETED" | "CANCELLED";
  totalSeats?: number;
  availableSeats?: number;
  createdAt: string;
  updatedAt: string;
  // Legacy fields for backward compatibility
  name?: string; // Alias for title
  startDate?: string; // Alias for eventDate
  endDate?: string; // Computed from eventDate + endTime
}

export interface Venue {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  capacity: number;
  createdAt: string;
  updatedAt: string;
}

export interface Seat {
  id: string;
  eventId: string;
  rowLabel: string; // Backend uses rowLabel, not row
  seatNumber: string; // Backend uses seatNumber, not number
  section?: string;
  seatType?: string; // Backend uses seatType, not category
  price: number;
  status: "AVAILABLE" | "LOCKED" | "RESERVED" | "SOLD";
  lockedBy?: string | null;
  reservationId?: string | null; // Which reservation owns this seat
  lockedAt?: string | null;
  lockExpiresAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Reservation {
  id: string;
  userId: string;
  eventId: string;
  seatIds: string[];
  totalAmount?: number; // Total amount for the reservation
  status: "PENDING" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
  expiresAt: string;
  confirmedAt?: string | null; // When reservation was confirmed
  cancelledAt?: string | null; // When reservation was cancelled
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  reservationId: string;
  amount: number;
  currency: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED";
  paymentMethod: string;
  transactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: string;
  reservationId: string;
  userId: string;
  eventId: string;
  seatIds?: string[]; // Array of seat IDs
  paymentId?: string; // Payment ID
  qrCode: string;
  pdfUrl?: string; // Optional, may be generated later
  s3Key?: string; // S3 key for PDF
  status?: "PENDING" | "GENERATED" | "VERIFIED" | "CANCELLED"; // Ticket status
  verifiedAt?: string | null;
  verifiedBy?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface BookingState {
  selectedSeats: Seat[];
  reservation: Reservation | null;
  payment: Payment | null;
  ticket: Ticket | null;
  isLoading: boolean;
  error: string | null;
}

export interface ApiError {
  message: string;
  statusCode: number;
  path?: string;
  timestamp?: string;
}

export interface EventListResponse {
  data: Event[];
  total: number;
  page: number;
  limit: number;
}

export interface LockSeatsResponse {
  success: boolean;
  lockedSeatIds: string[];
  ownerId: string;
  eventId: string;
  expiresAt: string;
  alreadyLocked?: boolean; // Indicates if seats were already locked by this user
}
