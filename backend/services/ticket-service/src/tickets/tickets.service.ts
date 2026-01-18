import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Ticket, TicketStatus } from "./entities/ticket.entity";
import { GenerateTicketDto } from "./dto/generate-ticket.dto";
import { PdfGeneratorService } from "./services/pdf-generator.service";
import { QrGeneratorService } from "./services/qr-generator.service";
import { S3Service } from "../storage/s3.service";
import { EventServiceClient } from "../clients/event-client.service";
import { SeatServiceClient } from "../clients/seat-client.service";
import { ReservationServiceClient } from "../clients/reservation-client.service";
import { AuthServiceClient } from "../clients/auth-client.service";
import { SqsService } from "../sqs/sqs.service";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class TicketsService {
  private readonly logger = new Logger(TicketsService.name);
  private readonly apiGatewayUrl: string;

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly pdfGenerator: PdfGeneratorService,
    private readonly qrGenerator: QrGeneratorService,
    private readonly s3Service: S3Service,
    private readonly eventServiceClient: EventServiceClient,
    private readonly seatServiceClient: SeatServiceClient,
    private readonly reservationServiceClient: ReservationServiceClient,
    private readonly authServiceClient: AuthServiceClient,
    private readonly sqsService: SqsService,
    private readonly configService: ConfigService
  ) {
    // Get API Gateway URL from config or use default
    this.apiGatewayUrl =
      this.configService.get<string>("services.apiGatewayUrl") ||
      "http://localhost:3000";
  }

  async generateTicket(
    dto: GenerateTicketDto,
    preFetchedEvent?: any,
    preFetchedSeats?: any[]
  ): Promise<Ticket> {
    const { reservationId, paymentId, userId, eventId, seatIds } = dto;

    const existingTicket = await this.ticketRepository.findOne({
      where: { paymentId },
    });

    if (existingTicket) {
      this.logger.log(
        `Ticket already exists for payment ${paymentId}, returning existing ticket ${existingTicket.id}`
      );
      return existingTicket;
    }

    const ticket = this.ticketRepository.create({
      reservationId,
      paymentId,
      userId,
      eventId,
      seatIds,
      qrCode: "",
      status: "PENDING",
    });

    const savedTicket = await this.ticketRepository.save(ticket);

    // Generate QR code as base64 string for storage and verification
    const qrCodeString = await this.qrGenerator.generateQrCodeString(
      savedTicket.id,
      reservationId
    );

    savedTicket.qrCode = qrCodeString;
    await this.ticketRepository.save(savedTicket);

    try {
      // Use pre-fetched data if available, otherwise fetch
      let seats: any[] = preFetchedSeats || [];
      if (!preFetchedSeats) {
      try {
        seats = await this.seatServiceClient.getSeats(eventId, seatIds);
        this.logger.log(
          `Fetched ${seats.length} seat details for ticket ${savedTicket.id}`
        );
      } catch (error) {
        this.logger.warn(
          `Failed to fetch seat details for PDF: ${error.message}. PDF will show seat IDs.`
          );
        }
      } else {
        this.logger.log(
          `Using pre-fetched ${seats.length} seat details for ticket ${savedTicket.id}`
        );
      }

      // Fetch event details if available
      let event: any = preFetchedEvent || null;
      if (!preFetchedEvent) {
      try {
        event = await this.eventServiceClient.getEvent(eventId);
      } catch (error) {
        this.logger.warn(
          `Failed to fetch event details for PDF: ${error.message}. Continuing without event details.`
          );
        }
      } else {
        this.logger.log(
          `Using pre-fetched event details for ticket ${savedTicket.id}`
        );
      }

      // Generate PDF with details if available, otherwise use basic version
      if (seats.length > 0 || event) {
        await this.generateAndUploadPdfWithDetails(savedTicket, event, seats);
      } else {
        await this.generateAndUploadPdf(savedTicket, seats);
      }

      // Refresh ticket from database to get updated status and PDF URL
      const updatedTicket = await this.ticketRepository.findOne({
        where: { id: savedTicket.id },
      });
      if (updatedTicket) {
        // Send notification to user about ticket being ready (async, non-blocking)
        this.sendTicketReadyNotification(
          updatedTicket,
          event,
          seats,
          reservationId
        ).catch((error) => {
          // Log error but don't fail ticket generation
          this.logger.warn(
            `Failed to send notification for ticket ${updatedTicket.id}: ${error.message}`
          );
        });
        return updatedTicket;
      }
    } catch (error) {
      this.logger.error(
        `Failed to generate PDF for ticket ${savedTicket.id}: ${error.message}`,
        error.stack
      );
      // Return ticket even if PDF generation failed (status will remain PENDING)
    }

    return savedTicket;
  }

  /**
   * Generate ticket with full details fetched from other services
   */
  async generateTicketWithDetails(dto: GenerateTicketDto): Promise<Ticket> {
    const { reservationId, paymentId, userId, eventId, seatIds } = dto;

    // Fetch all required data in parallel
    this.logger.log(
      `Fetching event, reservation, and seat details for ticket generation`
    );

    const [event, reservation, seats] = await Promise.all([
      this.eventServiceClient.getEvent(eventId).catch((error) => {
        this.logger.warn(
          `Failed to fetch event details: ${error.message}. Continuing without event details.`
        );
        return null;
      }),
      this.reservationServiceClient
        .getReservation(reservationId)
        .catch((error) => {
        this.logger.warn(
          `Failed to fetch reservation details: ${error.message}. Continuing without reservation details.`
        );
        return null;
      }),
      this.seatServiceClient.getSeats(eventId, seatIds).catch((error) => {
        this.logger.warn(
          `Failed to fetch seat details: ${error.message}. Continuing without seat details.`
        );
        return [];
      }),
    ]);

    // Generate ticket with pre-fetched data (this will generate and upload PDF once)
    // No need to call generateAndUploadPdfWithDetails again as generateTicket handles it
    // generateTicket will automatically send notification after ticket is generated
    const ticket = await this.generateTicket(dto, event, seats);

    return ticket;
  }

  private async generateAndUploadPdf(
    ticket: Ticket,
    seatDetails?: any[]
  ): Promise<void> {
    try {
      const pdfBuffer = await this.pdfGenerator.generateTicketPdf(
        ticket,
        undefined,
        seatDetails
      );
      const s3Key = await this.s3Service.uploadTicketPdf(pdfBuffer, ticket.id);
      const pdfUrl = await this.s3Service.getSignedUrl(s3Key, 3600 * 24 * 7);

      ticket.s3Key = s3Key;
      ticket.pdfUrl = pdfUrl;
      ticket.status = "GENERATED";

      await this.ticketRepository.save(ticket);
      this.logger.log(`Ticket ${ticket.id} PDF generated and uploaded to S3`);
    } catch (error) {
      this.logger.error(
        `Failed to generate PDF for ticket ${ticket.id}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  private async generateAndUploadPdfWithDetails(
    ticket: Ticket,
    event: any,
    seats: any[]
  ): Promise<void> {
    try {
      // Format event details for PDF
      const eventDetails = event
        ? {
            name: event.title,
            date: event.eventDate,
            venue: event.venue
              ? {
                  name: event.venue.name,
                  address: event.venue.address,
                  city: event.venue.city,
                }
              : null,
          }
        : null;

      // Format seat details for PDF
      const seatDetails = seats.map((seat) => ({
        row: seat.rowLabel || "",
        number: seat.seatNumber,
        section: seat.section || "",
        type: seat.seatType || "",
      }));

      const pdfBuffer = await this.pdfGenerator.generateTicketPdf(
        ticket,
        eventDetails,
        seatDetails
      );
      const s3Key = await this.s3Service.uploadTicketPdf(pdfBuffer, ticket.id);
      const pdfUrl = await this.s3Service.getSignedUrl(s3Key, 3600 * 24 * 7);

      ticket.s3Key = s3Key;
      ticket.pdfUrl = pdfUrl;
      ticket.status = "GENERATED";

      await this.ticketRepository.save(ticket);
      this.logger.log(
        `Ticket ${ticket.id} PDF generated with details and uploaded to S3`
      );
    } catch (error) {
      this.logger.error(
        `Failed to generate PDF with details for ticket ${ticket.id}: ${error.message}`,
        error.stack
      );
      throw error;
    }
  }

  /**
   * Send ticket ready notification to user via SQS
   * @param ticket - The generated ticket
   * @param event - Event details (optional)
   * @param seats - Seat details (optional)
   * @param reservationId - Reservation ID
   *
   * Note: Currently, user email is not available in ticket service.
   * TODO: Either:
   * 1. Add userEmail to GenerateTicketDto and pass it from payment service
   * 2. Add service-to-service endpoint in auth service to fetch user by ID
   * 3. Store user email in reservation or payment entities
   *
   * For now, notification is skipped if email cannot be retrieved.
   */
  private async sendTicketReadyNotification(
    ticket: Ticket,
    event: any,
    seats: any[],
    reservationId: string
  ): Promise<void> {
    try {
      // Attempt to fetch user details to get email
      // Note: Auth service doesn't currently have a public endpoint for this
      const user = await this.authServiceClient.getUserById(ticket.userId);

      if (!user || !user.email) {
        this.logger.warn(
          `Cannot send notification for ticket ${ticket.id}: user email not available for userId ${ticket.userId}. ` +
            `Notification skipped. Consider adding userEmail to GenerateTicketDto.`
        );
        return;
      }

      // Format seat numbers for display
      const seatNumbers =
        seats && seats.length > 0
          ? seats
              .map((s) => `${s.rowLabel || ""}${s.seatNumber || ""}`)
              .filter((s) => s)
              .join(", ")
          : ticket.seatIds.join(", ");

      // Format event details
      const eventName = event?.title || event?.name || "Event";
      const eventDate = event?.eventDate
        ? new Date(event.eventDate).toLocaleDateString()
        : "TBD";
      const venueName = event?.venue?.name || event?.venueName || "Venue TBD";

      // Construct ticket download URL
      const ticketDownloadUrl = `${this.apiGatewayUrl}/api/tickets/${ticket.id}/download`;

      // Format user name
      const userName =
        user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.firstName || user.email.split("@")[0] || "User";

      // Prepare notification message
      // Format matches notification consumer service expectations
      const notificationMessage = {
        type: "NOTIFICATION",
        userId: ticket.userId,
        notificationType: "EMAIL",
        event: "TICKET_READY",
        recipient: user.email,
        data: {
          userName,
          eventName,
          eventDate,
          venueName,
          seatNumbers,
          ticketDownloadUrl,
          reservationId,
          ticketId: ticket.id,
        },
      };

      await this.sqsService.sendNotificationMessage(notificationMessage);
      this.logger.log(
        `Sent ticket ready notification for ticket ${ticket.id} to ${user.email}`
      );
    } catch (error) {
      // Don't fail ticket generation if notification fails
      this.logger.warn(
        `Failed to send ticket ready notification for ticket ${ticket.id}: ${error.message}`
      );
    }
  }

  async findOne(id: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException(`Ticket with ID ${id} not found`);
    }
    return ticket;
  }

  async findByReservation(reservationId: string): Promise<Ticket[]> {
    return this.ticketRepository.find({
      where: { reservationId },
      order: { createdAt: "DESC" },
    });
  }

  async findByUser(userId: string): Promise<Ticket[]> {
    return this.ticketRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });
  }

  async getDownloadUrl(id: string): Promise<string> {
    const ticket = await this.findOne(id);

    if (!ticket.s3Key) {
      // If ticket status is PENDING, try to regenerate PDF
      if (ticket.status === "PENDING") {
        this.logger.log(
          `Ticket ${id} is PENDING and has no s3Key. Attempting to regenerate PDF...`
        );
        try {
          // Try to regenerate the ticket with full details
          const regeneratedTicket = await this.generateTicketWithDetails({
            reservationId: ticket.reservationId,
            paymentId: ticket.paymentId,
            userId: ticket.userId,
            eventId: ticket.eventId,
            seatIds: ticket.seatIds,
          });

          if (regeneratedTicket.s3Key) {
            const url = await this.s3Service.getSignedUrl(
              regeneratedTicket.s3Key,
              3600
            );
            return url;
          }
        } catch (error) {
          this.logger.error(
            `Failed to regenerate PDF for ticket ${id}: ${error.message}`
          );
        }
      }

      throw new BadRequestException(
        "Ticket PDF not available. PDF may not have been generated yet."
      );
    }

    // Check if file actually exists in S3 before generating presigned URL
    const fileExists = await this.s3Service.fileExists(ticket.s3Key);
    if (!fileExists) {
      this.logger.warn(
        `PDF file does not exist in S3 for ticket ${id}, s3Key: ${ticket.s3Key}. Status: ${ticket.status}`
      );

      // If ticket status is PENDING or GENERATED but file doesn't exist, try to regenerate
      if (ticket.status === "PENDING" || ticket.status === "GENERATED") {
        this.logger.log(
          `Attempting to regenerate PDF for ticket ${id} as file is missing...`
        );
        try {
          const regeneratedTicket = await this.generateTicketWithDetails({
            reservationId: ticket.reservationId,
            paymentId: ticket.paymentId,
            userId: ticket.userId,
            eventId: ticket.eventId,
            seatIds: ticket.seatIds,
          });

          if (regeneratedTicket.s3Key) {
            // Verify the new file exists
            const newFileExists = await this.s3Service.fileExists(
              regeneratedTicket.s3Key
            );
            if (newFileExists) {
              const url = await this.s3Service.getSignedUrl(
                regeneratedTicket.s3Key,
                3600
              );
              this.logger.log(
                `Successfully regenerated and retrieved PDF for ticket ${id}`
              );
              return url;
            }
          }
        } catch (error) {
          this.logger.error(
            `Failed to regenerate PDF for ticket ${id}: ${error.message}`
          );
        }
      }

      throw new BadRequestException(
        "Ticket PDF file not found in storage. The PDF may have been deleted or never generated. Please contact support."
      );
    }

    // File exists, generate fresh presigned URL
    try {
    const url = await this.s3Service.getSignedUrl(ticket.s3Key, 3600);
    return url;
    } catch (error) {
      this.logger.error(
        `Failed to generate presigned URL for ticket ${id}, s3Key: ${ticket.s3Key}: ${error.message}`
      );
      throw new BadRequestException(
        "Failed to generate download URL. Please try again later."
      );
    }
  }

  async verifyTicket(qrCode: string, verifiedBy?: string): Promise<Ticket> {
    const ticket = await this.ticketRepository.findOne({
      where: { qrCode },
    });

    if (!ticket) {
      throw new NotFoundException("Invalid ticket QR code");
    }

    if (ticket.status === "CANCELLED") {
      throw new BadRequestException("Ticket has been cancelled");
    }

    if (ticket.status === "VERIFIED") {
      this.logger.log(`Ticket ${ticket.id} already verified`);
      return ticket;
    }

    ticket.status = "VERIFIED";
    ticket.verifiedAt = new Date();
    if (verifiedBy) {
      ticket.verifiedBy = verifiedBy;
    }

    const updated = await this.ticketRepository.save(ticket);
    this.logger.log(`Ticket ${ticket.id} verified`);

    return updated;
  }

  async cancelTicket(id: string): Promise<Ticket> {
    const ticket = await this.findOne(id);

    if (ticket.status === "CANCELLED") {
      return ticket;
    }

    if (ticket.status === "VERIFIED") {
      throw new BadRequestException("Cannot cancel a verified ticket");
    }

    ticket.status = "CANCELLED";
    const updated = await this.ticketRepository.save(ticket);
    this.logger.log(`Ticket ${ticket.id} cancelled`);

    return updated;
  }

  /**
   * Delete ticket (compensation for saga)
   * Removes ticket from database and deletes PDF from S3
   */
  async deleteTicketCompensation(id: string): Promise<void> {
    this.logger.log(`Deleting ticket ${id} (compensation)`);

    const ticket = await this.ticketRepository.findOne({
      where: { id },
    });

    if (!ticket) {
      this.logger.log(`Ticket ${id} not found, nothing to delete`);
      return;
    }

    // Delete PDF from S3 if it exists
    if (ticket.s3Key) {
      try {
        await this.s3Service.deleteTicketPdf(ticket.s3Key);
        this.logger.log(`Deleted PDF from S3 for ticket ${id}`);
      } catch (error) {
        this.logger.warn(
          `Failed to delete PDF from S3 for ticket ${id}: ${error.message}`
        );
        // Continue with database deletion even if S3 deletion fails
      }
    }

    // Delete ticket from database
    await this.ticketRepository.remove(ticket);

    this.logger.log(`Ticket ${id} deleted successfully (compensation)`);
  }
}
