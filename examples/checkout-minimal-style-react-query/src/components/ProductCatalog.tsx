import { useProductCatalog } from "../queries/products.ts";
import { ProductCard } from "./ProductCard.tsx";

export function ProductCatalog() {
  const { data: products, isLoading } = useProductCatalog();

  if (isLoading) {
    return <p className="text-slate-400">Loading products…</p>;
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {products?.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}
