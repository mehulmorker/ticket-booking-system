import { DataSource } from "typeorm";
import { config } from "dotenv";
import * as path from "path";

// Load environment variables
config();

// Detect if using AWS RDS
const host = process.env.DB_HOST || "localhost";
const isRDS = host.includes(".rds.amazonaws.com") || host.includes(".rds.");

export const AppDataSource = new DataSource({
  type: "postgres",
  host,
  port: parseInt(process.env.DB_PORT || "5432", 10),
  username: process.env.DB_USERNAME || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_DATABASE || "notification_db",
  entities: [path.join(__dirname, "../**/*.entity{.ts,.js}")],
  migrations: [path.join(__dirname, "../migrations/*{.ts,.js}")],
  synchronize: false,
  logging: process.env.DB_LOGGING === "true" || false,
  migrationsTableName: "migrations",
  // SSL configuration for AWS RDS (RDS requires SSL but uses self-signed certificates)
  extra: isRDS
    ? {
        ssl: {
          rejectUnauthorized: false, // RDS uses self-signed certificates
        },
      }
    : undefined,
});
