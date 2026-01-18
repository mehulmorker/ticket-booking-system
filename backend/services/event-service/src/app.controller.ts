import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'event-service',
      timestamp: new Date().toISOString(),
    };
  }
}
