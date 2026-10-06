import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Category } from '@prisma/client';
import { CacheService } from '../common/cache.service';
import { slugify } from '../common/utils';
import { PrismaService } from '../prisma/prisma.service';
import { CategoryDto } from './catalog.dto';

export interface CategoryNode extends Category {
  children: CategoryNode[];
}

const CACHE_KEY = 'catalog:categories';

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** All categories (flat), cached. Small enough to keep in memory even with hundreds of rows. */
  all(): Promise<Category[]> {
    return this.cache.wrap(CACHE_KEY, 300, () =>
      this.prisma.category.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
    );
  }

  async tree(includeInactive = false): Promise<CategoryNode[]> {
    const list = (await this.all()).filter((c) => includeInactive || c.isActive);
    const byId = new Map<string, CategoryNode>(list.map((c) => [c.id, { ...c, children: [] }]));
    const roots: CategoryNode[] = [];
    for (const node of byId.values()) {
      const parent = node.parentId ? byId.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else if (!node.parentId) roots.push(node);
    }
    return roots;
  }

  async bySlug(slug: string) {
    const category = (await this.all()).find((c) => c.slug === slug && c.isActive);
    if (!category) throw new NotFoundException('Category not found');
    const all = await this.all();
    return {
      ...category,
      breadcrumbs: await this.breadcrumbs(category.id),
      children: all.filter((c) => c.parentId === category.id && c.isActive),
    };
  }

  /** The category itself plus every descendant — used so "Men" lists products of "Men → T-Shirts". */
  async descendantIds(categoryId: string): Promise<string[]> {
    const all = await this.all();
    const result = [categoryId];
    for (let i = 0; i < result.length; i++) {
      for (const c of all) if (c.parentId === result[i] && c.isActive) result.push(c.id);
    }
    return result;
  }

  async breadcrumbs(categoryId: string): Promise<{ id: string; name: string; slug: string }[]> {
    const byId = new Map((await this.all()).map((c) => [c.id, c]));
    const trail: { id: string; name: string; slug: string }[] = [];
    let current = byId.get(categoryId);
    while (current && trail.length < 10) {
      trail.unshift({ id: current.id, name: current.name, slug: current.slug });
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return trail;
  }

  /** Effective return policy, inherited from the closest ancestor that defines one. */
  async returnPolicy(categoryId: string): Promise<{ isReturnable?: boolean; returnWindowDays?: number }> {
    const byId = new Map((await this.all()).map((c) => [c.id, c]));
    let current = byId.get(categoryId);
    const policy: { isReturnable?: boolean; returnWindowDays?: number } = {};
    while (current) {
      if (policy.isReturnable === undefined && current.isReturnable !== null) policy.isReturnable = current.isReturnable;
      if (policy.returnWindowDays === undefined && current.returnWindowDays !== null) {
        policy.returnWindowDays = current.returnWindowDays;
      }
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return policy;
  }

  // ───────────── Admin ─────────────

  async create(dto: CategoryDto) {
    if (dto.parentId) await this.ensureExists(dto.parentId);
    const created = await this.prisma.category.create({
      data: { ...dto, slug: dto.slug ? slugify(dto.slug) : slugify(dto.name) },
    });
    await this.invalidate();
    return created;
  }

  async update(id: string, dto: Partial<CategoryDto>) {
    await this.ensureExists(id);
    if (dto.parentId) {
      if (dto.parentId === id) throw new BadRequestException('A category cannot be its own parent');
      const descendants = await this.descendantIdsIncludingInactive(id);
      if (descendants.includes(dto.parentId)) {
        throw new BadRequestException('Cannot move a category inside its own sub-category');
      }
    }
    const updated = await this.prisma.category.update({
      where: { id },
      data: { ...dto, slug: dto.slug ? slugify(dto.slug) : undefined },
    });
    await this.invalidate();
    return updated;
  }

  async remove(id: string) {
    const [children, products] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id } }),
      this.prisma.productCategory.count({ where: { categoryId: id } }),
    ]);
    if (children || products) {
      throw new BadRequestException(
        'Category has sub-categories or products. Move them or deactivate the category instead.',
      );
    }
    await this.prisma.category.delete({ where: { id } });
    await this.invalidate();
    return { ok: true };
  }

  private async descendantIdsIncludingInactive(id: string) {
    const all = await this.prisma.category.findMany({ select: { id: true, parentId: true } });
    const result = [id];
    for (let i = 0; i < result.length; i++) {
      for (const c of all) if (c.parentId === result[i]) result.push(c.id);
    }
    return result;
  }

  private async ensureExists(id: string) {
    const exists = await this.prisma.category.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException('Category not found');
  }

  async invalidate() {
    await this.cache.delByPrefix('catalog:');
  }
}
