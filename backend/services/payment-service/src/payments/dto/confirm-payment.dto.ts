import { IsString, IsUUID, IsOptional, ValidateIf } from "class-validator";

export class ConfirmPaymentDto {
  @IsUUID("4")
  paymentId: string;

  @IsString()
  transactionId: string;

  @IsOptional()
  @ValidateIf((o) => o.paymentDetails !== undefined)
  @IsString()
  paymentDetails?: string;
}
