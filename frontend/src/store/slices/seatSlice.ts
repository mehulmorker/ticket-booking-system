import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  seatService,
  LockSeatsRequest,
  ReleaseSeatsRequest,
  ExtendLockRequest,
} from "@/services/seatService";
import type { Seat } from "@/types";

interface SeatState {
  seats: Seat[];
  selectedSeats: Seat[];
  lockedSeats: Seat[];
  lockExpiresAt: string | null;
  lockOwnerId: string | null; // Track who owns the lock
  isLoading: boolean;
  error: string | null;
}

const initialState: SeatState = {
  seats: [],
  selectedSeats: [],
  lockedSeats: [],
  lockExpiresAt: null,
  lockOwnerId: null,
  isLoading: false,
  error: null,
};

export const fetchSeatsByEvent = createAsyncThunk(
  "seats/fetchSeatsByEvent",
  async (eventId: string, { rejectWithValue }) => {
    try {
      return await seatService.getSeatsByEvent(eventId);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch seats"
      );
    }
  }
);

export const fetchAllSeatsByEvent = createAsyncThunk(
  "seats/fetchAllSeatsByEvent",
  async (eventId: string, { rejectWithValue }) => {
    try {
      return await seatService.getAllSeatsByEvent(eventId);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch seats"
      );
    }
  }
);

export const lockSeats = createAsyncThunk(
  "seats/lockSeats",
  async (data: LockSeatsRequest, { rejectWithValue }) => {
    try {
      return await seatService.lockSeats(data);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to lock seats"
      );
    }
  }
);

export const releaseSeats = createAsyncThunk(
  "seats/releaseSeats",
  async (data: ReleaseSeatsRequest, { rejectWithValue }) => {
    try {
      await seatService.releaseSeats(data);
      return data.seats; // Return seat IDs that were released
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to release seats"
      );
    }
  }
);

export const extendLock = createAsyncThunk(
  "seats/extendLock",
  async (data: ExtendLockRequest, { rejectWithValue }) => {
    try {
      return await seatService.extendLock(data);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to extend lock"
      );
    }
  }
);

export const fetchMyLocks = createAsyncThunk(
  "seats/fetchMyLocks",
  async (
    { userId, eventId }: { userId: string; eventId?: string },
    { rejectWithValue }
  ) => {
    try {
      return await seatService.getMyLocks(userId, eventId);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch locks"
      );
    }
  }
);

const seatSlice = createSlice({
  name: "seats",
  initialState,
  reducers: {
    selectSeat: (state, action) => {
      const seat = action.payload;
      if (!state.selectedSeats.find((s) => s.id === seat.id)) {
        state.selectedSeats.push(seat);
      }
    },
    deselectSeat: (state, action) => {
      state.selectedSeats = state.selectedSeats.filter(
        (s) => s.id !== action.payload
      );
    },
    clearSelection: (state) => {
      state.selectedSeats = [];
    },
    clearLockState: (state) => {
      state.lockedSeats = [];
      state.lockExpiresAt = null;
      state.lockOwnerId = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSeatsByEvent.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSeatsByEvent.fulfilled, (state, action) => {
        state.isLoading = false;
        state.seats = action.payload;
      })
      .addCase(fetchSeatsByEvent.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchAllSeatsByEvent.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAllSeatsByEvent.fulfilled, (state, action) => {
        state.isLoading = false;
        state.seats = action.payload;
        // Clear lock state when fetching new seats for a different event
        // This prevents showing expired lock messages for new events
        if (state.lockedSeats.length === 0) {
          state.lockExpiresAt = null;
          state.lockOwnerId = null;
        }
      })
      .addCase(fetchAllSeatsByEvent.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(lockSeats.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(lockSeats.fulfilled, (state, action) => {
        state.isLoading = false;
        // Update locked seats from the seats array (filter by lockedSeatIds)
        const lockedSeatIds = action.payload.lockedSeatIds || [];
        const newlyLockedSeats = state.seats.filter((seat) =>
          lockedSeatIds.includes(seat.id)
        );
        // Merge with existing locked seats (avoid duplicates)
        const existingIds = state.lockedSeats.map((s) => s.id);
        const newSeats = newlyLockedSeats.filter(
          (s) => !existingIds.includes(s.id)
        );
        state.lockedSeats = [...state.lockedSeats, ...newSeats];
        state.lockExpiresAt = action.payload.expiresAt;
        state.lockOwnerId = action.payload.ownerId;
      })
      .addCase(lockSeats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(releaseSeats.fulfilled, (state, action) => {
        // Remove released seats from lockedSeats
        const releasedSeatIds = action.payload as string[];
        state.lockedSeats = state.lockedSeats.filter(
          (seat) => !releasedSeatIds.includes(seat.id)
        );
        // Clear lock info if all seats released
        if (state.lockedSeats.length === 0) {
          state.lockExpiresAt = null;
          state.lockOwnerId = null;
        }
        // Clear selection
        state.selectedSeats = [];
      })
      .addCase(extendLock.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(extendLock.fulfilled, (state, action) => {
        state.isLoading = false;
        state.lockExpiresAt = action.payload.expiresAt;
      })
      .addCase(extendLock.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchMyLocks.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchMyLocks.fulfilled, (state, action) => {
        state.isLoading = false;
        // Update locked seats from the fetched locks
        const fetchedLocks = action.payload;
        if (fetchedLocks.length > 0) {
          // Merge with existing locked seats, updating expiration times
          const fetchedIds = fetchedLocks.map((s) => s.id);
          const existingLocks = state.lockedSeats.filter(
            (s) => !fetchedIds.includes(s.id)
          );
          state.lockedSeats = [...existingLocks, ...fetchedLocks];
          // Use the earliest expiration time (most restrictive)
          const expirations = state.lockedSeats
            .map((s) => s.lockExpiresAt)
            .filter((exp) => exp !== null)
            .sort();
          state.lockExpiresAt = expirations[0] || null;
          state.lockOwnerId = fetchedLocks[0]?.lockedBy || state.lockOwnerId;
        } else if (state.lockedSeats.length === 0) {
          // Clear lock state if no locks found and no existing locks
          state.lockExpiresAt = null;
          state.lockOwnerId = null;
        }
      })
      .addCase(fetchMyLocks.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const { selectSeat, deselectSeat, clearSelection, clearLockState } =
  seatSlice.actions;
export default seatSlice.reducer;
