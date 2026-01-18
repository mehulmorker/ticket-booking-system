import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { AppDispatch, RootState } from "@/store/store";
import { createReservation } from "@/store/slices/bookingSlice";
import { clearSelection } from "@/store/slices/seatSlice";
import toast from "react-hot-toast";

interface CreateReservationButtonProps {
  eventId: string;
  lockedSeatIds: string[];
  totalAmount: number;
}

export default function CreateReservationButton({
  eventId,
  lockedSeatIds,
  totalAmount,
}: CreateReservationButtonProps) {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { user } = useSelector((state: RootState) => state.auth);
  const { isLoading } = useSelector((state: RootState) => state.booking);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateReservation = async () => {
    if (lockedSeatIds.length === 0) {
      toast.error("Please lock seats first before creating a reservation");
      return;
    }

    if (!user || !user.id) {
      toast.error("Please login to create a reservation");
      navigate("/login");
      return;
    }

    setIsCreating(true);
    try {
      const idempotencyKey = `reservation-${Date.now()}`;
      const reservation = await dispatch(
        createReservation({
          eventId,
          seatIds: lockedSeatIds,
          totalAmount,
          idempotencyKey,
        })
      ).unwrap();

      toast.success("Reservation created successfully!");

      // Clear seat selection
      dispatch(clearSelection());

      // Navigate to reservation confirmation or payment page
      navigate(`/reservations/${reservation.id}`);
    } catch (error: any) {
      toast.error(error || "Failed to create reservation");
    } finally {
      setIsCreating(false);
    }
  };

  if (lockedSeatIds.length === 0) {
    return null;
  }

  return (
    <button
      onClick={handleCreateReservation}
      disabled={isCreating || isLoading || lockedSeatIds.length === 0}
      className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold text-lg"
    >
      {isCreating || isLoading
        ? "Creating Reservation..."
        : `Create Reservation ($${Number(totalAmount || 0).toFixed(2)})`}
    </button>
  );
}
