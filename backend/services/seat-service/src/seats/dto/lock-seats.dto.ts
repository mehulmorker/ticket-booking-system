import {
  ArrayMinSize,
  IsArray,
  IsString,
  IsUUID,
  IsOptional,
  IsInt,
  Min,
} from "class-validator";

export class LockSeatsDto {
  @IsUUID("4")
  eventId: string;

  @IsString()
  ownerId: string; // reservationId or userId

  @IsArray()
  @ArrayMinSize(1)
  seats: string[]; // list of seat ids

  @IsOptional()
  @IsInt()
  @Min(60) // Minimum 60 seconds
  ttlSeconds?: number; // Optional TTL in seconds (default 300 = 5 minutes in service)
}
