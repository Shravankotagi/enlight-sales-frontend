/**
 * Centralized TypeScript Pricing Engine for Frontend
 */

export const DEFAULT_GST_RATE = 0.18;

export interface LineItemInput {
  sku_text?: string;
  description?: string;
  dimensions?: string;
  quantity?: number | string;
  quantity_mt?: number | string;
  quantityTons?: number | string;
  qty?: number | string;
  unit?: string;
  rate?: number | string;
  rate_per_mt?: number | string;
  price_per_mt?: number | string;
  unitPrice?: number | string;
  amount?: number | string;
  [key: string]: any;
}

export interface CalculatedLineItem extends LineItemInput {
  quantity: number;
  rate: number;
  amount: number;
  unit: string;
}

export interface PricingSummary {
  lineItems: CalculatedLineItem[];
  totalQuantity: number;
  totalQuantityMt: number;
  unit: string;
  formattedQuantity: string;
  subtotal: number;
  gstAmount: number;
  grandTotal: number;
  gstRate: number;
  calculationWarning?: string | null;
}

/**
 * Normalizes unit string to standard casing and symbol.
 */
export function normalizeUnit(rawUnit?: string): string {
  if (!rawUnit || typeof rawUnit !== 'string') return 'MT';
  const u = rawUnit.trim().toUpperCase();
  if (u === 'KG' || u === 'KGS' || u === 'KILOGRAM' || u === 'KILOGRAMS') return 'KG';
  if (u === 'MT' || u === 'TON' || u === 'TONS' || u === 'TONNE' || u === 'TONNES' || u === 'METRIC TON' || u === 'METRIC TONS') return 'MT';
  if (u === 'PCS' || u === 'PIECE' || u === 'PIECES') return 'Pcs';
  if (u === 'SHEET' || u === 'SHEETS') return 'Sheets';
  if (u === 'PLATE' || u === 'PLATES') return 'Plates';
  if (u === 'COIL' || u === 'COILS') return 'Coils';
  if (u === 'BAR' || u === 'BARS') return 'Bars';
  if (u === 'NOS' || u === 'NUMBER' || u === 'NUMBERS') return 'Nos';
  if (u === 'BUNDLE' || u === 'BUNDLES') return 'Bundles';
  if (u === 'PIPE' || u === 'PIPES' || u === 'TUBE' || u === 'TUBES') return 'Pipes';
  return rawUnit.trim();
}

/**
 * Converts a quantity to its Metric Ton (MT) equivalent.
 */
export function convertToMt(quantity: number, rawUnit?: string): number {
  const norm = normalizeUnit(rawUnit);
  if (norm === 'KG') return quantity / 1000;
  if (norm === 'MT') return quantity;
  return quantity;
}

/**
 * Calculates line item values.
 */
export function calculateLineItem(item: LineItemInput): CalculatedLineItem {
  if (!item) {
    return { quantity: 0, rate: 0, amount: 0, unit: 'MT' };
  }
  const quantity = Number(item.quantity ?? item.quantity_mt ?? item.quantityTons ?? item.qty ?? 0) || 0;
  const rate = Number(item.rate ?? item.rate_per_mt ?? item.price_per_mt ?? item.unitPrice ?? 0) || 0;
  const unit = normalizeUnit(item.unit);
  
  let amount = item.amount && Number(item.amount) > 0 ? Number(item.amount) : 0;
  if (!amount && quantity > 0 && rate > 0) {
    if (unit === 'KG' && rate > 1000) {
      // Rate is stated per MT (e.g. ₹52,000/MT) but quantity is in KG
      amount = Math.round((quantity / 1000) * rate);
    } else {
      amount = Math.round(quantity * rate);
    }
  }

  return {
    ...item,
    quantity,
    rate,
    amount,
    unit,
  };
}

/**
 * Calculates array of line items.
 */
export function calculateLineItems(lineItems: LineItemInput[]): CalculatedLineItem[] {
  if (!Array.isArray(lineItems)) return [];
  return lineItems.map(calculateLineItem);
}

