import { IsUUID, IsArray, ArrayMinSize, IsString } from "class-validator";

export class ReleaseSeatsCompensationDto {
  @IsUUID("4")
  eventId: string;

  @IsString()
  ownerId: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  seatIds: string[];
}

