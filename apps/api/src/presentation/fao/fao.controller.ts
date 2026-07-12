import { Controller, Get, Query } from '@nestjs/common';
import { FaoCropCatalog } from '../../infrastructure/fao/fao-crop-catalog';

@Controller('fao')
export class FaoController {
  constructor(private readonly catalog: FaoCropCatalog) {}
  @Get('crops')
  crops(@Query('q') q?: string) { return this.catalog.search(q ?? ''); }
}
