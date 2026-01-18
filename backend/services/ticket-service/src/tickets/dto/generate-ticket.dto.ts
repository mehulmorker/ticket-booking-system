import { IsUUID } from "class-validator";

export class GenerateTicketDto {
  @IsUUID("4")
  reservationId: string;

  @IsUUID("4")
  paymentId: string;

  @IsUUID("4")
  userId: string;

  @IsUUID("4")
  eventId: string;

  @IsUUID("4", { each: true })
  seatIds: string[];
}