/**
 * Calculates subtotal (sum of base amounts) across line items.
 */
export function calculateSubtotal(lineItems: LineItemInput[]): number {
  if (!Array.isArray(lineItems) || lineItems.length === 0) return 0;
  return lineItems.reduce((sum, item) => {
    const calculated = calculateLineItem(item);
    return sum + calculated.amount;
  }, 0);
}

/**
 * Strict Forward GST calculation: always forward on line amount — never reverse calculated.
 */
export function calculateGst(baseAmount: number, gstRate: number = DEFAULT_GST_RATE): number {
  const base = Number(baseAmount) || 0;
  if (base <= 0) return 0;
  return Math.round(base * gstRate);
}

/**
 * Calculates Grand Total (Subtotal + Forward GST).
 */
export function calculateGrandTotal(baseAmount: number, gstRate: number = DEFAULT_GST_RATE): number {
  const base = Number(baseAmount) || 0;
  const gst = calculateGst(base, gstRate);
  return base + gst;
}

/**
 * Computes complete pricing summary breakdown with intelligent unit handling.
 */
export function calculatePricingSummary(
  input:
    | LineItemInput[]
    | {
        line_items?: LineItemInput[];
        lineItems?: LineItemInput[];
        basic_amount?: number;
        subtotal?: number;
        baseAmount?: number;
        totalAmount?: number;
        total_amount?: number;
        grand_total?: number;
        grandTotal?: number;
        gst_amount?: number;
        gstAmount?: number;
        sgst_amount?: number;
        cgst_amount?: number;
        igst_amount?: number;
      },
  options: { gstRate?: number } = {}
): PricingSummary {
  const gstRate = options.gstRate ?? DEFAULT_GST_RATE;

  let rawItems: LineItemInput[] = [];
  let explicitBase = 0;

  if (Array.isArray(input)) {
    rawItems = input;
  } else if (input && typeof input === 'object') {
    rawItems = input.line_items || input.lineItems || [];
    explicitBase = Number(input.basic_amount ?? input.subtotal ?? input.baseAmount ?? 0);
  }

  const processedItems = calculateLineItems(rawItems);
  const itemsSubtotal = calculateSubtotal(processedItems);

  // Unit resolution and tonnage calculation
  const distinctUnits = Array.from(new Set(processedItems.map(i => i.unit || 'MT')));
  const isUniformUnit = distinctUnits.length <= 1;
  const primaryUnit = isUniformUnit ? (distinctUnits[0] || 'MT') : 'MT';

  let totalQuantity = 0;
  let totalQuantityMt = 0;
  let formattedQuantity = '';

  if (primaryUnit === 'KG' && isUniformUnit) {
    totalQuantity = processedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    totalQuantityMt = totalQuantity / 1000;
    if (totalQuantityMt >= 1) {
      formattedQuantity = `${totalQuantityMt.toLocaleString('en-IN')} MT (${totalQuantity.toLocaleString('en-IN')} KG)`;
    } else {
      formattedQuantity = `${totalQuantity.toLocaleString('en-IN')} KG`;
    }
  } else if (primaryUnit === 'MT' && isUniformUnit) {
    totalQuantity = processedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
    totalQuantityMt = totalQuantity;
    formattedQuantity = `${totalQuantity.toLocaleString('en-IN')} MT`;
  } else {
    // Mixed units or piece/count units: compute MT for mass units and format appropriately
    totalQuantityMt = processedItems.reduce((sum, item) => sum + convertToMt(Number(item.quantity) || 0, item.unit), 0);
    totalQuantity = isUniformUnit
      ? processedItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
      : totalQuantityMt;
    formattedQuantity = isUniformUnit
      ? `${totalQuantity.toLocaleString('en-IN')} ${primaryUnit}`
      : `${totalQuantityMt.toLocaleString('en-IN')} MT`;
  }

  const inputObj = (!Array.isArray(input) && input && typeof input === 'object') ? input : null;

  // Line-item derived subtotal always takes strict priority when line items exist
  let subtotal = 0;
  if (itemsSubtotal > 0) {
    subtotal = itemsSubtotal;
  } else if (explicitBase > 0) {
    subtotal = explicitBase;
  } else if (inputObj) {
    const rawTotal = Number(inputObj.total_amount ?? inputObj.totalAmount ?? inputObj.grand_total ?? inputObj.grandTotal ?? 0);
    if (rawTotal > 0) {
      subtotal = rawTotal;
    }
  }

  // Handle explicit GST components from PO documents (SGST + CGST / IGST)
  let explicitGst = 0;
  if (inputObj) {
    const sgst = Number(inputObj.sgst_amount || 0);
    const cgst = Number(inputObj.cgst_amount || 0);
    const igst = Number(inputObj.igst_amount || 0);
    const statedGst = Number(inputObj.gst_amount ?? inputObj.gstAmount ?? 0);
    explicitGst = statedGst > 0 ? statedGst : (sgst + cgst + igst);
  }

  const calculatedGst = calculateGst(subtotal, gstRate);
  const gstAmount = explicitGst > 0 && Math.abs(explicitGst - calculatedGst) <= 5 ? explicitGst : calculatedGst;
  const grandTotal = subtotal + gstAmount;

  // Cross-verification against stated PO Grand Total
  let calculationWarning: string | null = null;
  if (inputObj) {
    const statedGrand = Number(inputObj.grand_total ?? inputObj.grandTotal ?? 0);
    if (statedGrand > 0 && Math.abs(statedGrand - grandTotal) > 2) {
      calculationWarning = `Calculated total (₹${grandTotal.toLocaleString('en-IN')}) does not match PO document total (₹${statedGrand.toLocaleString('en-IN')}) — please review`;
    }
  }

  return {
    lineItems: processedItems,
    totalQuantity,
    totalQuantityMt,
    unit: primaryUnit,
    formattedQuantity,
    subtotal,
    gstAmount,
    grandTotal,
    gstRate,
    calculationWarning,
  };
}

