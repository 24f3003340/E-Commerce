import type { Category } from './types';

/** Flattens the category tree into indented options for selects. */
export function flattenCategories(tree: Category[], depth = 0): { id: string; label: string; depth: number; category: Category }[] {
  return tree.flatMap((c) => [
    { id: c.id, label: `${'— '.repeat(depth)}${c.name}`, depth, category: c },
    ...flattenCategories(c.children, depth + 1),
  ]);
}
