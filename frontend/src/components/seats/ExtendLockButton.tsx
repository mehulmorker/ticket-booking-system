import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { extendLock } from "@/store/slices/seatSlice";
import toast from "react-hot-toast";

interface ExtendLockButtonProps {
  eventId: string;
}

export default function ExtendLockButton({ eventId }: ExtendLockButtonProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { lockedSeats, lockOwnerId, isLoading } = useSelector(
    (state: RootState) => state.seats
  );

  const handleExtend = async () => {
    if (lockedSeats.length === 0 || !lockOwnerId) {
      toast.error("No seats locked to extend");
      return;
    }

    try {
      await dispatch(
        extendLock({
          eventId,
          ownerId: lockOwnerId,
          seats: lockedSeats.map((s) => s.id),
          ttlSeconds: 300, // 5 minutes
        })
      ).unwrap();
      toast.success("Lock extended by 5 minutes");
    } catch (error: any) {
      toast.error(error || "Failed to extend lock");
    }
  };

  if (lockedSeats.length === 0) {
    return null;
  }

  return (
    <button
      onClick={handleExtend}
      disabled={isLoading}
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {isLoading ? "Extending..." : "Extend Lock (+5 min)"}
    </button>
  );
}
