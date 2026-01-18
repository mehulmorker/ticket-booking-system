import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Seat } from "./seats/entities/seat.entity";
import { SeatsModule } from "./seats/seats.module";
import { RedisModule } from "./redis/redis.module";
import { SchedulerModule } from "./scheduler/scheduler.module";
import databaseConfig from "./config/database.config";
import redisConfig from "./config/redis.config";
import schedulerConfig from "./config/scheduler.config";
import { AppController } from "./app.controller";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, redisConfig, schedulerConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres" as const,
        host: configService.get<string>("database.host"),
        port: configService.get<number>("database.port"),
        username: configService.get<string>("database.username"),
        password: configService.get<string>("database.password"),
        database: configService.get<string>("database.database"),
        entities: [Seat],
        synchronize:
          configService.get<boolean>("database.synchronize") || false,
        logging: configService.get<boolean>("database.logging") || false,
        migrations: configService.get<string[]>("database.migrations") || [],
        migrationsRun:
          configService.get<boolean>("database.migrationsRun") || false,
        migrationsTableName:
          configService.get<string>("database.migrationsTableName") ||
          "migrations",
        extra: configService.get("database.extra"), // SSL configuration for RDS
      }),
    }),
    RedisModule,
    SeatsModule,
    SchedulerModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
