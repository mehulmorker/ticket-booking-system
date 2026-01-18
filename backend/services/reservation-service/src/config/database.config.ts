import { registerAs } from "@nestjs/config";

export default registerAs("database", () => {
  const host = process.env.DB_HOST || "localhost";
  const isRDS = host.includes(".rds.amazonaws.com") || host.includes(".rds.");

  return {
    type: "postgres",
    host,
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    database: process.env.DB_DATABASE || "reservation_db",
    entities: [__dirname + "/../**/*.entity{.ts,.js}"],
    synchronize: process.env.DB_SYNCHRONIZE === "true" || false,
    logging: process.env.DB_LOGGING === "true" || false,
    migrations: [__dirname + "/../migrations/*{.ts,.js}"],
    migrationsRun: false,
    migrationsTableName: "migrations",
    // SSL configuration for AWS RDS (RDS requires SSL but uses self-signed certificates)
    extra: isRDS
      ? {
          ssl: {
            rejectUnauthorized: false, // RDS uses self-signed certificates
          },
        }
      : undefined,
  };
});
