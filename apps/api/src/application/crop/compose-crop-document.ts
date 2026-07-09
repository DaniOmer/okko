import { CropSnapshot } from '../../domain/crop/crop';
import { CropDocument, toCropDocument } from './crop-read-model';
import { ListVarietiesUseCase } from './list-varieties.use-case';
import { ListCropZonesUseCase } from '../zone/list-crop-zones.use-case';
import { ListCroppingWindowsUseCase } from '../window/list-cropping-windows.use-case';
import { ListCropPestsUseCase } from '../pest/list-crop-pests.use-case';
import { ListCropPricesUseCase } from '../price/list-crop-prices.use-case';

export class CropDocumentComposer {
  constructor(
    private readonly listVarieties: ListVarietiesUseCase,
    private readonly listZones: ListCropZonesUseCase,
    private readonly listWindows: ListCroppingWindowsUseCase,
    private readonly listPests: ListCropPestsUseCase,
    private readonly listPrices: ListCropPricesUseCase,
  ) {}

  async compose(cropId: string, snap: CropSnapshot): Promise<CropDocument> {
    const varieties = await this.listVarieties.execute({ cropId });
    const zones = await this.listZones.execute({ cropId });
    const windows = await this.listWindows.execute({ cropId });
    const pests = await this.listPests.execute({ cropId });
    const prices = await this.listPrices.execute({ cropId });
    return toCropDocument(snap, { varieties, zones, windows, pests, prices });
  }
}
