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
      className="bg-card rounded-[12px] overflow-hidden cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.05)] hover:shadow-[0_4px_14px_rgba(0,0,0,0.08)] transition-all active:scale-[0.98] select-none flex flex-col p-1.5 border border-border h-full w-full"
      onClick={() => onAdd(product)}
    >
      {/* Image area */}
      <div className="relative aspect-square w-full rounded-[8px] overflow-hidden bg-muted mb-1.5 shrink-0">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/5">
            <span className="text-2xl opacity-30 font-bold">
              {category?.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
        )}

        {product.stock <= 5 && (
          <Badge variant="destructive" className="absolute top-1 left-1 text-[8px] font-bold px-1 py-0 rounded-full shadow-sm">
            Esgotando
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="flex flex-col flex-1 justify-between">
        <div>
          <h3 className="font-semibold text-[11px] leading-tight text-muted-foreground line-clamp-2 mb-0.5">
            {product.name}
          </h3>
          <p className="text-[#4CAF50] font-bold text-[12px]">
            R$ {fmt(product.price)}
            {product.type === 'weight' && (
              <span className="text-[9px] font-medium text-muted-foreground ml-1">/kg</span>
            )}
          </p>
        </div>

        <button
          className="w-full bg-[#D32F2F] hover:bg-[#B71C1C] text-primary-foreground font-medium py-1 rounded-[6px] transition-colors flex items-center justify-center gap-1 shadow-sm text-[10px] mt-1.5"
          onClick={(e) => { e.stopPropagation(); onAdd(product); }}
        >
          Adicionar
        </button>
      </div>
    </div>
  );
}

