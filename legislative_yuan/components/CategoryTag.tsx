import { categoryLabel } from "@/lib/categories";

export function CategoryTag({ categoryId }: { categoryId: string }) {
  return (
    <span className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
      {categoryLabel(categoryId)}
    </span>
  );
}
