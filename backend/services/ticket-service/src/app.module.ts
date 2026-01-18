import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { Ticket } from "./tickets/entities/ticket.entity";
import { TicketsModule } from "./tickets/tickets.module";
import { SqsModule } from "./sqs/sqs.module";
import { AppController } from "./app.controller";
import databaseConfig from "./config/database.config";
import s3Config from "./config/s3.config";
import sqsConfig from "./config/sqs.config";
import servicesConfig from "./config/services.config";
import jwtConfig from "./config/jwt.config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, s3Config, sqsConfig, servicesConfig, jwtConfig],
    }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("jwt.secret"),
      }),
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
        entities: [Ticket],
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
    SqsModule,
    TicketsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
