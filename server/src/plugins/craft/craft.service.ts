import crypto from 'crypto';
import prisma from '../../config/database';

// node_type: 1 = file (.craft), 2 = directory (.module)

// --- Lifecycle hooks ---

export async function initCraftForProject(projectId: string, userId: string): Promise<void> {
  const nodeId = crypto.randomUUID();
  await prisma.craftNode.create({
    data: {
      id: nodeId,
      projectId,
      parentId: null,
      name: 'Untitled',
      nodeType: 1,
      content: '',
      sortOrder: 0,
      createdBy: userId,
      updatedAt: new Date(),
    },
  });

  // Also create legacy craft record for backward compatibility
  const craftId = crypto.randomUUID();
  await prisma.craft.create({
    data: {
      id: craftId,
      projectId,
      updatedAt: new Date(),
    },
  });
}

export async function deleteCraftForProject(projectId: string): Promise<void> {
  await prisma.craftNode.deleteMany({ where: { projectId } });
  await prisma.craft.deleteMany({ where: { projectId } });
}

// --- Tree operations ---

export async function getTreeByProjectId(projectId: string) {
  return prisma.craftNode.findMany({
    where: { projectId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      projectId: true,
      parentId: true,
      name: true,
      nodeType: true,
      sortOrder: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

// --- Node CRUD ---

export async function getNodeById(nodeId: string) {
  return prisma.craftNode.findUnique({ where: { id: nodeId } });
}

export async function createNode(
  projectId: string,
  createdBy: string,
  data: { name: string; nodeType: number; parentId?: string; content?: string },
) {
  // Get max sort_order among siblings
  const siblings = await prisma.craftNode.findMany({
    where: { projectId, parentId: data.parentId || null },
    orderBy: { sortOrder: 'desc' },
    take: 1,
    select: { sortOrder: true },
  });
  const nextOrder = siblings.length > 0 ? siblings[0].sortOrder + 1 : 0;

  const id = crypto.randomUUID();
  return prisma.craftNode.create({
    data: {
      id,
      projectId,
      parentId: data.parentId || null,
      name: data.name,
      nodeType: data.nodeType,
      content: data.nodeType === 1 ? (data.content ?? '') : null,
      sortOrder: nextOrder,
      createdBy,
      updatedAt: new Date(),
    },
  });
}

export async function updateNode(
  nodeId: string,
  data: { name?: string; content?: string; parentId?: string | null; sortOrder?: number },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.parentId !== undefined) updateData.parentId = data.parentId;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  return prisma.craftNode.update({
    where: { id: nodeId },
    data: updateData,
  });
}

export async function deleteNode(projectId: string, nodeId: string): Promise<void> {
  // Recursively collect all descendant IDs for directory deletion
  const allIds = await collectDescendantIds(projectId, nodeId);
  allIds.push(nodeId);

  await prisma.craftNode.deleteMany({
    where: { id: { in: allIds } },
  });
}

async function collectDescendantIds(projectId: string, parentId: string): Promise<string[]> {
  const children = await prisma.craftNode.findMany({
    where: { projectId, parentId },
    select: { id: true, nodeType: true },
  });

  const ids: string[] = [];
  for (const child of children) {
    ids.push(child.id);
    if (child.nodeType === 2) {
      const grandchildren = await collectDescendantIds(projectId, child.id);
      ids.push(...grandchildren);
    }
  }
  return ids;
}

// --- Project status helper ---

export async function activateProjectIfDraft(projectId: string): Promise<void> {
  const now = new Date();
  await prisma.project.updateMany({
    where: { id: projectId, status: 0 },
    data: { status: 1, updatedAt: now },
  });
}
