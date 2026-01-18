import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

export enum PaymentMethodEnum {
  CARD = "CARD",
  PAYPAL = "PAYPAL",
  BANK_TRANSFER = "BANK_TRANSFER",
}

export class InitiatePaymentDto {
  @IsUUID("4")
  reservationId: string;

  @IsEnum(PaymentMethodEnum)
  paymentMethod: PaymentMethodEnum;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsUUID("4")
  eventId: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
