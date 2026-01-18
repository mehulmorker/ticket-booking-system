import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string | string[];
    if (exception instanceof HttpException) {
      const response = exception.getResponse() as any;
      // Handle validation errors - they come as an array
      if (Array.isArray(response.message)) {
        message = response.message;
      } else {
        message = response.message || exception.message;
      }
    } else {
      message = "Internal server error";
    }

    const responseBody: any = {
      statusCode: status,
      path: request.url,
      message,
      timestamp: new Date().toISOString(),
    };

    // Add validation errors if present
    if (Array.isArray(message) && message.length > 0) {
      responseBody.errors = message;
      // Use first error as main message for backward compatibility
      responseBody.message = message[0];
    }

    response.status(status).json(responseBody);
  }
}
