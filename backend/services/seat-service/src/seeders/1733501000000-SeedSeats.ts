import { DataSource } from "typeorm";
import { Seeder } from "./interface/seeder.interface";
import { Seat } from "../seats/entities/seat.entity";

export class SeedSeats1733501000000 implements Seeder {
  async run(dataSource: DataSource): Promise<void> {
    const seatRepository = dataSource.getRepository(Seat);

    // Get events from event database using direct PostgreSQL connection
    const eventDbHost = process.env.DB_HOST || "postgres";
    const eventDbPort = parseInt(process.env.DB_PORT || "5432", 10);
    const eventDbUser = process.env.DB_USERNAME || "postgres";
    const eventDbPassword = process.env.DB_PASSWORD || "postgres";
    const eventDbName = "event_db";

    // Detect if using AWS RDS (requires SSL)
    const isRDS =
      eventDbHost.includes(".rds.amazonaws.com") ||
      eventDbHost.includes(".rds.");

    // Use require for pg to avoid TypeScript type issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Client } = require("pg");
    const eventClient = new Client({
      host: eventDbHost,
      port: eventDbPort,
      user: eventDbUser,
      password: eventDbPassword,
      database: eventDbName,
      // SSL configuration for AWS RDS (RDS requires SSL but uses self-signed certificates)
      ssl: isRDS
        ? {
            rejectUnauthorized: false, // RDS uses self-signed certificates
          }
        : false,
    });

    try {
      console.log("🌱 Connecting to event database...");
      await eventClient.connect();

      console.log("🌱 Fetching events from event database...");
      const result = await eventClient.query(`
        SELECT id, title, "totalSeats" 
        FROM events 
        WHERE status = 'UPCOMING'
        ORDER BY "eventDate" ASC
      `);

      const events = result.rows;

      if (!events || events.length === 0) {
        console.log("⚠️  No events found. Please run event seeder first.");
        return;
      }

      console.log(`📅 Found ${events.length} events`);

      for (const event of events) {
        // Check if seats already exist for this event
        const existingSeats = await seatRepository.count({
          where: { eventId: event.id },
        });

        if (existingSeats > 0) {
          console.log(
            `⏭️  Seats already exist for event: ${event.title}, skipping...`
          );
          continue;
        }

        console.log(
          `🎫 Creating seats for event: ${event.title} (${event.id})`
        );

        const seats: Partial<Seat>[] = [];
        const rows = ["A", "B", "C", "D", "E"];
        const seatsPerRow = 4;
        const basePrice = 50.0;

        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
          const rowLabel = rows[rowIndex];
          const section = rowIndex <= 2 ? "Orchestra" : "Balcony";
          const seatType = rowIndex <= 1 ? "VIP" : "REGULAR";
          const price = rowIndex <= 1 ? basePrice * 1.5 : basePrice;

          for (let seatNum = 1; seatNum <= seatsPerRow; seatNum++) {
            seats.push({
              eventId: event.id,
              rowLabel,
              seatNumber: seatNum.toString(),
              section,
              seatType,
              price,
              status: "AVAILABLE",
            });
          }
        }

        await seatRepository.save(seats);
        console.log(
          `✅ Created ${seats.length} seats for event: ${event.title}`
        );
      }

      console.log("✅ Seeding seats completed successfully!");
    } catch (error) {
      console.error("❌ Error seeding seats:", error);
      console.log("💡 Tip: Make sure event seeder has been run first");
      // Don't throw - allow seeder to complete gracefully
    } finally {
      await eventClient.end();
    }
  }
}
