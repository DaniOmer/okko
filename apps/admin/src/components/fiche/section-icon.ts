import { Thermometer, Mountain, Sprout, MapPin, Activity, CalendarDays, Bug, FlaskConical, Wheat, Coins, ShoppingCart, Images, type LucideIcon } from 'lucide-react';

export const SECTION_ICON: Record<string, LucideIcon> = {
  climatic: Thermometer, edaphic: Mountain, varieties: Sprout, zones: MapPin, phenology: Activity,
  windows: CalendarDays, pests: Bug, nutrition: FlaskConical, yields: Wheat, prices: Coins, commercialization: ShoppingCart,
  photos: Images,
};
