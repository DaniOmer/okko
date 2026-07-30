import { Body, Controller, Get, Param, Post, Patch, Delete, HttpCode, NotFoundException, ConflictException, Inject, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles, CurrentUser, AuthUser } from '../auth/decorators';
import { CreatePestUseCase } from '../../application/pest/create-pest.use-case';
import { ListPestsUseCase } from '../../application/pest/list-pests.use-case';
import { UpdatePestUseCase, PestNotFoundError } from '../../application/pest/update-pest.use-case';
import { DeletePestUseCase, PestInUseError } from '../../application/pest/delete-pest.use-case';
import { SetPestBiologyUseCase } from '../../application/pest/set-pest-biology.use-case';
import { SetPestDamageUseCase } from '../../application/pest/set-pest-damage.use-case';
import { SetPestDistributionUseCase } from '../../application/pest/set-pest-distribution.use-case';
import { SetPestManagementUseCase } from '../../application/pest/set-pest-management.use-case';
import { SetPestSourcesUseCase } from '../../application/pest/set-pest-sources.use-case';
import { SetPestWeedUseCase } from '../../application/pest/set-pest-weed.use-case';
import { SetPestDiseaseUseCase } from '../../application/pest/set-pest-disease.use-case';
import { MinMaxRangeJSON } from '../../domain/shared/min-max-range';
import { PEST_REPOSITORY, PestRepository } from '../../application/pest/pest.repository';
import { toPestDocument } from '../../application/pest/pest-read-model';
import { PestType } from '../../domain/pest/pest-type';
import { PestKind } from '../../domain/pest/pest-kind';
import { STORAGE_PORT, StoragePort } from '../../application/media/storage.port';
import { toImageDto } from '../media/image-dto';
import { PestSnapshot, BiologySnapshot, ApprovedProductJSON, SourceJSON } from '../../domain/pest/pest';

@UseGuards(AuthGuard, RolesGuard)
@Roles('superadmin')
@Controller('pests')
export class PestController {
  constructor(
    private readonly createPest: CreatePestUseCase,
    private readonly listPests: ListPestsUseCase,
    private readonly updatePest: UpdatePestUseCase,
    private readonly deletePest: DeletePestUseCase,
    private readonly setPestBiology: SetPestBiologyUseCase,
    private readonly setPestDamage: SetPestDamageUseCase,
    private readonly setPestDistribution: SetPestDistributionUseCase,
    private readonly setPestManagement: SetPestManagementUseCase,
    private readonly setPestSources: SetPestSourcesUseCase,
    private readonly setPestWeed: SetPestWeedUseCase,
    private readonly setPestDisease: SetPestDiseaseUseCase,
    @Inject(PEST_REPOSITORY) private readonly pests: PestRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
  ) {}

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: {
    name: Record<string, string>; type: PestType; kind?: PestKind; scientificName?: string;
    family?: string; description?: Record<string, string>;
    symptoms?: Record<string, string>; images?: { key: string; caption?: string; category?: string }[]; notes?: string;
  }) {
    const snap = await this.createPest.execute({ actor: user.email, ...body });
    return this.toResponse(snap);
  }

  @Get()
  async list() {
    return (await this.listPests.execute()).map((p) => this.toResponse(p));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const snap = await this.pests.findById(id);
    if (!snap) throw new NotFoundException(id);
    return this.toResponse(snap);
  }

  @Patch(':id')
  async update(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: {
    name: Record<string, string>; type: PestType; kind?: PestKind; scientificName?: string;
    family?: string; description?: Record<string, string>;
    images?: { key: string; caption?: string; category?: string }[];
  }) {
    try {
      const snap = await this.updatePest.execute({ id, actor: user.email, ...body });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Patch(':id/biology')
  async biology(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: BiologySnapshot) {
    try {
      const snap = await this.setPestBiology.execute({ id, actor: user.email, biology: body });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Patch(':id/damage')
  async damage(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: {
    symptoms?: Record<string, string>; attackedOrgans?: string[]; damageTypes?: string[]; harmfulnessLevel?: string; nuisanceTypes?: string[];
  }) {
    try {
      const snap = await this.setPestDamage.execute({ id, actor: user.email, ...body });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Patch(':id/distribution')
  async distribution(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: {
    geographicAreas?: string[]; favorableClimate?: Record<string, string>; knownPresence?: Record<string, string>;
  }) {
    try {
      const snap = await this.setPestDistribution.execute({ id, actor: user.email, ...body });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Patch(':id/management')
  async management(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: {
    prevention?: Record<string, string>; biologicalControl?: Record<string, string>;
    predators?: string[]; parasitoids?: string[];
    approvedProducts?: ApprovedProductJSON[]; knownResistances?: Record<string, string>;
  }) {
    try {
      const snap = await this.setPestManagement.execute({ id, actor: user.email, ...body });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Patch(':id/sources')
  async sources(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: { sources?: SourceJSON[] }) {
    try {
      const snap = await this.setPestSources.execute({ id, actor: user.email, sources: body.sources });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Patch(':id/weed')
  async weed(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: {
    reproductionMode?: string[]; disseminationCapacity?: string;
    emergenceDepth?: MinMaxRangeJSON; seedBankLongevity?: MinMaxRangeJSON;
  }) {
    try {
      const snap = await this.setPestWeed.execute({ id, actor: user.email, ...body });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Patch(':id/disease')
  async disease(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: {
    firstSymptoms?: Record<string, string>; advancedSymptoms?: Record<string, string>; confusionRisk?: Record<string, string>;
    pathogen?: Record<string, string>; propagationModes?: string[]; potentialLosses?: Record<string, string>; evolutionSpeed?: string;
    cropRotation?: Record<string, string>; resistantVarieties?: Record<string, string>; prophylaxis?: Record<string, string>; irrigationControl?: Record<string, string>;
    disinfection?: Record<string, string>; culturalControl?: Record<string, string>; chemicalControl?: Record<string, string>; curativeTreatment?: Record<string, string>;
  }) {
    try {
      const snap = await this.setPestDisease.execute({ id, actor: user.email, ...body });
      return this.toResponse(snap);
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      throw e;
    }
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try {
      await this.deletePest.execute({ id, actor: user.email });
    } catch (e) {
      if (e instanceof PestNotFoundError) throw new NotFoundException(id);
      if (e instanceof PestInUseError) throw new ConflictException({ message: `Rattaché à ${e.count} culture(s) — détachez-le d'abord.`, count: e.count });
      throw e;
    }
  }

  private toResponse(snap: PestSnapshot) {
    const doc = toPestDocument(snap);
    return { ...doc, images: (snap.images ?? []).map((img) => toImageDto(img, this.storage)) };
  }
}
