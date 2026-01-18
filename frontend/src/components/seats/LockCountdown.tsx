import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/store/store";

interface LockCountdownProps {
  onExpiry?: () => void;
  showWarning?: boolean;
}

export default function LockCountdown({
  onExpiry,
  showWarning = true,
}: LockCountdownProps) {
  const { lockExpiresAt, lockedSeats } = useSelector(
    (state: RootState) => state.seats
  );
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);

  useEffect(() => {
    // Don't show countdown if there are no locked seats, even if lockExpiresAt exists
    if (!lockExpiresAt || !lockedSeats || lockedSeats.length === 0) {
      setTimeRemaining(null);
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const expiry = new Date(lockExpiresAt).getTime();
      const remaining = Math.max(0, Math.floor((expiry - now) / 1000));

      setTimeRemaining(remaining);

      if (remaining === 0 && onExpiry) {
        onExpiry();
      }
    };

    updateTimer(); // Initial call
    const interval = setInterval(updateTimer, 1000); // Update every second

    return () => clearInterval(interval);
  }, [lockExpiresAt, lockedSeats, onExpiry]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // Don't render anything if there are no locked seats
  if (!lockedSeats || lockedSeats.length === 0) {
    return null;
  }

  if (timeRemaining === null) {
    return null;
  }

  if (timeRemaining === 0) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
        ⚠️ Your seat lock has expired. Please select seats again.
      </div>
    );
  }

  const isLowTime = timeRemaining <= 60; // Less than 1 minute

  return (
    <div
      className={`px-4 py-2 rounded ${
        isLowTime && showWarning
          ? "bg-yellow-100 border border-yellow-400 text-yellow-700"
          : "bg-blue-100 border border-blue-400 text-blue-700"
      }`}
    >
      {isLowTime && showWarning && (
        <span className="font-semibold">⚠️ Low time! </span>
      )}
      <span>Seats locked for: {formatTime(timeRemaining)}</span>
    </div>
  );
}
