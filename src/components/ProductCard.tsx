import { Product, ProductCategory } from '@/types';
import { fmt } from '@/lib/utils';
import { Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface ProductCardProps {
  product: Product;
  category?: ProductCategory;
  onAdd: (product: Product) => void;
}

export function ProductCard({ product, category, onAdd }: ProductCardProps) {
  return (
    <div
      className="bg-white rounded-[16px] overflow-hidden cursor-pointer shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_6px_20px_rgba(0,0,0,0.1)] transition-all active:scale-[0.98] select-none flex flex-col p-2.5 border border-slate-100 aspect-square min-h-[220px]"
      onClick={() => onAdd(product)}
    >
      {/* Image area */}
      <div className="relative h-[45%] rounded-[10px] overflow-hidden bg-slate-50 mb-2 shrink-0">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/5">
            <span className="text-4xl opacity-30 font-bold">
              {category?.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
        )}

        {product.stock <= 5 && (
          <Badge variant="destructive" className="absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0 rounded-full shadow-sm">
            Esgotando
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 justify-between">
        <div>
          <h3 className="font-semibold text-[13px] leading-tight text-slate-800 line-clamp-2 mb-1">
            {product.name}
          </h3>
          <p className="text-[#4CAF50] font-bold text-[14px]">
            R$ {fmt(product.price)}
            {product.type === 'weight' && (
              <span className="text-[10px] font-medium text-slate-500 ml-1">/kg</span>
            )}
          </p>
        </div>

        <button
          className="w-full bg-[#D32F2F] hover:bg-[#B71C1C] text-white font-medium py-1.5 rounded-[8px] transition-colors flex items-center justify-center gap-1 shadow-sm text-[12px] mt-2"
          onClick={(e) => { e.stopPropagation(); onAdd(product); }}
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}

