import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Payment } from "./payments/entities/payment.entity";
import { SagaExecution } from "./saga/entities/saga-execution.entity";
import { SagaStep } from "./saga/entities/saga-step.entity";
import { PaymentsModule } from "./payments/payments.module";
import { SqsModule } from "./sqs/sqs.module";
import { SagaModule } from "./saga/saga.module";
import { AppController } from "./app.controller";
import databaseConfig from "./config/database.config";
import sqsConfig from "./config/sqs.config";
import servicesConfig from "./config/services.config";
import jwtConfig from "./config/jwt.config";
import sagaConfig from "./config/saga.config";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, sqsConfig, servicesConfig, jwtConfig, sagaConfig],
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
        entities: [Payment, SagaExecution, SagaStep],
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
    SagaModule,
    PaymentsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
