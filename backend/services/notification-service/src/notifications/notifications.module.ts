import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { Notification } from "./entities/notification.entity";
import { TemplateService } from "./services/template.service";
import { NotificationConsumerService } from "./services/notification-consumer.service";
import { SesModule } from "../ses/ses.module";
import { SnsModule } from "../sns/sns.module";
import { SqsModule } from "../sqs/sqs.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    SesModule,
    SnsModule,
    SqsModule,
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    TemplateService,
    NotificationConsumerService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}

