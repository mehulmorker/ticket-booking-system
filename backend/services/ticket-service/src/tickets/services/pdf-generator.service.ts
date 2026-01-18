import { Injectable, Logger } from "@nestjs/common";
import PDFDocument from "pdfkit";
import { Ticket } from "../entities/ticket.entity";
import { QrGeneratorService } from "./qr-generator.service";

@Injectable()
export class PdfGeneratorService {
  private readonly logger = new Logger(PdfGeneratorService.name);

  constructor(private readonly qrGenerator: QrGeneratorService) {}

  async generateTicketPdf(
    ticket: Ticket,
    eventDetails?: any,
    seatDetails?: any[]
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: "A4",
          margin: 50,
        });

        const buffers: Buffer[] = [];

        doc.on("data", (chunk) => buffers.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(buffers)));
        doc.on("error", (error) => reject(error));

        await this.addTicketContent(doc, ticket, eventDetails, seatDetails);

        doc.end();
      } catch (error) {
        this.logger.error(`Failed to generate PDF for ticket ${ticket.id}: ${error.message}`, error.stack);
        reject(error);
      }
    });
  }

  private async addTicketContent(
    doc: typeof PDFDocument.prototype,
    ticket: Ticket,
    eventDetails?: any,
    seatDetails?: any[]
  ): Promise<void> {
    doc
      .fontSize(24)
      .text("TICKET", { align: "center" })
      .moveDown(2);

    doc
      .fontSize(16)
      .text(`Ticket ID: ${ticket.id}`, { align: "left" })
      .moveDown(0.5);

    if (eventDetails) {
      doc
        .fontSize(18)
        .text(eventDetails.name || "Event", { align: "center" })
        .moveDown(0.5);

      if (eventDetails.venue) {
        doc
          .fontSize(12)
          .text(`Venue: ${eventDetails.venue.name || "N/A"}`, { align: "left" })
          .moveDown(0.5);
      }

      if (eventDetails.date) {
        doc
          .fontSize(12)
          .text(`Date: ${new Date(eventDetails.date).toLocaleString()}`, {
            align: "left",
          })
          .moveDown(0.5);
      }
    }

    doc.moveDown(1);

    doc
      .fontSize(14)
      .text(`Reservation ID: ${ticket.reservationId}`, { align: "left" })
      .moveDown(0.5);

    // Display seats in a readable format
    if (seatDetails && seatDetails.length > 0) {
      const seatDescriptions = seatDetails.map((seat) => {
        const parts: string[] = [];
        if (seat.section) parts.push(seat.section);
        if (seat.row) parts.push(`Row ${seat.row}`);
        if (seat.number) parts.push(`Seat ${seat.number}`);
        if (seat.type) parts.push(`(${seat.type})`);
        return parts.join(", ") || `Seat ${seat.id}`;
      });
      doc.text(`Seats: ${seatDescriptions.join("; ")}`, { align: "left" });
    } else {
      // Fallback to UUIDs if seat details not available
      doc.text(`Seats: ${ticket.seatIds.join(", ")}`, { align: "left" });
    }

    doc
      .moveDown(0.5)
      .text(`Status: ${ticket.status}`, { align: "left" })
      .moveDown(2);

    // Generate and embed QR code image
    try {
      doc.fontSize(12).text("QR Code:", { align: "left" });
      
      // Generate QR code image from the stored QR code string
      const qrCodeDataUrl = await this.qrGenerator.generateQrCode(ticket.qrCode);
      
      // Extract base64 data from data URL
      const base64Data = qrCodeDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const qrCodeBuffer = Buffer.from(base64Data, "base64");
      
      // Embed QR code image in PDF (centered, 150x150 size)
      const qrSize = 150;
      const pageWidth = doc.page.width;
      const qrX = (pageWidth - qrSize) / 2;
      const qrY = doc.y + 10; // Add some spacing after "QR Code:" text
      
      doc.image(qrCodeBuffer, qrX, qrY, {
        width: qrSize,
        height: qrSize,
      });
      
      // Move cursor below the QR code
      doc.y = qrY + qrSize + 20;
    } catch (error) {
      this.logger.warn(
        `Failed to generate QR code image for PDF: ${error.message}. Using text fallback.`
      );
      // Fallback to text if QR code image generation fails
      doc
        .moveDown(0.5)
        .fontSize(10)
        .text(`QR Code: ${ticket.qrCode}`, { align: "left" })
        .moveDown(2);
    }

    doc
      .fontSize(10)
      .text(`Generated on: ${ticket.createdAt.toLocaleString()}`, {
        align: "center",
      })
      .moveDown(1)
      .text("This is your official ticket. Please present it at the venue.", {
        align: "center",
      });
  }
}

