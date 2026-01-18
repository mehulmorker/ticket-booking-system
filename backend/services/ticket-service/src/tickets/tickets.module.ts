import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TicketsController } from "./tickets.controller";
import { TicketsService } from "./tickets.service";
import { Ticket } from "./entities/ticket.entity";
import { PdfGeneratorService } from "./services/pdf-generator.service";
import { QrGeneratorService } from "./services/qr-generator.service";
import { TicketConsumerService } from "./services/ticket-consumer.service";
import { StorageModule } from "../storage/storage.module";
import { SqsModule } from "../sqs/sqs.module";
import { ClientsModule } from "../clients/clients.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket]),
    StorageModule,
    SqsModule,
    ClientsModule,
  ],
  controllers: [TicketsController],
  providers: [
    TicketsService,
    PdfGeneratorService,
    QrGeneratorService,
    TicketConsumerService,
  ],
  exports: [TicketsService],
})
export class TicketsModule {}

