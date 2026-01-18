import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Logger,
} from "@nestjs/common";
import { TicketsService } from "./tickets.service";
import { GenerateTicketDto } from "./dto/generate-ticket.dto";

@Controller("tickets")
export class TicketsController {
  private readonly logger = new Logger(TicketsController.name);

  constructor(private readonly ticketsService: TicketsService) {}

  @Post("generate")
  async generate(@Body() dto: GenerateTicketDto) {
    this.logger.log(`Generating ticket for reservation ${dto.reservationId}`);
    return this.ticketsService.generateTicket(dto);
  }

  @Get(":id")
  async findOne(@Param("id") id: string) {
    return this.ticketsService.findOne(id);
  }

  @Get("reservation/:reservationId")
  async findByReservation(@Param("reservationId") reservationId: string) {
    return this.ticketsService.findByReservation(reservationId);
  }

  @Get("user/:userId")
  async findByUser(@Param("userId") userId: string) {
    return this.ticketsService.findByUser(userId);
  }

  @Get(":id/download")
  async getDownloadUrl(@Param("id") id: string) {
    const url = await this.ticketsService.getDownloadUrl(id);
    return { downloadUrl: url };
  }

  @Get("verify/:qrCode")
  async verifyTicket(
    @Param("qrCode") qrCode: string,
    @Query("verifiedBy") verifiedBy?: string
  ) {
    return this.ticketsService.verifyTicket(qrCode, verifiedBy);
  }

  @Delete(":id/compensate")
  async compensate(@Param("id") id: string) {
    this.logger.log(`Compensating (deleting) ticket ${id}`);
    return this.ticketsService.deleteTicketCompensation(id);
  }
}
