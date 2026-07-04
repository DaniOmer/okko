import { AuditLogReader, AuditRecord } from '../audit/audit-log.repository';
import { CropRepository } from './crop.repository';
import { CropNotFoundError } from './publish-crop.use-case';

export class GetCropHistoryUseCase {
  constructor(
    private readonly crops: CropRepository,
    private readonly audit: AuditLogReader,
  ) {}

  async execute(input: { cropId: string }): Promise<AuditRecord[]> {
    if (!(await this.crops.findById(input.cropId))) throw new CropNotFoundError(input.cropId);
    return this.audit.listByEntity('Crop', input.cropId);
  }
}
