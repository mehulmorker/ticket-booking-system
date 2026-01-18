import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export class CreateReservationDto {
  @IsUUID("4")
  eventId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  seatIds: string[];

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
