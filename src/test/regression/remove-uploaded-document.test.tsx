// Issue: <add GitHub issue link>
// Create Order and Create Inquiry can remove an uploaded document and clear its extracted fields.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '@testing-library/react';
import OrdersPage from '../../pages/OrdersPage';
import InquiriesPage from '../../pages/InquiriesPage';
import { renderWithProviders } from '../renderWithProviders';

const api = vi.hoisted(() => {
  const idle = () => vi.fn(() => Promise.resolve({ data: [] }));
  return {
    idle,
    parseDocument: vi.fn(),
    allocatePo: vi.fn(async () => ({
      data: { po_number: 'EM/PO/77', generated_po_number: 'EM/PO/77' },
    })),
    checkPoAvailability: vi.fn(async () => ({ data: { available: true } })),
    releasePoReservation: vi.fn(async () => ({ data: {} })),
    createOrder: vi.fn(),
    processPo: vi.fn(),
    createInquiry: vi.fn(),
    updateStatus: vi.fn(),
  };
});

vi.mock('../../lib/api', () => ({
  logPoAllocationError: vi.fn(),
  ordersApi: {
    getAll: api.idle(),
    getOne: api.idle(),
    create: api.createOrder,
    processPo: api.processPo,
    allocatePo: api.allocatePo,
    checkPoAvailability: api.checkPoAvailability,
    releasePoReservation: api.releasePoReservation,
    delete: api.idle(),
  },
  inquiriesApi: {
    getAll: api.idle(),
    getOne: api.idle(),
    getReviewQueue: api.idle(),
    getStats: api.idle(),
    create: api.createInquiry,
    updateStatus: api.updateStatus,
    previewQuotation: api.idle(),
    sendQuotation: api.idle(),
    generatePdf: api.idle(),
    parseDocument: api.parseDocument,
    parseText: api.idle(),
    delete: api.idle(),
  },
  customersApi: {
    getAll: api.idle(),
    getOne: api.idle(),
    getChurnRisk: api.idle(),
    getReorderQueue: api.idle(),
    getLossAnalytics: api.idle(),
    importClients: api.idle(),
    update: api.idle(),
  },
  dealsApi: {
    getAll: api.idle(),
    getOne: api.idle(),
    getKanban: api.idle(),
    getPipeline: api.idle(),
    allocatePo: api.allocatePo,
    checkPoAvailability: api.checkPoAvailability,
    releasePoReservation: api.releasePoReservation,
    updateStage: api.idle(),
    processPo: api.processPo,
    delete: api.idle(),
  },
  employeesApi: { getAll: api.idle() },
  productsApi: { getAll: api.idle(), lookup: api.idle(), create: api.idle() },
  zohoApi: { pullInitialSync: api.idle(), sync: api.idle(), getStatus: api.idle() },
  activityLogsApi: { getAll: api.idle() },
}));

function extractionResponse(data: Record<string, unknown>) {
  return { data: { success: true, data } };
}

function pdfFile(name: string) {
  return new File(['purchase-order'], name, { type: 'application/pdf' });
}

async function uploadPdf(inputId: string, name: string) {
  const input = document.getElementById(inputId) as HTMLInputElement;
  await userEvent.upload(input, pdfFile(name));
}

