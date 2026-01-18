import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { fetchReservation } from "@/store/slices/bookingSlice";
import { fetchEventById } from "@/store/slices/eventSlice";
import { initiatePayment, confirmPayment } from "@/store/slices/paymentSlice";
import Loader from "../components/common/Loader";
import toast from "react-hot-toast";

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>(); // reservationId
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { reservation, isLoading: reservationLoading } = useSelector(
    (state: RootState) => state.booking
  );
  const { currentEvent } = useSelector((state: RootState) => state.events);
  const paymentState = useSelector((state: RootState) => state.payment);
  const payment = paymentState?.payment || null;
  const paymentLoading = paymentState?.isLoading || false;
  const { user } = useSelector((state: RootState) => state.auth);
  const [paymentMethod, setPaymentMethod] = useState("CARD");
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (id) {
      dispatch(fetchReservation(id));
    }
  }, [dispatch, id]);

  useEffect(() => {
    if (reservation?.eventId) {
      dispatch(fetchEventById(reservation.eventId));
    }
  }, [dispatch, reservation?.eventId]);

  const handleInitiatePayment = async () => {
    if (!reservation || !currentEvent || !user) {
      toast.error("Missing reservation or event information");
      return;
    }

    setIsProcessing(true);
    try {
      const idempotencyKey = `payment-${Date.now()}`;
      await dispatch(
        initiatePayment({
          reservationId: reservation.id,
          paymentMethod: paymentMethod as "CARD" | "PAYPAL" | "BANK_TRANSFER",
          amount: Number(reservation.totalAmount || 0), // Ensure it's a number
          eventId: currentEvent.id,
          idempotencyKey,
        })
      ).unwrap();
      toast.success("Payment initiated successfully");
    } catch (error: any) {
      toast.error(error || "Failed to initiate payment");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!payment) {
      toast.error("No payment to confirm");
      return;
    }

    setIsProcessing(true);
    try {
      // Generate mock transaction ID (in real app, this comes from payment gateway)
      const transactionId = `TXN-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;

      await dispatch(
        confirmPayment({
          paymentId: payment.id,
          transactionId,
        })
      ).unwrap();

      toast.success("Payment confirmed successfully!");
      // Navigate to ticket page after a short delay to allow saga to complete
      setTimeout(() => {
        navigate(`/tickets/${reservation?.id}`);
      }, 2000);
    } catch (error: any) {
      toast.error(error || "Failed to confirm payment");
    } finally {
      setIsProcessing(false);
    }
  };

  if (reservationLoading) {
    return <Loader />;
  }

  if (!reservation) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-600">Reservation not found</p>
          <button
            onClick={() => navigate("/events")}
            className="mt-4 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  const expiresAt = new Date(reservation.expiresAt);
  const now = new Date();
  const minutesRemaining = Math.max(
    0,
    Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60)
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Complete Payment
          </h1>

          {/* Reservation Summary */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Reservation Summary
            </h2>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600">Reservation ID:</span>
                <span className="font-mono text-sm">{reservation.id}</span>
              </div>
              {currentEvent && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Event:</span>
                  <span className="font-semibold">{currentEvent.name}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Seats:</span>
                <span className="font-semibold">
                  {reservation.seatIds.length} seat(s)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total Amount:</span>
                <span className="font-bold text-lg">
                  ${Number(reservation.totalAmount || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Expires in:</span>
                <span className="font-semibold text-red-600">
                  {minutesRemaining} minutes
                </span>
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          {!payment && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Select Payment Method
              </h2>
              <div className="space-y-2">
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="CARD"
                    checked={paymentMethod === "CARD"}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mr-3"
                  />
                  <span className="font-semibold">Credit/Debit Card</span>
                </label>
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="PAYPAL"
                    checked={paymentMethod === "PAYPAL"}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mr-3"
                  />
                  <span className="font-semibold">PayPal</span>
                </label>
                <label className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="BANK_TRANSFER"
                    checked={paymentMethod === "BANK_TRANSFER"}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="mr-3"
                  />
                  <span className="font-semibold">Bank Transfer</span>
                </label>
              </div>
            </div>
          )}

          {/* Payment Status */}
          {payment && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Payment Status
              </h2>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-700">Payment ID:</span>
                  <span className="font-mono text-sm">{payment.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Status:</span>
                  <span
                    className={`px-3 py-1 rounded text-sm font-semibold ${
                      payment.status === "COMPLETED"
                        ? "bg-green-100 text-green-800"
                        : payment.status === "PENDING"
                        ? "bg-yellow-100 text-yellow-800"
                        : payment.status === "FAILED"
                        ? "bg-red-100 text-red-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {payment.status}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            {!payment ? (
              <button
                onClick={handleInitiatePayment}
                disabled={
                  isProcessing || paymentLoading || minutesRemaining === 0
                }
                className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {isProcessing || paymentLoading
                  ? "Processing..."
                  : "Initiate Payment"}
              </button>
            ) : payment.status === "PENDING" ||
              payment.status === "PROCESSING" ? (
              <button
                onClick={handleConfirmPayment}
                disabled={isProcessing || paymentLoading}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
              >
                {isProcessing || paymentLoading
                  ? "Confirming..."
                  : "Confirm Payment"}
              </button>
            ) : payment.status === "COMPLETED" ? (
              <button
                onClick={() => navigate(`/tickets/${reservation.id}`)}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
              >
                View Tickets
              </button>
            ) : null}
            <button
              onClick={() => navigate(`/reservations/${reservation.id}`)}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Back
            </button>
          </div>

          {minutesRemaining === 0 && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                ⚠️ Your reservation has expired. Please create a new
                reservation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
