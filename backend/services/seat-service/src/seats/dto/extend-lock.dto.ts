import { ArrayMinSize, IsArray, IsString, IsUUID, IsOptional, IsInt, Min } from 'class-validator';

export class ExtendLockDto {
  @IsUUID('4')
  eventId: string;

  @IsString()
  ownerId: string;

  @IsArray()
  @ArrayMinSize(1)
  seats: string[]; // list of seat ids

  @IsOptional()
  @IsInt()
  @Min(60)
  ttlSeconds?: number; // optional custom TTL
}
