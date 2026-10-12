export type ProcurementStatus = 'awaiting_price' | 'priced' | 'quotation_sent';

export interface ProcurementLineItem {
  sku_text: string;
  grade?: string;
  dimensions?: string;
  quantity: number;
  unit: string;
}

export interface ProcurementRequest {
  id: string;
  material: string;
  grade: string;
  dimensions: string;
  quantity: number;
  unit: string;
  delivery_region: string;
  requested_at: string;
  status: ProcurementStatus;
  line_items: ProcurementLineItem[];
  base_price_per_mt?: number;
  pricing_note?: string;
  valid_until?: string;
}

const SEED_REQUESTS: ProcurementRequest[] = [
  {
    id: 'PR-1042',
    material: 'Hot Rolled Coil',
    grade: 'IS 2062 E250',
    dimensions: '2.5mm x 1250mm',
    quantity: 18,
    unit: 'MT',
    delivery_region: 'West India',
    requested_at: '2026-10-12T08:30:00Z',
    status: 'awaiting_price',
    line_items: [{ sku_text: 'Hot Rolled Coil', grade: 'IS 2062 E250', dimensions: '2.5mm x 1250mm', quantity: 18, unit: 'MT' }],
  },
  {
    id: 'PR-1041',
    material: 'GI Sheet',
    grade: 'DX51D',
    dimensions: '1.2mm x 1220mm',
    quantity: 7500,
    unit: 'KG',
    delivery_region: 'North India',
    requested_at: '2026-10-11T13:10:00Z',
    status: 'awaiting_price',
    line_items: [{ sku_text: 'GI Sheet', grade: 'DX51D', dimensions: '1.2mm x 1220mm', quantity: 7500, unit: 'KG' }],
  },
  {
    id: 'PR-1040',
    material: 'MS Plate',
    grade: 'IS 2062 E250',
    dimensions: '8mm x 1500mm x 6000mm',
    quantity: 12,
    unit: 'MT',
    delivery_region: 'Central India',
    requested_at: '2026-10-10T09:00:00Z',
    status: 'priced',
    base_price_per_mt: 58400,
    line_items: [{ sku_text: 'MS Plate', grade: 'IS 2062 E250', dimensions: '8mm x 1500mm x 6000mm', quantity: 12, unit: 'MT' }],
  },
  {
    id: 'PR-1039',
    material: 'CR Coil',
    grade: 'IS 513 CR2',
    dimensions: '0.8mm x 1000mm',
    quantity: 9,
    unit: 'MT',
    delivery_region: 'South India',
    requested_at: '2026-10-09T11:20:00Z',
    status: 'quotation_sent',
    base_price_per_mt: 67200,
    line_items: [{ sku_text: 'CR Coil', grade: 'IS 513 CR2', dimensions: '0.8mm x 1000mm', quantity: 9, unit: 'MT' }],
  },
  {
    id: 'PR-1038',
    material: 'Aluminium Sheet',
    grade: 'AA 5052',
    dimensions: '2mm x 1250mm',
    quantity: 4200,
    unit: 'KG',
    delivery_region: 'West India',
    requested_at: '2026-10-08T10:45:00Z',
    status: 'priced',
    base_price_per_mt: 248000,
    line_items: [{ sku_text: 'Aluminium Sheet', grade: 'AA 5052', dimensions: '2mm x 1250mm', quantity: 4200, unit: 'KG' }],
  },
  {
    id: 'PR-1037',
    material: 'Stainless Steel Sheet',
    grade: 'SS 304 2B',
    dimensions: '1.5mm x 1500mm',
    quantity: 6,
    unit: 'MT',
    delivery_region: 'North India',
    requested_at: '2026-10-07T15:30:00Z',
    status: 'quotation_sent',
    base_price_per_mt: 184000,
    line_items: [{ sku_text: 'Stainless Steel Sheet', grade: 'SS 304 2B', dimensions: '1.5mm x 1500mm', quantity: 6, unit: 'MT' }],
  },
];

const STORAGE_KEY = 'enlight_procurement_prototype_requests';

const readRequests = (): ProcurementRequest[] => {
  const saved = sessionStorage.getItem(STORAGE_KEY);
  if (!saved) return SEED_REQUESTS;
  try {
    return JSON.parse(saved) as ProcurementRequest[];
  } catch {
    return SEED_REQUESTS;
  }
};

const writeRequests = (requests: ProcurementRequest[]) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  return requests;
};

export const procurementMock = {
  list: () => readRequests().slice().sort(
    (a, b) => new Date(b.requested_at).getTime() - new Date(a.requested_at).getTime(),
  ),
  getOne: (id: string) => readRequests().find((request) => request.id === id) || null,
  setBasePrice: (id: string, basePricePerMt: number, pricingNote = '', validUntil = '') => {
    const next = readRequests().map((request) =>
      request.id === id
        ? { ...request, base_price_per_mt: basePricePerMt, pricing_note: pricingNote, valid_until: validUntil, status: 'priced' as const }
        : request,
    );
    writeRequests(next);
    return next.find((request) => request.id === id) || null;
  },
  markQuotationSent: (id: string) => {
    const next = readRequests().map((request) =>
      request.id === id ? { ...request, status: 'quotation_sent' as const } : request,
    );
    writeRequests(next);
    return next.find((request) => request.id === id) || null;
  },
};
