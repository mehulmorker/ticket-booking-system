import { Injectable, Logger } from "@nestjs/common";
import * as QRCode from "qrcode";

@Injectable()
export class QrGeneratorService {
  private readonly logger = new Logger(QrGeneratorService.name);

  async generateQrCode(data: string): Promise<string> {
    try {
      const qrCodeDataUrl = await QRCode.toDataURL(data, {
        errorCorrectionLevel: "M",
        type: "image/png",
        width: 300,
        margin: 1,
      });

      return qrCodeDataUrl;
    } catch (error) {
      this.logger.error(`Failed to generate QR code: ${error.message}`, error.stack);
      throw error;
    }
  }

  async generateQrCodeString(ticketId: string, reservationId: string): Promise<string> {
    const qrData = JSON.stringify({
      ticketId,
      reservationId,
      timestamp: Date.now(),
    });

    return Buffer.from(qrData).toString("base64");
  }
}

