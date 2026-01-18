import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  paymentService,
  InitiatePaymentRequest,
  ConfirmPaymentRequest,
} from "@/services/paymentService";
import type { Payment } from "@/types";

interface PaymentState {
  payment: Payment | null;
  payments: Payment[];
  isLoading: boolean;
  error: string | null;
}

const initialState: PaymentState = {
  payment: null,
  payments: [],
  isLoading: false,
  error: null,
};

export const initiatePayment = createAsyncThunk(
  "payment/initiatePayment",
  async (data: InitiatePaymentRequest, { rejectWithValue }) => {
    try {
      return await paymentService.initiatePayment(data);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to initiate payment"
      );
    }
  }
);

export const confirmPayment = createAsyncThunk(
  "payment/confirmPayment",
  async (data: ConfirmPaymentRequest, { rejectWithValue }) => {
    try {
      return await paymentService.confirmPayment(data);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to confirm payment"
      );
    }
  }
);

export const fetchPayment = createAsyncThunk(
  "payment/fetchPayment",
  async (id: string, { rejectWithValue }) => {
    try {
      return await paymentService.getPayment(id);
    } catch (error: any) {
      return rejectWithValue(
        error.response?.data?.message || "Failed to fetch payment"
      );
    }
  }
);

const paymentSlice = createSlice({
  name: "payment",
  initialState,
  reducers: {
    clearPayment: (state) => {
      state.payment = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(initiatePayment.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(initiatePayment.fulfilled, (state, action) => {
        state.isLoading = false;
        state.payment = action.payload;
      })
      .addCase(initiatePayment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(confirmPayment.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(confirmPayment.fulfilled, (state, action) => {
        state.isLoading = false;
        state.payment = action.payload;
      })
      .addCase(confirmPayment.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchPayment.fulfilled, (state, action) => {
        state.payment = action.payload;
      });
  },
});

export const { clearPayment } = paymentSlice.actions;
export default paymentSlice.reducer;

