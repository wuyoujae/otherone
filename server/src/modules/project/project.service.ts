import crypto from 'crypto';
import prisma from '../../config/database';
import { pluginRegistry } from '../../plugins';

// status: 0=draft, 1=active, 2=archived

export async function getProjects(userId: string, filter?: string, search?: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { userId };

  if (filter === 'archived') {
    where.status = 2;
  } else if (filter === 'ai') {
    where.status = { in: [0, 1] };
    where.aiStatus = 1;
  } else if (filter === 'review') {
    where.status = { in: [0, 1] };
    where.aiStatus = 2;
  } else {
    where.status = { in: [0, 1] };
  }

  if (search && search.trim()) {
    where.name = { contains: search.trim(), mode: 'insensitive' };
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
  });

  const projectIds = projects.map((p) => p.id);
  const members = await prisma.projectMember.findMany({
    where: { projectId: { in: projectIds } },
  });

  const memberMap = new Map<string, typeof members>();
  for (const m of members) {
    const list = memberMap.get(m.projectId) || [];
    list.push(m);
    memberMap.set(m.projectId, list);
  }

  return projects.map((p) => ({
    ...p,
    members: memberMap.get(p.id) || [],
  }));
}

export async function getProjectCounts(userId: string) {
  const [total, aiCount, reviewCount, archivedCount] = await Promise.all([
    prisma.project.count({ where: { userId, status: { in: [0, 1] } } }),
    prisma.project.count({ where: { userId, status: { in: [0, 1] }, aiStatus: 1 } }),
    prisma.project.count({ where: { userId, status: { in: [0, 1] }, aiStatus: 2 } }),
    prisma.project.count({ where: { userId, status: 2 } }),
  ]);
  return { total, aiCount, reviewCount, archivedCount };
}

export async function getRecentProjects(userId: string, limit = 5) {
  return prisma.project.findMany({
    where: { userId, status: { in: [0, 1] } },
    orderBy: { updatedAt: 'desc' },
    take: limit,
  });
}

export async function getProjectById(projectId: string) {
  return prisma.project.findUnique({ where: { id: projectId } });
}

export async function createProject(userId: string, displayName: string) {
  const id = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const now = new Date();

  const project = await prisma.project.create({
    data: {
      id,
      name: 'New Project',
      status: 0, // draft
      userId,
      updatedAt: now,
    },
  });

  await prisma.projectMember.create({
    data: {
      id: memberId,
      projectId: id,
      userId,
      memberType: 1,
      displayLabel: displayName.charAt(0).toUpperCase(),
      role: 1, // owner
    },
  });

  // Initialize all plugin data via lifecycle hooks
  await pluginRegistry.onProjectCreate(id, userId);

  return project;
}

export async function updateProject(projectId: string, data: { name?: string; description?: string; systemPrompt?: string | null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.systemPrompt !== undefined) updateData.systemPrompt = data.systemPrompt;

  return prisma.project.update({
    where: { id: projectId },
    data: updateData,
  });
}

export async function archiveProject(projectId: string) {
  return prisma.project.update({
    where: { id: projectId },
    data: { status: 2, updatedAt: new Date() },
  });
}

export async function deleteProject(projectId: string) {
  // Clean up all plugin data via lifecycle hooks
  await pluginRegistry.onProjectDelete(projectId);

  // Delete project members and the project itself
  await prisma.projectMember.deleteMany({ where: { projectId } });
  await prisma.project.delete({ where: { id: projectId } });
}
