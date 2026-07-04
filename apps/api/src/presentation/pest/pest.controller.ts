import { Body, Controller, Get, Param, Post, NotFoundException, Inject } from '@nestjs/common';
import { CreatePestUseCase } from '../../application/pest/create-pest.use-case';
import { ListPestsUseCase } from '../../application/pest/list-pests.use-case';
import { PEST_REPOSITORY, PestRepository } from '../../application/pest/pest.repository';
import { toPestDocument } from '../../application/pest/pest-read-model';
import { PestType } from '../../domain/pest/pest-type';

const ACTOR = 'admin';

@Controller('pests')
export class PestController {
  constructor(
    private readonly createPest: CreatePestUseCase,
    private readonly listPests: ListPestsUseCase,
    @Inject(PEST_REPOSITORY) private readonly pests: PestRepository,
  ) {}

  @Post()
  async create(@Body() body: {
    name: Record<string, string>; type: PestType; scientificName?: string;
    symptoms?: Record<string, string>; photos?: string[]; notes?: string;
  }) {
    const snap = await this.createPest.execute({ actor: ACTOR, ...body });
    return toPestDocument(snap);
  }

  @Get()
  async list() {
    return (await this.listPests.execute()).map((p) => toPestDocument(p));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const snap = await this.pests.findById(id);
    if (!snap) throw new NotFoundException(id);
    return toPestDocument(snap);
  }
}
