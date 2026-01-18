import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { fetchReservation } from "@/store/slices/bookingSlice";
import { fetchEventById } from "@/store/slices/eventSlice";
import Loader from "../components/common/Loader";
import { format } from "date-fns";

export default function ReservationConfirmation() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { reservation, isLoading } = useSelector(
    (state: RootState) => state.booking
  );
  const { currentEvent } = useSelector((state: RootState) => state.events);

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

  if (isLoading) {
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

  // Only check expiry for PENDING reservations
  // CONFIRMED, EXPIRED, and CANCELLED statuses are definitive
  const isExpired =
    reservation.status === "EXPIRED" ||
    (reservation.status === "PENDING" && minutesRemaining <= 0);
  const isPending = reservation.status === "PENDING" && minutesRemaining > 0;
  const isConfirmed = reservation.status === "CONFIRMED";
  const isCancelled = reservation.status === "CANCELLED";

  // Get status-specific icon and colors
  const getStatusConfig = () => {
    if (isConfirmed) {
      return {
        iconBg: "bg-green-100",
        iconColor: "text-green-600",
        title: "Reservation Confirmed!",
        subtitle: "Your booking has been confirmed successfully",
      };
    }
    if (isExpired || reservation.status === "EXPIRED") {
      return {
        iconBg: "bg-blue-100",
        iconColor: "text-blue-600",
        title: "Reservation Expired",
        subtitle:
          "This reservation has expired. You can create a new reservation if needed.",
      };
    }
    if (isCancelled) {
      return {
        iconBg: "bg-gray-100",
        iconColor: "text-gray-600",
        title: "Reservation Cancelled",
        subtitle: "This reservation has been cancelled",
      };
    }
    // PENDING
    return {
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-600",
      title: "Reservation Created!",
      subtitle: "Complete payment to confirm your booking",
    };
  };

  const statusConfig = getStatusConfig();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-6">
            <div
              className={`w-16 h-16 ${statusConfig.iconBg} rounded-full flex items-center justify-center mx-auto mb-4`}
            >
              {isConfirmed ? (
                <svg
                  className={`w-8 h-8 ${statusConfig.iconColor}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              ) : isExpired || isCancelled ? (
                <svg
                  className={`w-8 h-8 ${statusConfig.iconColor}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg
                  className={`w-8 h-8 ${statusConfig.iconColor}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {statusConfig.title}
            </h1>
            <p className="text-gray-600">{statusConfig.subtitle}</p>
          </div>

          <div className="space-y-4 mb-6">
            <div className="border-b pb-4">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Reservation Details
              </h2>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Reservation ID:</span>
                  <span className="font-mono text-sm">{reservation.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span
                    className={`px-2 py-1 rounded text-sm font-semibold ${
                      reservation.status === "PENDING"
                        ? "bg-yellow-100 text-yellow-800"
                        : reservation.status === "CONFIRMED"
                        ? "bg-green-100 text-green-800"
                        : reservation.status === "EXPIRED"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {reservation.status}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Seats:</span>
                  <span className="font-semibold">
                    {reservation.seatIds.length} seat(s)
                  </span>
                </div>
                {reservation.totalAmount && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Amount:</span>
                    <span className="font-bold text-lg">
                      ${Number(reservation.totalAmount || 0).toFixed(2)}
                    </span>
                  </div>
                )}
                {isPending && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expires in:</span>
                    <span className="font-semibold">
                      {minutesRemaining} minutes
                    </span>
                  </div>
                )}
                {isExpired && reservation.expiresAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Expired at:</span>
                    <span className="font-semibold">
                      {format(new Date(reservation.expiresAt), "PPpp")}
                    </span>
                  </div>
                )}
                {isConfirmed && reservation.confirmedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Confirmed at:</span>
                    <span className="font-semibold">
                      {format(new Date(reservation.confirmedAt), "PPpp")}
                    </span>
                  </div>
                )}
                {isCancelled && reservation.cancelledAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cancelled at:</span>
                    <span className="font-semibold">
                      {format(new Date(reservation.cancelledAt), "PPpp")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {currentEvent && (
              <div className="border-b pb-4">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Event Details
                </h2>
                <div className="space-y-2">
                  <div>
                    <span className="text-gray-600">Event:</span>
                    <span className="ml-2 font-semibold">
                      {currentEvent.name}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Date:</span>
                    <span className="ml-2">
                      {format(
                        new Date(
                          currentEvent.eventDate ||
                            currentEvent.startDate ||
                            new Date()
                        ),
                        "PPpp"
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Status-specific messages */}
            {isPending && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  ⚠️ Your reservation will expire in {minutesRemaining} minutes.
                  Please complete payment to confirm your booking.
                </p>
              </div>
            )}

            {isExpired && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  ℹ️ This reservation has expired. The seats are now available
                  for booking. You can browse events to create a new
                  reservation.
                </p>
              </div>
            )}

            {isConfirmed && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-sm text-green-800">
                  ✅ Your reservation has been confirmed! You can view your
                  ticket and download the PDF.
                </p>
              </div>
            )}

            {isCancelled && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm text-gray-800">
                  ℹ️ This reservation has been cancelled. The seats have been
                  released and are now available for other customers.
                </p>
              </div>
            )}
          </div>

          {/* Action buttons based on status */}
          <div className="flex gap-4">
            {isPending && (
              <button
                onClick={() => navigate(`/payments/${reservation.id}`)}
                className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold"
              >
                Proceed to Payment
              </button>
            )}

            {isConfirmed && (
              <button
                onClick={() => navigate(`/tickets/${reservation.id}`)}
                className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
              >
                View Ticket
              </button>
            )}

            {(isExpired || isCancelled) && (
              <button
                onClick={() => navigate("/events")}
                className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold"
              >
                Browse Events
              </button>
            )}

            <button
              onClick={() => navigate("/events")}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              {isPending ? "Back to Events" : "Back to Events"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
