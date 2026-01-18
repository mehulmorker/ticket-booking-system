import { IsUUID, IsOptional, IsString } from "class-validator";

export class RefundPaymentDto {
  @IsUUID("4")
  paymentId: string;

  @IsOptional()
  @IsString()
  reason?: string;
}
