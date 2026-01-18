import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { AppController } from "./app.controller";
import databaseConfig from "./config/database.config";
import jwtConfig from "./config/jwt.config";

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: "postgres" as const,
        host: configService.get<string>("database.host"),
        port: configService.get<number>("database.port"),
        username: configService.get<string>("database.username"),
        password: configService.get<string>("database.password"),
        database: configService.get<string>("database.database"),
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
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
      inject: [ConfigService],
    }),
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}
