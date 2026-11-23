import { Controller, Get } from '@nestjs/common';

/** Publiczny endpoint do pingowania (żeby darmowy Render nie usypiał). */
@Controller('health')
export class HealthController {
  @Get()
  health() {
    return { ok: true };
  }
}
