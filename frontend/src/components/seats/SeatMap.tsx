import { useMemo, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/store/store";
import { selectSeat, deselectSeat } from "@/store/slices/seatSlice";
import type { Seat } from "@/types";

interface SeatMapProps {
  eventId: string;
  onSeatsSelected?: (seats: Seat[]) => void;
}

export default function SeatMap({ eventId, onSeatsSelected }: SeatMapProps) {
  const dispatch = useDispatch<AppDispatch>();
  const { seats, selectedSeats, isLoading } = useSelector(
    (state: RootState) => state.seats
  );
  const { user } = useSelector((state: RootState) => state.auth);

  // Filter seats for this event
  const eventSeats = useMemo(
    () => seats.filter((seat) => seat.eventId === eventId),
    [seats, eventId]
  );

  // Group seats by row
  const seatsByRow = useMemo(() => {
    const grouped: { [key: string]: Seat[] } = {};
    eventSeats.forEach((seat) => {
      const row = seat.rowLabel || "Unknown";
      if (!grouped[row]) {
        grouped[row] = [];
      }
      grouped[row].push(seat);
    });

    // Sort seats within each row by seat number
    Object.keys(grouped).forEach((row) => {
      grouped[row].sort((a, b) => {
        const numA = parseInt(a.seatNumber) || 0;
        const numB = parseInt(b.seatNumber) || 0;
        return numA - numB;
      });
    });

    return grouped;
  }, [eventSeats]);

  const handleSeatClick = (seat: Seat) => {
    // Don't allow selection of unavailable seats
    if (seat.status === "RESERVED" || seat.status === "SOLD") {
      return;
    }

    // Handle seats locked by current user - allow proceeding to reservation
    if (seat.status === "LOCKED" && seat.lockedBy) {
      if (user && seat.lockedBy === user.id) {
        // Seat is locked by current user - trigger reservation flow
        // This will be handled by parent component (EventDetails) which shows "Reserve Now" button
        // Just select the seat so parent can proceed
        const isSelected = selectedSeats.some((s) => s.id === seat.id);
        if (!isSelected) {
          dispatch(selectSeat(seat));
        }
        return;
      } else {
        // Locked by another user - don't allow selection
        return;
      }
    }

    // Toggle selection for available seats
    const isSelected = selectedSeats.some((s) => s.id === seat.id);
    if (isSelected) {
      dispatch(deselectSeat(seat.id));
    } else {
      dispatch(selectSeat(seat));
    }
  };

  // Notify parent when selection changes
  useEffect(() => {
    if (onSeatsSelected) {
      onSeatsSelected(selectedSeats);
    }
  }, [selectedSeats, onSeatsSelected]);

  const getSeatColor = (seat: Seat): string => {
    if (selectedSeats.some((s) => s.id === seat.id)) {
      return "bg-blue-500 hover:bg-blue-600 text-white"; // Selected
    }
    if (seat.status === "AVAILABLE") {
      return "bg-green-500 hover:bg-green-600 text-white cursor-pointer"; // Available
    }
    if (seat.status === "LOCKED") {
      // Only show yellow (Locked by You) if the current user is the one who locked it
      if (user && seat.lockedBy && seat.lockedBy === user.id) {
        return "bg-yellow-500 hover:bg-yellow-600 text-white cursor-pointer"; // Locked by me
      }
      // Otherwise show gray (Locked by Others)
      return "bg-gray-400 text-white cursor-not-allowed"; // Locked by someone else
    }
    if (seat.status === "RESERVED" || seat.status === "SOLD") {
      return "bg-red-500 text-white cursor-not-allowed"; // Reserved/Sold
    }
    return "bg-gray-300 text-gray-600 cursor-not-allowed"; // Unknown
  };

  const getSeatLabel = (seat: Seat): string => {
    return seat.seatNumber || seat.id.substring(0, 8);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-600">Loading seats...</div>
      </div>
    );
  }

  if (eventSeats.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No seats available for this event</p>
      </div>
    );
  }

  const rows = Object.keys(seatsByRow).sort();

  return (
    <div className="w-full">
      {/* Legend */}
      <div className="mb-6 flex flex-wrap gap-4 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-green-500 rounded"></div>
          <span className="text-sm text-gray-700">Available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-500 rounded"></div>
          <span className="text-sm text-gray-700">Selected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-yellow-500 rounded"></div>
          <span className="text-sm text-gray-700">Locked (You)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-400 rounded"></div>
          <span className="text-sm text-gray-700">Locked (Others)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-red-500 rounded"></div>
          <span className="text-sm text-gray-700">Reserved/Sold</span>
        </div>
      </div>

      {/* Seat Map */}
      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row} className="flex items-center gap-2">
            <div className="w-16 text-sm font-semibold text-gray-700 text-right">
              Row {row}
            </div>
            <div className="flex-1 flex flex-wrap gap-2">
              {seatsByRow[row].map((seat) => (
                <button
                  key={seat.id}
                  onClick={() => handleSeatClick(seat)}
                  disabled={
                    seat.status === "RESERVED" ||
                    seat.status === "SOLD" ||
                    !!(
                      seat.status === "LOCKED" &&
                      seat.lockedBy &&
                      (!user || seat.lockedBy !== user.id)
                    )
                  }
                  className={`w-10 h-10 rounded text-xs font-medium transition-colors ${getSeatColor(
                    seat
                  )}`}
                  title={`Seat ${getSeatLabel(seat)} - ${
                    seat.status
                  } - $${Number(seat.price || 0).toFixed(2)}`}
                >
                  {getSeatLabel(seat)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Selection Summary */}
      {selectedSeats.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold text-gray-900 mb-2">
            Selected Seats ({selectedSeats.length})
          </h3>
          <div className="flex flex-wrap gap-2 mb-2">
            {selectedSeats.map((seat) => {
              const isAlreadyLocked = user && seat.lockedBy === user.id;
              return (
                <span
                  key={seat.id}
                  className={`px-2 py-1 rounded text-sm ${
                    isAlreadyLocked
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-blue-100 text-blue-800"
                  }`}
                >
                  Row {seat.rowLabel} Seat {seat.seatNumber}
                  {isAlreadyLocked && " (Already Locked)"}
                </span>
              );
            })}
          </div>
          <div className="text-lg font-bold text-gray-900">
            Total: $
            {selectedSeats
              .reduce((sum, seat) => sum + Number(seat.price || 0), 0)
              .toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
}
