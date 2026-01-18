import { DataSource } from "typeorm";
import { Seeder } from "./interface/seeder.interface";
import { Venue } from "../venues/entities/venue.entity";
import { Event, EventStatus } from "../events/entities/event.entity";

export class SeedEventsAndVenues1733500900000 implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    const venueRepository = dataSource.getRepository(Venue);
    const eventRepository = dataSource.getRepository(Event);

    // Check if data already exists
    const existingVenues = await venueRepository.count();
    if (existingVenues > 0) {
      console.log("✅ Venues already exist, skipping seeder");
      return;
    }

    console.log("🌱 Seeding venues and events...");

    // Create venues
    const venues = [
      {
        name: "Grand Concert Hall",
        address: "123 Music Street",
        city: "New York",
        state: "NY",
        country: "USA",
        capacity: 5000,
      },
      {
        name: "Stadium Arena",
        address: "456 Sports Boulevard",
        city: "Los Angeles",
        state: "CA",
        country: "USA",
        capacity: 20000,
      },
      {
        name: "Intimate Theater",
        address: "789 Arts Avenue",
        city: "Chicago",
        state: "IL",
        country: "USA",
        capacity: 500,
      },
      {
        name: "Outdoor Amphitheater",
        address: "321 Nature Park Road",
        city: "Austin",
        state: "TX",
        country: "USA",
        capacity: 10000,
      },
      {
        name: "Jazz Club",
        address: "654 Entertainment District",
        city: "New Orleans",
        state: "LA",
        country: "USA",
        capacity: 200,
      },
    ];

    const savedVenues = await venueRepository.save(venues);
    console.log(`✅ Created ${savedVenues.length} venues`);

    // Create events
    const now = new Date();
    const events = [
      {
        title: "Rock Concert 2025",
        description: "An electrifying rock concert featuring top artists",
        category: "CONCERT",
        venue: savedVenues[0],
        eventDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        startTime: "19:00",
        endTime: "22:00",
        status: EventStatus.UPCOMING,
        totalSeats: 5000,
        availableSeats: 5000,
      },
      {
        title: "Basketball Championship",
        description: "Championship game between top teams",
        category: "SPORTS",
        venue: savedVenues[1],
        eventDate: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
        startTime: "20:00",
        endTime: "22:00",
        status: EventStatus.UPCOMING,
        totalSeats: 20000,
        availableSeats: 20000,
      },
      {
        title: "Broadway Musical",
        description: "A spectacular Broadway musical production",
        category: "THEATER",
        venue: savedVenues[2],
        eventDate: new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000), // 45 days from now
        startTime: "19:30",
        endTime: "22:00",
        status: EventStatus.UPCOMING,
        totalSeats: 500,
        availableSeats: 500,
      },
      {
        title: "Summer Music Festival",
        description: "Multi-day outdoor music festival",
        category: "FESTIVAL",
        venue: savedVenues[3],
        eventDate: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000), // 60 days from now
        startTime: "14:00",
        endTime: "23:00",
        status: EventStatus.UPCOMING,
        totalSeats: 10000,
        availableSeats: 10000,
      },
      {
        title: "Jazz Night",
        description: "Intimate jazz performance",
        category: "CONCERT",
        venue: savedVenues[4],
        eventDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        startTime: "20:00",
        endTime: "22:00",
        status: EventStatus.UPCOMING,
        totalSeats: 200,
        availableSeats: 200,
      },
      {
        title: "Classical Symphony",
        description: "Orchestral performance of classical masterpieces",
        category: "CONCERT",
        venue: savedVenues[0],
        eventDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000), // 20 days from now
        startTime: "19:00",
        endTime: "21:00",
        status: EventStatus.UPCOMING,
        totalSeats: 5000,
        availableSeats: 5000,
      },
      {
        title: "Comedy Show",
        description: "Stand-up comedy night with famous comedians",
        category: "COMEDY",
        venue: savedVenues[1],
        eventDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
        startTime: "20:00",
        endTime: "21:30",
        status: EventStatus.UPCOMING,
        totalSeats: 20000,
        availableSeats: 20000,
      },
      {
        title: "Dance Performance",
        description: "Contemporary dance showcase",
        category: "DANCE",
        venue: savedVenues[2],
        eventDate: new Date(now.getTime() + 25 * 24 * 60 * 60 * 1000), // 25 days from now
        startTime: "19:00",
        endTime: "20:45",
        status: EventStatus.UPCOMING,
        totalSeats: 500,
        availableSeats: 500,
      },
    ];

    const savedEvents = await eventRepository.save(events);
    console.log(`✅ Created ${savedEvents.length} events`);

    console.log("✅ Seeding completed successfully!");
  }
}
