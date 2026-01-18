import type { Event } from "@/types";

/**
 * Maps backend Event format to frontend format
 * Backend uses: title, eventDate, startTime, endTime
 * Frontend expects: name, startDate, endDate (for backward compatibility)
 */
export function mapEventFromBackend(event: any): Event {
  // Calculate endDate from eventDate + endTime if available
  let endDate = event.eventDate;
  if (event.eventDate && event.endTime) {
    const eventDate = new Date(event.eventDate);
    const [hours, minutes, seconds] = event.endTime.split(":").map(Number);
    eventDate.setHours(hours, minutes, seconds || 0);
    endDate = eventDate.toISOString();
  }

  return {
    ...event,
    // Map backend fields to frontend expected fields
    name: event.title || event.name, // Alias for backward compatibility
    startDate: event.eventDate || event.startDate, // Alias for backward compatibility
    endDate: endDate || event.endDate, // Computed or provided
    venueId: event.venue?.id || event.venueId, // Extract venueId from relation
  };
}

/**
 * Maps frontend Event format to backend format
 */
export function mapEventToBackend(event: Partial<Event>): any {
  return {
    title: event.title || event.name,
    description: event.description,
    category: event.category,
    venueId: event.venueId || event.venue?.id,
    eventDate: event.eventDate || event.startDate,
    startTime: event.startTime,
    endTime: event.endTime,
    imageUrl: event.imageUrl,
    totalSeats: event.totalSeats,
  };
}

