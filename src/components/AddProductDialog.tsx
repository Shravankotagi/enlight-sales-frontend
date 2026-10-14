import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { productsApi } from '../lib/api';
import { normalizeProductToCatalog } from '../utils/hsnDetector';

export type CatalogDbProduct = {
  id?: string;
  product_name?: string;
  dimensions?: string;
  hsn_code?: string;
  category?: string;
};

export function findCustomProductMatch(
  productName: string | null | undefined,
  dimensions?: string | null | undefined,
  dbProducts: CatalogDbProduct[] = [],
): CatalogDbProduct | null {
  const cleanName = (productName || '').trim().toLowerCase();
  if (!cleanName) return null;
  const cleanDim = (dimensions || '').trim().toLowerCase();

  // Exact name + dimensions match first, then name match
  const exactBoth = dbProducts.find(
    p =>
      (p.product_name || '').trim().toLowerCase() === cleanName &&
      Boolean(cleanDim) &&
      (p.dimensions || '').trim().toLowerCase() === cleanDim,
  );
  if (exactBoth) return exactBoth;

  return (
    dbProducts.find(p => (p.product_name || '').trim().toLowerCase() === cleanName) || null
  );
}

export function isProductInCatalogList(
  productName: string | null | undefined,
  dimensions?: string | null | undefined,
  dbProducts: CatalogDbProduct[] = [],
): boolean {
  const cleanName = (productName || '').trim();
  if (!cleanName) return false;
  if (normalizeProductToCatalog(cleanName, dimensions).isValid) return true;
  return Boolean(findCustomProductMatch(cleanName, dimensions, dbProducts));
}

export function getCatalogSuggestionsForUnknownProduct(productName: string | null | undefined): string[] {
  const pLower = String(productName || '').toLowerCase();

  if (pLower.includes('coil')) {
    return ['HR Coil', 'CR Coil', 'HRPO Coil', 'GP Coil', 'Galvalume Coil', 'Chequered Coil'];
  }
  if (
    pLower.includes('ms sheet') ||
    (pLower.includes('sheet') &&
      !pLower.includes('hr') &&
      !pLower.includes('cr') &&
      !pLower.includes('gp') &&
      !pLower.includes('galvalume') &&
      !pLower.includes('chequered') &&
      !pLower.includes('hrpo'))
  ) {
    return ['HR Sheet', 'CR Sheet', 'HRPO Sheet', 'GP Sheet', 'Galvalume Sheet', 'Chequered Sheet'];
  }
  if (pLower.includes('ms plate') || (pLower.includes('plate') && !pLower.includes('hr') && !pLower.includes('chequered'))) {
    return ['HR Plate', 'HR Sheet', 'Chequered Sheet'];
  }
  if (pLower.includes('pipe') || pLower.includes('tube') || pLower.includes('tubing')) {
    return ['MS Round Pipe', 'MS Square Pipe', 'MS Rectangular Tube'];
  }
  if (pLower.includes('bar') || pLower.includes('rod') || pLower.includes('sariya')) {
    return ['MS Round Bar', 'MS Flat Bar', 'MS Square Bar', 'TMT Bar'];
  }

  return [
    'HR Coil',
    'HR Sheet',
    'HR Plate',
    'CR Sheet',
    'GP Sheet',
    'MS Angle',
    'MS Channel',
    'MS Beam',
    'MS Round Pipe',
  ];
}

export type AddProductSeed = {
  productName: string;
  dimensions: string;
};

type AddProductDialogProps = {
  open: boolean;
  seed: AddProductSeed;
  onClose: () => void;
  onSaved: (saved: {
    productName: string;
    dimensions: string;
    hsnCode: string;
    record?: CatalogDbProduct;
  }) => void;
};

export default function AddProductDialog({
  open,
  seed,
  onClose,
  onSaved,
}: AddProductDialogProps) {
  const [productName, setProductName] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [hsnCode, setHsnCode] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProductName(seed.productName || '');
    setDimensions(seed.dimensions || '');
    // HSN/SAC code field must be left empty by default — never put fabricated values.
    setHsnCode('');
    // Seed is copied only when the dialog opens so typing is not reset.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const canSave = Boolean(productName.trim() && dimensions.trim() && hsnCode.trim());

  const handleSave = async () => {
    const name = productName.trim();
    const specs = dimensions.trim();
    const hsn = hsnCode.trim();
    if (!name || !specs || !hsn) {
      toast.error('Product Name, Specs/Dimensions, and HSN/SAC Code are all required');
      return;
    }
    setSaving(true);
    try {
      const res = await productsApi.create({
        product_name: name,
        dimensions: specs,
        hsn_code: hsn,
      });
      toast.success('Product added to product list');
      onSaved({
        productName: name,
        dimensions: specs,
        hsnCode: hsn,
        record: res?.data?.data || res?.data,
      });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not add product');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Add this product</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X size={16} />
          </button>
        </div>
        <label className="block text-xs font-semibold text-slate-700">
          Product Name <span className="text-red-500 font-bold">*</span>
          <input
            value={productName}
            onChange={e => setProductName(e.target.value)}
            placeholder="Enter product name"
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Specs / Dimensions <span className="text-red-500 font-bold">*</span>
          <input
            value={dimensions}
            onChange={e => setDimensions(e.target.value)}
            placeholder="Enter specs / dimensions"
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          HSN/SAC Code <span className="text-red-500 font-bold">*</span>
          <input
            value={hsnCode}
            onChange={e => setHsnCode(e.target.value)}
            placeholder="Enter HSN/SAC code"
            className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs font-bold text-slate-600 bg-slate-100 rounded-lg">
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !canSave}
            onClick={handleSave}
            className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg disabled:opacity-50">
            {saving ? 'Saving...' : 'Save product'}
          </button>
        </div>
      </div>
    </div>
  );
}
