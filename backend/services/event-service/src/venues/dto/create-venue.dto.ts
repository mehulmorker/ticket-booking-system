import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class CreateVenueDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  city?: string;

  @IsString()
  @IsOptional()
  state?: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsOptional()
  zipCode?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  capacity?: number;

  @IsOptional()
  layoutConfig?: Record<string, any>;
}
