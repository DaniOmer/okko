import { Pest, PestSnapshot } from '../../domain/pest/pest';
import { PestRepository } from './pest.repository';
import { PestNotFoundError } from './update-pest.use-case';
import { AuditLogRepository } from '../audit/audit-log.repository';
import { Clock } from '../shared/clock';

export interface SetPestDiseaseInput {
  id: string; actor: string;
  firstSymptoms?: Record<string, string>; advancedSymptoms?: Record<string, string>; confusionRisk?: Record<string, string>;
  pathogen?: Record<string, string>; propagationModes?: string[]; potentialLosses?: Record<string, string>; evolutionSpeed?: string;
  cropRotation?: Record<string, string>; resistantVarieties?: Record<string, string>; prophylaxis?: Record<string, string>; irrigationControl?: Record<string, string>;
  disinfection?: Record<string, string>; culturalControl?: Record<string, string>; chemicalControl?: Record<string, string>; curativeTreatment?: Record<string, string>;
}

export class SetPestDiseaseUseCase {
  constructor(
    private readonly pests: PestRepository,
    private readonly audit: AuditLogRepository,
    private readonly clock: Clock,
  ) {}

  async execute(input: SetPestDiseaseInput): Promise<PestSnapshot> {
    const existing = await this.pests.findById(input.id);
    if (!existing) throw new PestNotFoundError(input.id);
    const snap = Pest.fromSnapshot(existing).setDisease({
      firstSymptoms: input.firstSymptoms, advancedSymptoms: input.advancedSymptoms, confusionRisk: input.confusionRisk,
      pathogen: input.pathogen, propagationModes: input.propagationModes, potentialLosses: input.potentialLosses, evolutionSpeed: input.evolutionSpeed,
      cropRotation: input.cropRotation, resistantVarieties: input.resistantVarieties, prophylaxis: input.prophylaxis, irrigationControl: input.irrigationControl,
      disinfection: input.disinfection, culturalControl: input.culturalControl, chemicalControl: input.chemicalControl, curativeTreatment: input.curativeTreatment,
    }).toSnapshot();
    await this.pests.save(snap);
    await this.audit.record({
      entityType: 'Pest', entityId: snap.id, actor: input.actor,
      at: this.clock.nowIso(),
      changes: { disease: { firstSymptoms: input.firstSymptoms, advancedSymptoms: input.advancedSymptoms, confusionRisk: input.confusionRisk, pathogen: input.pathogen, propagationModes: input.propagationModes, potentialLosses: input.potentialLosses, evolutionSpeed: input.evolutionSpeed, cropRotation: input.cropRotation, resistantVarieties: input.resistantVarieties, prophylaxis: input.prophylaxis, irrigationControl: input.irrigationControl, disinfection: input.disinfection, culturalControl: input.culturalControl, chemicalControl: input.chemicalControl, curativeTreatment: input.curativeTreatment } },
    });
    return snap;
  }
}
