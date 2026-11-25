import type { EventType, OptionType } from "@/api/types";
import type { WhatIfRequest } from "@/api/whatif";

export const EVENT_LABELS: Record<EventType, string> = {
  FACTORY_OUTAGE: "Factory outage",
  SHIPMENT_DELAY: "Shipment delay",
  QUALITY_HOLD: "Quality hold",
  CAPACITY_REDUCTION: "Capacity reduction",
  LOGISTICS_DISRUPTION: "Logistics disruption",
};

export const OPTION_LABELS: Record<OptionType, string> = {
  ALTERNATE_SUPPLIER: "Alternate supplier",
  INVENTORY_TRANSFER: "Inventory transfer",
  REVISED_SCHEDULE: "Revised schedule",
  SPLIT_ORDER: "Split order",
};

export interface Preset {
  label: string;
  patch: Pick<WhatIfRequest, "event_type" | "duration_days">;
}

/** Preset scenarios; each applies to the first supplier in the list. The first keeps its original label. */
export const PRESETS: Preset[] = [
  {
    label: "Supplier A out 7 days",
    patch: { event_type: "FACTORY_OUTAGE", duration_days: 7 },
  },
  {
    label: "Port delay 14 days",
    patch: { event_type: "SHIPMENT_DELAY", duration_days: 14 },
  },
  {
    label: "Quality hold 5 days",
    patch: { event_type: "QUALITY_HOLD", duration_days: 5 },
  },
  {
    label: "Capacity cut 21 days",
    patch: {
      event_type: "CAPACITY_REDUCTION",
      duration_days: 21
    },
  },
];
