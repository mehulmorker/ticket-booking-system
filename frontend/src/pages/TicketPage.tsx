import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { AppDispatch, RootState } from "@/store/store";
import { fetchReservation } from "@/store/slices/bookingSlice";
import { fetchEventById } from "@/store/slices/eventSlice";
import { ticketService } from "@/services/ticketService";
import Loader from "../components/common/Loader";
import { format } from "date-fns";
import toast from "react-hot-toast";
import { QRCodeSVG } from "qrcode.react";
import type { Ticket } from "@/types";

export default function TicketPage() {
  const { id } = useParams<{ id: string }>(); // reservationId
  const navigate = useNavigate();
  const dispatch = useDispatch<AppDispatch>();
  const { reservation } = useSelector((state: RootState) => state.booking);
  const { currentEvent } = useSelector((state: RootState) => state.events);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);

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

  useEffect(() => {
    const fetchTicket = async () => {
      if (!id) return;

      setIsLoading(true);
      try {
        const ticketData = await ticketService.getTicketByReservation(id);
        setTicket(ticketData);

        // Backend stores qrCode as base64-encoded JSON string
        // Decode it to get the original JSON data for QR code generation
        if (ticketData.qrCode) {
          try {
            // Decode base64 to get the JSON string
            const decoded = atob(ticketData.qrCode);
            // Verify it's valid JSON
            const parsed = JSON.parse(decoded);
            // Use the decoded JSON string for QR code (contains ticketId, reservationId, timestamp)
            setQrCodeData(decoded);
          } catch (e) {
            // If decoding fails, use the qrCode string directly as fallback
            setQrCodeData(ticketData.qrCode);
          }
        } else {
        }
      } catch (error: any) {
        console.error("Error fetching ticket:", error);
        toast.error(error?.response?.data?.message || "Failed to load ticket");
      } finally {
        setIsLoading(false);
      }
    };

    fetchTicket();
  }, [id]);

  const handleDownloadPdf = async () => {
    if (!ticket) return;

    try {
      // Always get fresh download URL from backend to ensure it's valid
      // Backend will generate a new presigned URL if needed
      const downloadUrl = await ticketService.getDownloadUrl(ticket.id);

      if (!downloadUrl) {
        toast.error(
          "Download URL not available. PDF may not be generated yet."
        );
        return;
      }

      // Directly open/download the PDF
      // If the file doesn't exist, the browser will show an error
      // We'll handle the error via the catch block
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.download = `ticket-${ticket.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Show success message (user will see error in new tab if file doesn't exist)
      toast.success("Opening ticket PDF...");
    } catch (error: any) {
      console.error("Error downloading PDF:", error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Failed to download ticket PDF";

      if (
        errorMessage.includes("not available") ||
        errorMessage.includes("NoSuchKey") ||
        errorMessage.includes("not exist")
      ) {
        toast.error(
          "PDF is not available. The ticket PDF may not have been generated yet or the file was deleted. Please contact support."
        );
      } else {
        toast.error(errorMessage);
      }
    }
  };

  if (isLoading) {
    return <Loader />;
  }

  if (!ticket) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            Ticket not found or not yet generated
          </p>
          <button
            onClick={() => navigate("/events")}
            className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700"
          >
            Back to Events
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Your Ticket
            </h1>
            <p className="text-gray-600">
              Booking confirmed! Your ticket is ready.
            </p>
          </div>

          {/* Ticket Details */}
          <div className="bg-gradient-to-br from-primary-50 to-primary-100 rounded-lg p-6 mb-6 border-2 border-primary-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Column - Event Info */}
              <div>
                {currentEvent && (
                  <>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                      {currentEvent.name}
                    </h2>
                    <div className="space-y-2 text-gray-700">
                      <div>
                        <span className="font-semibold">Date:</span>{" "}
                        {format(
                          new Date(
                            currentEvent.eventDate ||
                              currentEvent.startDate ||
                              new Date()
                          ),
                          "PPpp"
                        )}
                      </div>
                      {currentEvent.venue && (
                        <div>
                          <span className="font-semibold">Venue:</span>{" "}
                          {currentEvent.venue.name}
                        </div>
                      )}
                      <div>
                        <span className="font-semibold">Ticket ID:</span>{" "}
                        <span className="font-mono text-sm">{ticket.id}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right Column - QR Code */}
              <div className="flex flex-col items-center justify-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  QR Code
                </h3>
                {qrCodeData ? (
                  <div className="bg-white p-4 rounded-lg shadow-md">
                    <QRCodeSVG
                      value={qrCodeData}
                      size={192}
                      level="M"
                      includeMargin={true}
                    />
                  </div>
                ) : (
                  <div className="w-48 h-48 bg-gray-200 rounded-lg flex items-center justify-center">
                    <span className="text-gray-500">QR Code Loading...</span>
                  </div>
                )}
                <p className="text-xs text-gray-600 mt-2 text-center">
                  Scan this code at the venue
                </p>
              </div>
            </div>
          </div>

          {/* Reservation Details */}
          {reservation && (
            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                Reservation Details
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Reservation ID:</span>
                  <span className="font-mono text-sm">{reservation.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Seats:</span>
                  <span className="font-semibold">
                    {reservation.seatIds.length} seat(s)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span
                    className={`px-2 py-1 rounded text-sm font-semibold ${
                      reservation.status === "CONFIRMED"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {reservation.status}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            {ticket.status === "GENERATED" ? (
              <button
                onClick={handleDownloadPdf}
                className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold"
              >
                Download PDF Ticket
              </button>
            ) : (
              <button
                disabled
                className="flex-1 px-6 py-3 bg-gray-400 text-white rounded-lg cursor-not-allowed font-semibold"
                title={
                  ticket.status === "PENDING"
                    ? "PDF is being generated. Please wait..."
                    : "PDF is not available"
                }
              >
                {ticket.status === "PENDING"
                  ? "Generating PDF..."
                  : "PDF Not Available"}
              </button>
            )}
            <button
              onClick={() => navigate("/events")}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Browse More Events
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
