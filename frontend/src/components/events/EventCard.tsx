import { Link } from "react-router-dom";
import { format } from "date-fns";
import type { Event } from "@/types";

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  return (
    <Link
      to={`/events/${event.id}`}
      className="block bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
    >
      {event.imageUrl && (
        <img
          src={event.imageUrl}
          alt={event.title || event.name}
          className="w-full h-48 object-cover"
        />
      )}
      <div className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="px-2 py-1 text-xs font-semibold text-white bg-primary-600 rounded">
            {event.category}
          </span>
          <span
            className={`px-2 py-1 text-xs font-semibold rounded ${
              event.status === "UPCOMING"
                ? "bg-green-100 text-green-800"
                : event.status === "ONGOING"
                ? "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-800"
            }`}
          >
            {event.status}
          </span>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">
          {event.title || event.name}
        </h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {event.description}
        </p>
        <div className="flex items-center text-sm text-gray-500">
          <svg
            className="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {format(
            new Date(event.eventDate || event.startDate || new Date()),
            "MMM dd, yyyy"
          )}
        </div>
      </div>
    </Link>
  );
}
