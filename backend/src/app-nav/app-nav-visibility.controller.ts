import { Body, Controller, Get, Put } from '@nestjs/common';
import { AppNavVisibilityService } from './app-nav-visibility.service';
import { UpdateNavDomainsVisibilityDto } from './dto/update-nav-domains-visibility.dto';

@Controller('app/nav-domains-visibility')
export class AppNavVisibilityController {
  constructor(private readonly svc: AppNavVisibilityService) {}

  @Get()
  get() {
    return this.svc.get();
  }

  @Put()
  put(@Body() dto: UpdateNavDomainsVisibilityDto) {
    return this.svc.set(dto.domains as Record<string, unknown>);
  }
}
