import { DataSource } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { SeedSeats1733501000000 } from "./1733501000000-SeedSeats";

async function runSeeders() {
  try {
    console.log("🌱 Initializing database connection...");
    await AppDataSource.initialize();

    console.log("🌱 Running seeders...");

    // Run seeders in order
    const seeders = [new SeedSeats1733501000000()];

    for (const seeder of seeders) {
      await seeder.run(AppDataSource);
    }

    console.log("✅ All seeders completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error running seeders:", error);
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

runSeeders();
