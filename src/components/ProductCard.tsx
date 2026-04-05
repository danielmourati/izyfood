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
      className="bg-card rounded-xl border overflow-hidden cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all active:scale-[0.97] select-none group"
      onClick={() => onAdd(product)}
    >
      {/* Image area */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
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
          className="absolute bottom-2 right-2 h-8 w-8 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onAdd(product); }}
        >
          <Plus className="h-4 w-4" />
        </button>

        {product.stock <= 5 && (
          <Badge variant="destructive" className="absolute top-2 left-2 text-[10px]">
            Estoque baixo
          </Badge>
        )}
      </div>

      {/* Info */}
      <div className="p-3 space-y-1">
        <h3 className="font-semibold text-sm leading-tight text-foreground line-clamp-2">
          {product.name}
        </h3>
        <p className="text-primary font-bold text-base">
          R$ {fmt(product.price)}
          {product.type === 'weight' && (
            <span className="text-xs font-normal text-muted-foreground">/kg</span>
          )}
        </p>
      </div>
    </div>
  );
}
