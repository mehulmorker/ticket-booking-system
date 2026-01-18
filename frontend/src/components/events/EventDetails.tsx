import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { fetchEventById } from "@/store/slices/eventSlice";
import {
  fetchAllSeatsByEvent,
  lockSeats,
  releaseSeats,
  clearSelection,
  clearLockState,
  fetchMyLocks,
} from "@/store/slices/seatSlice";
import Loader from "../common/Loader";
import SeatMap from "../seats/SeatMap";
import LockCountdown from "../seats/LockCountdown";
import ExtendLockButton from "../seats/ExtendLockButton";
import CreateReservationButton from "../booking/CreateReservationButton";
import { format } from "date-fns";
import toast from "react-hot-toast";

export default function EventDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { currentEvent, isLoading: eventLoading } = useSelector(
    (state: RootState) => state.events
  );
  const {
    selectedSeats,
    lockedSeats,
    isLoading: seatsLoading,
    lockExpiresAt,
  } = useSelector((state: RootState) => state.seats);
  const { user } = useSelector((state: RootState) => state.auth);
  const [isLocking, setIsLocking] = useState(false);

  useEffect(() => {
    if (id) {
      dispatch(fetchEventById(id));
      dispatch(fetchAllSeatsByEvent(id)); // Fetch all seats (including locked, reserved, sold)

      // Fetch user's active locks for this event if user is logged in
      if (user && user.id) {
        dispatch(fetchMyLocks({ userId: user.id, eventId: id }));
      } else {
        // Clear lock state if user is not logged in
        dispatch(clearLockState());
      }
    }
  }, [dispatch, id, user]);

  const handleLockSeats = async () => {
    if (selectedSeats.length === 0) {
      toast.error("Please select at least one seat");
      return;
    }

    if (!user || !user.id) {
      toast.error("Please login to lock seats");
      navigate("/login");
      return;
    }

    if (!id) {
      toast.error("Event ID is missing");
      return;
    }

    // Filter out seats that are already locked by this user
    const lockedSeatIds = lockedSeats.map((s) => s.id);
    const seatsToLock = selectedSeats.filter(
      (seat) => !lockedSeatIds.includes(seat.id)
    );

    // If all selected seats are already locked, just extend locks
    if (seatsToLock.length === 0) {
      toast("All selected seats are already locked. Proceed to reservation.", {
        icon: "ℹ️",
      });
      dispatch(clearSelection());
      return;
    }

    setIsLocking(true);
    try {
      const result = await dispatch(
        lockSeats({
          eventId: id,
          ownerId: user.id,
          seats: seatsToLock.map((s) => s.id),
          ttlSeconds: 300, // 5 minutes
        })
      ).unwrap();

      if (result.alreadyLocked) {
        toast.success(
          `Seats already locked. Lock extended. Proceed to reservation.`
        );
      } else {
        toast.success(`Successfully locked ${seatsToLock.length} seat(s)`);
      }
      // Clear selection after locking
      dispatch(clearSelection());
      // Refresh seats and locks to show updated status
      dispatch(fetchAllSeatsByEvent(id));
      if (user && user.id) {
        dispatch(fetchMyLocks({ userId: user.id, eventId: id }));
      }
    } catch (error: any) {
      toast.error(error || "Failed to lock seats");
    } finally {
      setIsLocking(false);
    }
  };

  const handleReleaseSeats = async () => {
    if (lockedSeats.length === 0 || !user) {
      return;
    }

    try {
      await dispatch(
        releaseSeats({
          eventId: id!,
          ownerId: user.id,
          seats: lockedSeats.map((s) => s.id),
        })
      ).unwrap();
      toast.success("Seats released");
    } catch (error: any) {
      toast.error(error || "Failed to release seats");
    }
  };

  if (eventLoading) {
    return <Loader />;
  }

  if (!currentEvent) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-600">Event not found</p>
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

  return (
    <div className="container mx-auto px-4 py-8">
      <button
        onClick={() => navigate("/events")}
        className="mb-4 text-primary-600 hover:text-primary-700"
      >
        ← Back to Events
      </button>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {currentEvent.imageUrl && (
          <img
            src={currentEvent.imageUrl}
            alt={currentEvent.title || currentEvent.name}
            className="w-full h-96 object-cover"
          />
        )}
        <div className="p-8">
          <div className="flex items-center justify-between mb-4">
            <span className="px-3 py-1 text-sm font-semibold text-white bg-primary-600 rounded">
              {currentEvent.category}
            </span>
            <span
              className={`px-3 py-1 text-sm font-semibold rounded ${
                currentEvent.status === "UPCOMING"
                  ? "bg-green-100 text-green-800"
                  : currentEvent.status === "ONGOING"
                  ? "bg-blue-100 text-blue-800"
                  : "bg-gray-100 text-gray-800"
              }`}
            >
              {currentEvent.status}
            </span>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            {currentEvent.title || currentEvent.name}
          </h1>
          <p className="text-gray-600 mb-6">{currentEvent.description}</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <h3 className="font-semibold text-gray-700 mb-2">Event Date</h3>
              <p className="text-gray-900">
                {format(
                  new Date(
                    currentEvent.eventDate ||
                      currentEvent.startDate ||
                      new Date()
                  ),
                  "PPpp"
                )}
              </p>
            </div>
            {currentEvent.endTime && (
              <div>
                <h3 className="font-semibold text-gray-700 mb-2">End Time</h3>
                <p className="text-gray-900">{currentEvent.endTime}</p>
              </div>
            )}
          </div>

          {currentEvent.venue && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-700 mb-2">Venue</h3>
              <p className="text-gray-900">{currentEvent.venue.name}</p>
              <p className="text-gray-600">
                {currentEvent.venue.address}, {currentEvent.venue.city},{" "}
                {currentEvent.venue.state} {currentEvent.venue.zipCode}
              </p>
            </div>
          )}

          <div className="mt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Select Seats
            </h2>
            {seatsLoading ? (
              <Loader />
            ) : (
              <div className="space-y-4">
                <SeatMap eventId={id!} />

                {/* Action Buttons */}
                <div className="flex items-center gap-4 mt-4 flex-wrap">
                  {/* Show lock button when seats are selected (even if locks exist) */}
                  {selectedSeats.length > 0 &&
                    (() => {
                      // Filter out seats that are already locked
                      const lockedSeatIds = lockedSeats.map((s) => s.id);
                      const newSeatsToLock = selectedSeats.filter(
                        (seat) => !lockedSeatIds.includes(seat.id)
                      );
                      return newSeatsToLock.length > 0 ? (
                        <button
                          onClick={handleLockSeats}
                          disabled={isLocking || newSeatsToLock.length === 0}
                          className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                        >
                          {isLocking
                            ? "Locking..."
                            : `Lock ${newSeatsToLock.length} New Seat(s)`}
                        </button>
                      ) : null;
                    })()}

                  {/* Show reservation CTA when seats are locked */}
                  {lockExpiresAt && lockedSeats.length > 0 && (
                    <>
                      <LockCountdown
                        onExpiry={() => {
                          toast.error(
                            "Your seat lock has expired. Please select seats again."
                          );
                          dispatch(clearLockState());
                        }}
                      />
                      <ExtendLockButton eventId={id!} />
                      <CreateReservationButton
                        eventId={id!}
                        lockedSeatIds={lockedSeats.map((s) => s.id)}
                        totalAmount={lockedSeats.reduce(
                          (sum, seat) => sum + Number(seat.price || 0),
                          0
                        )}
                      />
                      <button
                        onClick={handleReleaseSeats}
                        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                      >
                        Release Seats
                      </button>
                    </>
                  )}

                  {/* Show helpful message when user has locked seats */}
                  {lockExpiresAt &&
                    lockedSeats.length > 0 &&
                    selectedSeats.length === 0 && (
                      <div className="px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <p className="text-sm text-yellow-800">
                          You have {lockedSeats.length} seat(s) locked.{" "}
                          {selectedSeats.length === 0 && (
                            <>
                              Click on yellow seats to proceed to reservation,
                              or select additional seats to lock them together.
                            </>
                          )}
                        </p>
                      </div>
                    )}

                  {/* Show message when user has both locked and selected seats */}
                  {lockExpiresAt &&
                    lockedSeats.length > 0 &&
                    selectedSeats.length > 0 && (
                      <div className="px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          You have {lockedSeats.length} seat(s) already locked
                          and {selectedSeats.length} seat(s) selected. Lock the
                          selected seats to add them to your reservation.
                        </p>
                      </div>
                    )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
