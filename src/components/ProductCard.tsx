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
      className="bg-card rounded-xl border overflow-hidden cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all active:scale-[0.97] select-none group flex flex-col"
      onClick={() => onAdd(product)}
    >
      {/* Image area — reduced ratio for a more square overall card */}
      <div className="relative aspect-[5/4] bg-muted overflow-hidden">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-primary/5">
            <span className="text-4xl opacity-40">
              {category?.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
        )}

        {/* Add button overlay */}
        <button
          className="absolute bottom-1.5 right-1.5 h-8 w-8 sm:h-7 sm:w-7 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onAdd(product); }}
          aria-label={`Adicionar ${product.name}`}
        >
          <Plus className="h-4 w-4" />
        </button>

        {product.stock <= 5 && (
          <Badge variant="destructive" className="absolute top-1.5 left-1.5 text-[10px]">
            Estoque baixo
          </Badge>
        )}
      </div>

      {/* Info — compact for square aspect */}
      <div className="px-2 py-1.5 space-y-0.5">
        <h3 className="font-heading font-semibold text-xs sm:text-[13px] leading-tight text-foreground line-clamp-1">
          {product.name}
        </h3>
        <p className="text-primary text-price text-sm sm:text-[15px] leading-tight">
          R$ {fmt(product.price)}
          {product.type === 'weight' && (
            <span className="text-[10px] font-medium text-muted-foreground ml-0.5">/kg</span>
          )}
        </p>
      </div>
    </div>
  );
}

