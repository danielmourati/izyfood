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
      className="bg-card rounded-[14px] overflow-hidden cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_6px_18px_rgba(0,0,0,0.12)] transition-all active:scale-[0.98] select-none flex flex-col border border-border h-full w-full group"
      onClick={() => onAdd(product)}
    >
      {/* Image area - Full width top header */}
      <div className="relative aspect-square w-full overflow-hidden bg-slate-50 dark:bg-zinc-900/60 shrink-0 p-2 flex items-center justify-center">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-contain object-center transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/5">
            <span className="text-2xl opacity-30 font-bold text-muted-foreground">
              {category?.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
        )}

        {product.stock <= 5 && product.controlStock && (
          <Badge variant="destructive" className="absolute top-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-md shadow-sm z-10">
            Esgotando
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 justify-between p-2.5">
        <div>
          <h3 className="font-semibold text-xs leading-tight text-foreground line-clamp-2 mb-1" title={product.name}>
            {product.name}
          </h3>
          <p className="text-[#4CAF50] dark:text-emerald-400 font-bold text-xs">
            R$ {fmt(product.price)}
            {product.type === 'weight' && (
              <span className="text-[9px] font-medium text-muted-foreground ml-1">/kg</span>
            )}
          </p>
        </div>

        <button
          className="w-full bg-[#D32F2F] hover:bg-[#B71C1C] text-white font-medium py-1.5 rounded-[8px] transition-colors flex items-center justify-center gap-1 shadow-sm text-xs mt-2"
          onClick={(e) => { e.stopPropagation(); onAdd(product); }}
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}

