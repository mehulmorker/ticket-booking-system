import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Notification } from "./notifications/entities/notification.entity";
import { NotificationsModule } from "./notifications/notifications.module";
import { SqsModule } from "./sqs/sqs.module";
import { AppController } from "./app.controller";
import databaseConfig from "./config/database.config";
import sesConfig from "./config/ses.config";
import snsConfig from "./config/sns.config";
import sqsConfig from "./config/sqs.config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, sesConfig, snsConfig, sqsConfig],
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
        entities: [Notification],
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
    NotificationsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
