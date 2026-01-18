import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Notification,
  NotificationStatus,
} from "./entities/notification.entity";
import { SendNotificationDto } from "./dto/send-notification.dto";
import { SesService } from "../ses/ses.service";
import { SnsService } from "../sns/sns.service";
import { TemplateService } from "./services/template.service";

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    private readonly sesService: SesService,
    private readonly snsService: SnsService,
    private readonly templateService: TemplateService
  ) {}

  async sendNotification(dto: SendNotificationDto): Promise<Notification> {
    const { userId, type, event, recipient, data = {} } = dto;

    // Render template first to get subject and body before saving to database
    let rendered;
    try {
      rendered = this.templateService.renderTemplate(event, {
        userName: data.userName || "User",
        ...data,
      });
    } catch (error) {
      this.logger.error(
        `Failed to render template for event ${event}: ${error.message}`,
        error.stack
      );
      // Use fallback subject and body if template rendering fails
      rendered = {
        subject: `Notification: ${event}`,
        body: JSON.stringify(data, null, 2),
      };
    }

    // Create notification with subject and body already set
    const notification = this.notificationRepository.create({
      userId,
      type,
      event,
      recipient,
      subject: rendered.subject,
      body: rendered.body,
      status: "PENDING",
      metadata: data,
    });

    const saved = await this.notificationRepository.save(notification);

    try {
      if (type === "EMAIL") {
        const messageId = await this.sesService.sendEmail(
          recipient,
          rendered.subject,
          rendered.body
        );
        saved.externalId = messageId;
        saved.status = "SENT";
        saved.sentAt = new Date();
      } else if (type === "SMS") {
        const messageId = await this.snsService.sendSms(
          recipient,
          rendered.body
        );
        saved.externalId = messageId;
        saved.status = "SENT";
        saved.sentAt = new Date();
      }

      const updated = await this.notificationRepository.save(saved);
      this.logger.log(
        `Notification ${updated.id} sent via ${type} to ${recipient}`
      );

      return updated;
    } catch (error) {
      saved.status = "FAILED";
      saved.failureReason = error.message;
      await this.notificationRepository.save(saved);
      this.logger.error(
        `Failed to send notification ${saved.id}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  async findOne(id: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id },
    });
    if (!notification) {
      throw new NotFoundException(`Notification with ID ${id} not found`);
    }
    return notification;
  }

  async findByUser(userId: string): Promise<Notification[]> {
    return this.notificationRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  }

  async getStatus(
    id: string
  ): Promise<{ status: NotificationStatus; details: Notification }> {
    const notification = await this.findOne(id);
    return {
      status: notification.status,
      details: notification,
    };
  }
}
