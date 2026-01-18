import { Injectable, Logger } from "@nestjs/common";
import * as Handlebars from "handlebars";
import { NotificationEvent } from "../entities/notification.entity";

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  private readonly templates: Record<NotificationEvent, { subject: string; body: string }> = {
    BOOKING_CONFIRMED: {
      subject: "Booking Confirmed - {{eventName}}",
      body: `Hello {{userName}},

Your booking for {{eventName}} has been confirmed!

Event Details:
- Date: {{eventDate}}
- Venue: {{venueName}}
- Seats: {{seatNumbers}}
- Reservation ID: {{reservationId}}

Thank you for your booking!`,
    },
    PAYMENT_RECEIPT: {
      subject: "Payment Receipt - {{eventName}}",
      body: "Hello {{userName}},\n\nYour payment has been processed successfully.\n\nPayment Details:\n- Amount: ${{amount}}\n- Transaction ID: {{transactionId}}\n- Payment Method: {{paymentMethod}}\n- Date: {{paymentDate}}\n\nThank you for your purchase!",
    },
    TICKET_READY: {
      subject: "Your Tickets Are Ready - {{eventName}}",
      body: `Hello {{userName}},

Your tickets for {{eventName}} are ready!

You can download your tickets using the link below:
{{ticketDownloadUrl}}

Event Details:
- Date: {{eventDate}}
- Venue: {{venueName}}
- Seats: {{seatNumbers}}

See you at the event!`,
    },
    BOOKING_REMINDER: {
      subject: "Reminder: {{eventName}} Tomorrow",
      body: `Hello {{userName}},

This is a reminder that your event {{eventName}} is tomorrow!

Event Details:
- Date: {{eventDate}}
- Time: {{eventTime}}
- Venue: {{venueName}}
- Seats: {{seatNumbers}}

Don't forget to bring your tickets!`,
    },
    CANCELLATION: {
      subject: "Booking Cancelled - {{eventName}}",
      body: "Hello {{userName}},\n\nYour booking for {{eventName}} has been cancelled.\n\nRefund Details:\n- Amount: ${{refundAmount}}\n- Refund ID: {{refundId}}\n- Expected processing time: 5-7 business days\n\nIf you have any questions, please contact support.",
    },
  };

  renderTemplate(
    event: NotificationEvent,
    data: Record<string, any>
  ): { subject: string; body: string } {
    const template = this.templates[event];
    if (!template) {
      this.logger.warn(`Template not found for event: ${event}`);
      return {
        subject: "Notification",
        body: JSON.stringify(data),
      };
    }

    try {
      const subjectTemplate = Handlebars.compile(template.subject);
      const bodyTemplate = Handlebars.compile(template.body);

      return {
        subject: subjectTemplate(data),
        body: bodyTemplate(data),
      };
    } catch (error) {
      this.logger.error(`Failed to render template for ${event}: ${error.message}`, error.stack);
      return {
        subject: template.subject,
        body: template.body,
      };
    }
  }
}

