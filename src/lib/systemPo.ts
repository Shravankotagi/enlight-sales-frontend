export interface SystemPoRequestParams {
  po_number?: string;
  reservation_token?: string;
  deal_id?: string;
}

export interface SystemPoAllocation {
  po_number: string;
  generated_po_number: string;
  po_reservation_token: string;
}

export function createSystemPoReservationToken(prefix = 'dashboard') {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeSystemPoAllocation(response: any): SystemPoAllocation | null {
  const allocation = response?.data || response;
  const poNumber = String(allocation?.po_number || '').trim();
  const generatedPoNumber = String(allocation?.generated_po_number || poNumber).trim();
  const reservationToken = String(allocation?.po_reservation_token || '').trim();

  if (!poNumber || !generatedPoNumber || !reservationToken) return null;

  return {
    po_number: poNumber,
    generated_po_number: generatedPoNumber,
    po_reservation_token: reservationToken,
  };
}

export function getPoErrorMessage(
  error: any,
  fallback = 'This PO number is already allocated.',
) {
  return (
    error?.response?.data?.message ||
    error?.response?.data?.error ||
    error?.message ||
    fallback
  );
}
