import { IsUUID } from "class-validator";

export class CancelReservationDto {
  @IsUUID("4")
  reservationId: string;
}

