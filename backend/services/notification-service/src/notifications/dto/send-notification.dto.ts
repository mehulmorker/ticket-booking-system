import { IsEnum, IsString, IsUUID, IsOptional, IsObject } from "class-validator";
import { NotificationType, NotificationEvent } from "../entities/notification.entity";

export class SendNotificationDto {
  @IsUUID("4")
  userId: string;

  @IsEnum(["EMAIL", "SMS"])
  type: NotificationType;

  @IsEnum([
    "BOOKING_CONFIRMED",
    "PAYMENT_RECEIPT",
    "TICKET_READY",
    "BOOKING_REMINDER",
    "CANCELLATION",
  ])
  event: NotificationEvent;

  @IsString()
  recipient: string;

  @IsOptional()
  @IsObject()
  data?: Record<string, any>;
}

