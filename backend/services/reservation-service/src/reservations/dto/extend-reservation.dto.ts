import { IsInt, IsUUID, Min } from 'class-validator';

export class ExtendReservationDto {
  @IsUUID('4')
  reservationId: string;

  @IsInt()
  @Min(60)
  additionalMinutes: number;
}
