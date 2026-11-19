import type { EventType, OptionType, Severity } from '@/api/types';

export const EVENT_LABELS: Record<EventType, string> = {
  FACTORY_OUTAGE: 'Factory outage',
  SHIPMENT_DELAY: 'Shipment delay',
  QUALITY_HOLD: 'Quality hold',
  CAPACITY_REDUCTION: 'Capacity reduction',
  LOGISTICS_DISRUPTION: 'Logistics disruption',
};

export const SEVERITIES: Severity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const OPTION_LABELS: Record<OptionType, string> = {
  ALTERNATE_SUPPLIER: 'Alternate supplier',
  INVENTORY_TRANSFER: 'Inventory transfer',
  REVISED_SCHEDULE: 'Revised schedule',
  SPLIT_ORDER: 'Split order',
};
