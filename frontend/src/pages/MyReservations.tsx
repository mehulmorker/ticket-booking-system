import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { fetchProfile } from "@/store/slices/authSlice";
import { bookingService } from "@/services/bookingService";
import Loader from "../components/common/Loader";
import { format } from "date-fns";
import toast from "react-hot-toast";

export default function MyReservations() {
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { user, isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );
  const [reservations, setReservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch user profile if authenticated but user is missing
  useEffect(() => {
    if (isAuthenticated && !user) {
      dispatch(fetchProfile());
    }
  }, [dispatch, isAuthenticated, user]);

  useEffect(() => {
    const fetchReservations = async () => {
      // ProtectedRoute already handles authentication
      // Wait for user to be available
      if (!user || !user.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const data = await bookingService.getUserReservations(user.id);
        setReservations(data);
      } catch (error: any) {
        // Don't navigate on error - just show error message
        // If it's a 401, the API interceptor will handle redirect
        toast.error(
          error?.response?.data?.message || "Failed to load reservations"
        );
      } finally {
        setIsLoading(false);
      }
    };

    // Only fetch if authenticated and user exists
    if (isAuthenticated && user && user.id) {
      fetchReservations();
    } else if (isAuthenticated && !user) {
      // User might be loading - keep loading state
      // Don't fetch yet
    } else {
      setIsLoading(false);
    }
  }, [user, isAuthenticated]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">My Reservations</h1>

      {reservations.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 mb-4">You have no reservations yet</p>
          <button
            onClick={() => navigate("/events")}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Browse Events
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reservations.map((reservation) => (
            <div
              key={reservation.id}
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`px-3 py-1 rounded text-sm font-semibold ${
                    reservation.status === "CONFIRMED"
                      ? "bg-green-100 text-green-800"
                      : reservation.status === "PENDING"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-gray-100 text-gray-800"
                  }`}
                >
                  {reservation.status}
                </span>
                <span className="text-sm text-gray-600">
                  {format(new Date(reservation.createdAt), "MMM d, yyyy")}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div>
                  <span className="text-gray-600">Reservation ID:</span>
                  <span className="ml-2 font-mono text-sm">
                    {reservation.id}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Seats:</span>
                  <span className="ml-2 font-semibold">
                    {reservation.seatIds.length} seat(s)
                  </span>
                </div>
                {reservation.totalAmount && (
                  <div>
                    <span className="text-gray-600">Amount:</span>
                    <span className="ml-2 font-semibold">
                      ${Number(reservation.totalAmount || 0).toFixed(2)}
                    </span>
                  </div>
                )}
                {reservation.expiresAt && (
                  <div>
                    <span className="text-gray-600">Expires:</span>
                    <span className="ml-2">
                      {format(new Date(reservation.expiresAt), "PPpp")}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/reservations/${reservation.id}`)}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 text-sm"
                >
                  View Details
                </button>
                {reservation.status === "PENDING" && (
                  <button
                    onClick={() => navigate(`/payments/${reservation.id}`)}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                  >
                    Pay Now
                  </button>
                )}
                {reservation.status === "CONFIRMED" && (
                  <button
                    onClick={() => navigate(`/tickets/${reservation.id}`)}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                  >
                    View Ticket
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