describe('remove uploaded document', () => {
  beforeEach(() => {
    api.parseDocument.mockReset();
    api.releasePoReservation.mockClear();
    api.createOrder.mockClear();
    api.processPo.mockClear();
    api.createInquiry.mockClear();
    api.updateStatus.mockClear();
  });

  it('removes an order document, clears extracted fields, and keeps the system PO', async () => {
    const user = userEvent.setup();
    api.parseDocument.mockResolvedValueOnce(
      extractionResponse({
        customer_name: 'Acme Steels',
        customer_phone: '9822012345',
        po_number: 'PO-100',
        delivery_location: 'Chakan Plant',
        payment_terms: '30 Days',
        additional_notes: 'Unload at gate 2',
        line_items: [{ sku_text: 'HR Coil', dimensions: '2mm', quantity: 5, unit: 'MT', rate: 50000 }],
      }),
    );
    renderWithProviders(<OrdersPage />);

    await user.click(await screen.findByRole('button', { name: /Create New Order/i }));
    expect(await screen.findByDisplayValue('EM/PO/77')).toBeTruthy();

    await uploadPdf('order-po-file-upload', 'acme-po.pdf');
    expect(await screen.findByDisplayValue('Acme Steels')).toBeTruthy();
    expect(screen.getByDisplayValue('HR Coil')).toBeTruthy();
    expect(screen.getByDisplayValue('PO-100')).toBeTruthy();
    expect(screen.getByText('acme-po.pdf')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(screen.queryByText('acme-po.pdf')).not.toBeInTheDocument();
    expect(screen.getByText(/Drop document here, or/)).toBeTruthy();
    expect(screen.queryByDisplayValue('Acme Steels')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('HR Coil')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('PO-100')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Chakan Plant')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Unload at gate 2')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('EM/PO/77')).toBeTruthy();
    expect(api.releasePoReservation).not.toHaveBeenCalled();
    expect(api.processPo).not.toHaveBeenCalled();
    expect(api.createOrder).not.toHaveBeenCalled();
  });

  it('does not keep the previous order extraction when the next document omits those fields', async () => {
    api.parseDocument
      .mockResolvedValueOnce(
        extractionResponse({
          customer_name: 'Acme Steels',
          line_items: [{ sku_text: 'HR Coil', dimensions: '2mm', quantity: 5, unit: 'MT', rate: 50000 }],
        }),
      )
      .mockResolvedValueOnce(
        extractionResponse({
          delivery_location: 'Mumbai Yard',
        }),
      );
    renderWithProviders(<OrdersPage />);

    await userEvent.click(await screen.findByRole('button', { name: /Create New Order/i }));
    await screen.findByDisplayValue('EM/PO/77');
    await uploadPdf('order-po-file-upload', 'acme-po.pdf');
    expect(await screen.findByDisplayValue('Acme Steels')).toBeTruthy();

    await uploadPdf('order-po-file-upload', 'mumbai-po.pdf');
    await waitFor(() => {
      expect(screen.queryByText(/AI Extracting PO details/)).not.toBeInTheDocument();
    });

    expect(screen.queryByDisplayValue('Acme Steels')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('HR Coil')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('EM/PO/77')).toBeTruthy();
  });

  it('removes an inquiry document and clears extracted fields', async () => {
    const user = userEvent.setup();
    api.parseDocument.mockResolvedValueOnce(
      extractionResponse({
        customer_name: 'Acme Steels',
        customer_email: 'buyer@acme.example',
        customer_phone: '9822012345',
        delivery_location: 'Chakan Plant',
        payment_terms: '30 Days',
        preferred_make: 'TATA',
        additional_notes: 'Deliver next week',
        line_items: [{ sku_text: 'HR Coil', dimensions: '2mm', quantity: 5, unit: 'MT', rate: 50000 }],
      }),
    );
    renderWithProviders(<InquiriesPage />);

    await user.click(await screen.findByRole('button', { name: /Log New Inquiry/i }));
    await uploadPdf('inquiry-doc-file-upload', 'acme-inquiry.pdf');

    expect(await screen.findByDisplayValue('Acme Steels')).toBeTruthy();
    expect(screen.getByDisplayValue('buyer@acme.example')).toBeTruthy();
    expect(screen.getByDisplayValue('HR Coil')).toBeTruthy();
    expect(screen.getByDisplayValue('Deliver next week')).toBeTruthy();
    expect(screen.getByText('acme-inquiry.pdf')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(screen.queryByText('acme-inquiry.pdf')).not.toBeInTheDocument();
    expect(screen.getByText(/Drop document here, or/)).toBeTruthy();
    expect(screen.queryByDisplayValue('Acme Steels')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('buyer@acme.example')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('HR Coil')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Chakan Plant')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Deliver next week')).not.toBeInTheDocument();
    expect(api.createInquiry).not.toHaveBeenCalled();
    expect(api.updateStatus).not.toHaveBeenCalled();
  });

  it('does not keep the previous inquiry extraction when the next document omits those fields', async () => {
    api.parseDocument
      .mockResolvedValueOnce(
        extractionResponse({
          customer_name: 'Acme Steels',
          additional_notes: 'Deliver next week',
          line_items: [{ sku_text: 'HR Coil', dimensions: '2mm', quantity: 5, unit: 'MT', rate: 50000 }],
        }),
      )
      .mockResolvedValueOnce(
        extractionResponse({
          delivery_location: 'Mumbai Yard',
        }),
      );
    renderWithProviders(<InquiriesPage />);

    await userEvent.click(await screen.findByRole('button', { name: /Log New Inquiry/i }));
    await uploadPdf('inquiry-doc-file-upload', 'acme-inquiry.pdf');
    expect(await screen.findByDisplayValue('Acme Steels')).toBeTruthy();

    await uploadPdf('inquiry-doc-file-upload', 'mumbai-inquiry.pdf');
    await waitFor(() => {
      expect(screen.queryByText(/AI Extracting inquiry details/)).not.toBeInTheDocument();
    });

    expect(screen.queryByDisplayValue('Acme Steels')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('HR Coil')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('Deliver next week')).not.toBeInTheDocument();
    expect(screen.getByDisplayValue('Mumbai Yard')).toBeTruthy();
    expect(screen.getByText('mumbai-inquiry.pdf')).toBeTruthy();
  });
});
