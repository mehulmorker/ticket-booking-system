import { Controller, Get, Post, Param, Body } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { SendNotificationDto } from "./dto/send-notification.dto";

@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post("send")
  async send(@Body() dto: SendNotificationDto) {
    return this.notificationsService.sendNotification(dto);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.notificationsService.findOne(id);
  }

  @Get(":id/status")
  async getStatus(@Param("id") id: string) {
    return this.notificationsService.getStatus(id);
  }

  @Get("user/:userId")
  async findByUser(@Param("userId") userId: string) {
    return this.notificationsService.findByUser(userId);
  }
}

