import { ArrayMinSize, IsArray, IsString, IsUUID } from 'class-validator';

export class ReleaseSeatsDto {
  @IsUUID('4')
  eventId: string;

  @IsString()
  ownerId: string;

  @IsArray()
  @ArrayMinSize(1)
  seats: string[]; // list of seat ids
}
