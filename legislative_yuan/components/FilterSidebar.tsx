"use client";

export interface FilterOption {
  id: string;
  label: string;
  count: number;
}

export interface FilterGroup {
  title: string;
  options: FilterOption[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}

function FilterGroupSection({ title, options, selected, onToggle }: FilterGroup) {
  if (options.length === 0) return null;
  return (
    <div className="mb-4">
      <div className="mb-1 text-sm font-semibold text-gray-700">{title}</div>
      <div className="space-y-1">
        {options.map((opt) => (
          <label key={opt.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={selected.has(opt.id)}
              onChange={() => onToggle(opt.id)}
            />
            <span>
              {opt.label} ({opt.count})
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function FilterSidebar({ groups }: { groups: FilterGroup[] }) {
  return (
    <aside className="w-full shrink-0 md:w-56">
      {groups.map((g) => (
        <FilterGroupSection key={g.title} {...g} />
      ))}
    </aside>
  );
}
