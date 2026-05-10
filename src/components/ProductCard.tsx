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
      className="bg-white rounded-[24px] overflow-hidden cursor-pointer shadow-[0_4px_24px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] transition-all active:scale-[0.98] select-none flex flex-col p-3 border border-slate-100"
      onClick={() => onAdd(product)}
    >
      {/* Image area */}
      <div className="relative aspect-[4/3] rounded-[16px] overflow-hidden bg-slate-50 mb-3 shrink-0">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/5">
            <span className="text-5xl opacity-30 font-bold">
              {category?.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
        )}

        {product.stock <= 5 && (
          <Badge variant="destructive" className="absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
            Esgotando
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1">
        <h3 className="font-semibold text-[16px] leading-tight text-slate-800 line-clamp-2 mb-1.5">
          {product.name}
        </h3>
        <p className="text-[#4CAF50] font-bold text-[16px] mb-2">
          R$ {fmt(product.price)}
          {product.type === 'weight' && (
            <span className="text-xs font-medium text-slate-500 ml-1">/kg</span>
          )}
        </p>

        {product.description && (
          <p className="text-[13px] text-slate-500 leading-snug line-clamp-3 mb-4">
            {product.description}
          </p>
        )}

        <div className="mt-auto">
          <button
            className="w-full bg-[#D32F2F] hover:bg-[#B71C1C] text-white font-medium py-2.5 rounded-[12px] transition-colors flex items-center justify-center gap-2 shadow-sm text-[15px]"
            onClick={(e) => { e.stopPropagation(); onAdd(product); }}
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
}

