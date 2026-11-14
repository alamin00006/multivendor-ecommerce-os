import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { CategoryPayload, CategoryNode, CategoryRef, UpdateCategoryPayload } from '@marketbd/shared';
import type { Category } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { PlatformModeService } from '../platform/platform-mode.service.js';

/** withContent: include the (possibly long) SEO markdown — only for single-category and admin views. */
const toNode = (c: Category, productCount?: number, withContent = false): CategoryNode => ({
  id: c.id,
  parentId: c.parentId,
  name: c.name,
  nameBn: c.nameBn,
  slug: c.slug,
  iconUrl: c.iconUrl,
  imageUrl: c.imageUrl,
  sortOrder: c.sortOrder,
  isActive: c.isActive,
  productCount,
  ...(withContent ? { seoContent: c.seoContent } : {}),
  children: [],
});

export const toCategoryRef = (c: Pick<Category, 'id' | 'name' | 'nameBn' | 'slug'>): CategoryRef => ({
  id: c.id,
  name: c.name,
  nameBn: c.nameBn,
  slug: c.slug,
});

const buildTree = (nodes: CategoryNode[]): CategoryNode[] => {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const roots: CategoryNode[] = [];
  for (const node of nodes) {
    const parent = node.parentId ? byId.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: CategoryNode[]) => {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
};

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mode: PlatformModeService,
  ) {}

  /** Storefront tree of active categories with visible product counts (parents include children). */
  async tree(): Promise<CategoryNode[]> {
    const [categories, counts] = await Promise.all([
      this.prisma.category.findMany({ where: { isActive: true } }),
      this.prisma.product.groupBy({ by: ['categoryId'], where: await this.mode.visibleProductWhere(), _count: true }),
    ]);
    const countMap = new Map(counts.map((c) => [c.categoryId, c._count]));
    const nodes = categories.map((c) => toNode(c, countMap.get(c.id) ?? 0));
    const roots = buildTree(nodes);
    const rollUp = (n: CategoryNode): number => {
      n.productCount = (n.productCount ?? 0) + n.children.reduce((sum, c) => sum + rollUp(c), 0);
      return n.productCount;
    };
    roots.forEach(rollUp);
    return roots;
  }

  /** Admin tree including inactive categories. */
  async adminTree(): Promise<CategoryNode[]> {
    const categories = await this.prisma.category.findMany();
    return buildTree(categories.map((c) => toNode(c, undefined, true)));
  }

  async bySlug(slug: string): Promise<CategoryNode & { breadcrumbs: CategoryRef[] }> {
    const category = await this.prisma.category.findUnique({ where: { slug }, include: { children: true } });
    if (!category || !category.isActive) throw new NotFoundException('Category not found');
    const node = toNode(category, undefined, true);
    node.children = category.children
      .filter((c) => c.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((c) => toNode(c));
    return { ...node, breadcrumbs: await this.breadcrumbs(category.id) };
  }

  async breadcrumbs(categoryId: string): Promise<CategoryRef[]> {
    const trail: CategoryRef[] = [];
    let current = await this.prisma.category.findUnique({ where: { id: categoryId } });
    while (current && trail.length < 10) {
      trail.unshift(toCategoryRef(current));
      current = current.parentId ? await this.prisma.category.findUnique({ where: { id: current.parentId } }) : null;
    }
    return trail;
  }

  /** Category id plus all descendant ids. */
  async descendantIds(rootId: string): Promise<string[]> {
    const all = await this.prisma.category.findMany({ select: { id: true, parentId: true } });
    const ids = [rootId];
    for (let i = 0; i < ids.length; i += 1) {
      for (const c of all) if (c.parentId === ids[i]) ids.push(c.id);
    }
    return ids;
  }

  private async assertParent(parentId: string | null | undefined, selfId?: string): Promise<void> {
    if (!parentId) return;
    if (parentId === selfId) throw new BadRequestException('A category cannot be its own parent');
    const parent = await this.prisma.category.findUnique({ where: { id: parentId } });
    if (!parent) throw new BadRequestException('Parent category not found');
    if (selfId && (await this.descendantIds(selfId)).includes(parentId)) {
      throw new BadRequestException('A category cannot be moved under its own child');
    }
  }

  async create(input: CategoryPayload): Promise<CategoryNode> {
    await this.assertParent(input.parentId);
    const { sortOrder, parentId, ...rest } = input;
    return toNode(
      await this.prisma.category.create({
        data: { ...rest, parentId: parentId ?? null, sortOrder: Number(sortOrder ?? 0) },
      }),
    );
  }

  async update(id: string, input: UpdateCategoryPayload): Promise<CategoryNode> {
    await this.assertParent(input.parentId, id);
    const { sortOrder, parentId, ...rest } = input;
    return toNode(
      await this.prisma.category.update({
        where: { id },
        data: {
          ...rest,
          ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
          ...(parentId !== undefined
            ? { parent: parentId ? { connect: { id: parentId } } : { disconnect: true } }
            : {}),
        },
      }),
    );
  }

  async remove(id: string): Promise<void> {
    const [children, products] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id } }),
      this.prisma.product.count({ where: { categoryId: id } }),
    ]);
    if (children > 0) throw new BadRequestException('Move or delete the sub-categories first');
    if (products > 0) throw new BadRequestException('This category still has products. Deactivate it instead.');
    await this.prisma.category.delete({ where: { id } });
  }
}