export interface QuotationFinancialBreakdown {
  subtotal: number;
  cgst9: number;
  sgst9: number;
  rounding: number;
  grandTotal: number;
  formattedSubtotal: string;
  formattedCgst9: string;
  formattedSgst9: string;
  formattedRounding: string;
  formattedGrandTotal: string;
}

/**
 * Formats a number with Indian currency comma separation and optional 2 decimal places.
 * Example: 4536037 -> 45,36,037.00
 */
export function formatIndianCurrency(num: number, includeDecimals = true): string {
  if (num === null || num === undefined || isNaN(Number(num))) {
    return includeDecimals ? '0.00' : '0';
  }
  const n = Number(num);
  const isNegative = n < 0;
  const absNum = Math.abs(n);

  const parts = absNum.toFixed(2).split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];

  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInt = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  const result = includeDecimals ? `${formattedInt}.${decimalPart}` : formattedInt;
  return isNegative ? `-${result}` : result;
}

/**
 * Calculates standard GST 9% + 9% and Rounding financial breakdown for quotation displays.
 */
export function calculateQuotationBreakdown(baseAmount: number): QuotationFinancialBreakdown {
  const subtotal = Math.max(0, Number(baseAmount) || 0);
  const cgst9 = Math.round(subtotal * 0.09 * 100) / 100;
  const sgst9 = Math.round(subtotal * 0.09 * 100) / 100;
  const exactTotal = subtotal + cgst9 + sgst9;
  const grandTotal = Math.round(exactTotal);
  const rounding = Math.round((grandTotal - exactTotal) * 100) / 100;

  return {
    subtotal,
    cgst9,
    sgst9,
    rounding,
    grandTotal,
    formattedSubtotal: formatIndianCurrency(subtotal, true),
    formattedCgst9: formatIndianCurrency(cgst9, true),
    formattedSgst9: formatIndianCurrency(sgst9, true),
    formattedRounding: formatIndianCurrency(rounding, true),
    formattedGrandTotal: `₹${formatIndianCurrency(grandTotal, true)}`,
  };
}

