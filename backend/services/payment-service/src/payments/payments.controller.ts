import { Body, Controller, Get, Param, Post, Put, Request, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PaymentsService } from "./payments.service";
import { InitiatePaymentDto } from "./dto/initiate-payment.dto";
import { ConfirmPaymentDto } from "./dto/confirm-payment.dto";
import { RefundPaymentDto } from "./dto/refund-payment.dto";

@Controller("payments")
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly jwtService: JwtService
  ) {}

  @Post("initiate")
  initiate(@Request() req: any, @Body() dto: InitiatePaymentDto) {
    // Extract userId from JWT token
    let userId: string;
    
    if (req.user?.sub || req.user?.id) {
      // If user is already set (from guard)
      userId = req.user.sub || req.user.id;
    } else {
      // Extract from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        throw new UnauthorizedException("Missing or invalid authorization token");
      }
      
      try {
        const token = authHeader.substring(7); // Remove "Bearer "
        const payload = this.jwtService.decode(token) as any;
        if (!payload || !payload.sub) {
          throw new UnauthorizedException("Invalid token payload");
        }
        userId = payload.sub;
      } catch (error) {
        throw new UnauthorizedException("Failed to decode token");
      }
    }
    
    return this.paymentsService.initiate(userId, dto);
  }

  @Post("confirm")
  confirm(@Body() dto: ConfirmPaymentDto) {
    return this.paymentsService.confirm(dto);
  }

  @Post("process/:id")
  processPayment(@Param("id") id: string) {
    return this.paymentsService.processPayment(id);
  }

  @Post("refund")
  refund(@Body() dto: RefundPaymentDto) {
    return this.paymentsService.refund(dto);
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.paymentsService.findOne(id);
  }

  @Get("reservation/:reservationId")
  findByReservation(@Param("reservationId") reservationId: string) {
    return this.paymentsService.findByReservation(reservationId);
  }
}
