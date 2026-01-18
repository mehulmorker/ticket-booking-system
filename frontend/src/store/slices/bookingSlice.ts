import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { bookingService, CreateReservationRequest } from "@/services/bookingService";
import type { Reservation } from "@/types";

interface BookingState {
  reservation: Reservation | null;
  reservations: Reservation[];
  isLoading: boolean;
  error: string | null;
}

const initialState: BookingState = {
  reservation: null,
  reservations: [],
  isLoading: false,
  error: null,
};

export const createReservation = createAsyncThunk(
  "booking/createReservation",
  async (data: CreateReservationRequest, { rejectWithValue }) => {
    try {
      return await bookingService.createReservation(data);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to create reservation");
    }
  }
);

export const fetchReservation = createAsyncThunk(
  "booking/fetchReservation",
  async (id: string, { rejectWithValue }) => {
    try {
      return await bookingService.getReservation(id);
    } catch (error: any) {
      return rejectWithValue(error.response?.data?.message || "Failed to fetch reservation");
    }
  }
);

const bookingSlice = createSlice({
  name: "booking",
  initialState,
  reducers: {
    clearReservation: (state) => {
      state.reservation = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createReservation.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createReservation.fulfilled, (state, action) => {
        state.isLoading = false;
        state.reservation = action.payload;
      })
      .addCase(createReservation.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchReservation.fulfilled, (state, action) => {
        state.reservation = action.payload;
      });
  },
});

export const { clearReservation } = bookingSlice.actions;
export default bookingSlice.reducer;

