import type { Money, OptionType, Recommendation } from '@/api/types';

export const OPTION_TYPE_LABEL: Record<OptionType, string> = {
  ALTERNATE_SUPPLIER: 'Alternate supplier',
  INVENTORY_TRANSFER: 'Inventory transfer',
  REVISED_SCHEDULE: 'Revised schedule',
  SPLIT_ORDER: 'Split order',
};

/** Proposed action in plain words, e.g. "Move 400 units of PO-1001 to SUP-2001". */
export function describeAction(rec: Pick<Recommendation, 'option_type' | 'proposed_action'>): string {
  const { po_id: po, change: c } = rec.proposed_action;
  const qtyOf = c.qty === undefined ? '' : `${c.qty} units of `;
  switch (rec.option_type) {
    case 'ALTERNATE_SUPPLIER':
      return `Move ${qtyOf}${po} to ${c.supplier_id ?? 'an alternate supplier'}`;
    case 'SPLIT_ORDER':
      return `Split ${qtyOf}${po} to ${c.supplier_id ?? 'a second supplier'}`;
    case 'INVENTORY_TRANSFER':
      return `Transfer ${c.qty === undefined ? 'stock' : `${c.qty} units`}${c.item_id ? ` of ${c.item_id}` : ''} from ${c.from_location_id ?? 'another location'} to ${c.to_location_id ?? 'the plant'} (for ${po})`;
    case 'REVISED_SCHEDULE':
      return `Change the delivery date of ${po} to ${c.expected_date ?? 'a new date'}`;
  }
}

/**
 * The Recommendation type has no status field (CONTRACTS section 6), so an option
 * is treated as "not supported by data" when it lists any data_gaps.
 */
export function isUnsupported(rec: Pick<Recommendation, 'data_gaps'>): boolean {
  return rec.data_gaps.length > 0;
}

export function moneyNumber(m: Money | null): number | null {
  if (!m) return null;
  const n = Number(m.amount);
  return Number.isFinite(n) ? n : null;
}

/** Ids of options holding the lowest value (ties all win). Null values never win. */
export function bestIds(recs: Recommendation[], pick: (r: Recommendation) => number | null): Set<string> {
  const vals = recs.flatMap((r) => {
    const v = pick(r);
    return v === null ? [] : [{ id: r.id, v }];
  });
  if (vals.length === 0) return new Set();
  const min = Math.min(...vals.map((x) => x.v));
  return new Set(vals.filter((x) => x.v === min).map((x) => x.id));
}
