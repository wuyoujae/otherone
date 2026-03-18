import crypto from 'crypto';
import prisma from '../../config/database';

/* ═══════════ Module CRUD ═══════════ */

export async function getModulesByProjectId(projectId: string) {
  return prisma.todoModule.findMany({
    where: { projectId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function getModuleById(moduleId: string) {
  return prisma.todoModule.findUnique({ where: { id: moduleId } });
}

export async function createModule(
  projectId: string,
  createdBy: string,
  data: { name: string; parentId?: string; color?: string },
) {
  const id = crypto.randomUUID();

  const maxSort = await prisma.todoModule.aggregate({
    where: { projectId, parentId: data.parentId || null },
    _max: { sortOrder: true },
  });
  const nextSort = (maxSort._max.sortOrder ?? -1) + 1;

  return prisma.todoModule.create({
    data: {
      id,
      projectId,
      parentId: data.parentId || null,
      name: data.name,
      color: data.color || null,
      sortOrder: nextSort,
      createdBy,
      updatedAt: new Date(),
    },
  });
}

export async function updateModule(
  moduleId: string,
  data: { name?: string; parentId?: string; color?: string; sortOrder?: number },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.parentId !== undefined) updateData.parentId = data.parentId || null;
  if (data.color !== undefined) updateData.color = data.color || null;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  return prisma.todoModule.update({ where: { id: moduleId }, data: updateData });
}

async function collectModuleDescendantIds(projectId: string, moduleId: string): Promise<string[]> {
  const children = await prisma.todoModule.findMany({
    where: { projectId, parentId: moduleId },
    select: { id: true },
  });
  const ids: string[] = [];
  for (const child of children) {
    ids.push(child.id);
    const nested = await collectModuleDescendantIds(projectId, child.id);
    ids.push(...nested);
  }
  return ids;
}

export async function deleteModule(projectId: string, moduleId: string) {
  const descendantIds = await collectModuleDescendantIds(projectId, moduleId);
  const allIds = [moduleId, ...descendantIds];

  // Unlink todos from deleted modules (set moduleId to null)
  await prisma.todoItem.updateMany({
    where: { projectId, moduleId: { in: allIds } },
    data: { moduleId: null, updatedAt: new Date() },
  });

  // Delete modules bottom-up
  await prisma.todoModule.deleteMany({ where: { id: { in: allIds } } });
}

export async function deleteModulesForProject(projectId: string): Promise<void> {
  await prisma.todoModule.deleteMany({ where: { projectId } });
}

/* ═══════════ Todo CRUD ═══════════ */

export async function deleteTodosForProject(projectId: string): Promise<void> {
  await prisma.todoItem.deleteMany({ where: { projectId } });
}

export async function deleteAllForProject(projectId: string): Promise<void> {
  await deleteTodosForProject(projectId);
  await deleteModulesForProject(projectId);
}

export async function getTodosByProjectId(projectId: string) {
  return prisma.todoItem.findMany({
    where: { projectId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function getTodoById(todoId: string) {
  return prisma.todoItem.findUnique({ where: { id: todoId } });
}

interface CreateTodoData {
  title: string;
  description?: string;
  content?: string;
  moduleId?: string;
  priority?: number;
  assigneeId?: string;
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
}

export async function createTodo(projectId: string, createdBy: string, data: CreateTodoData) {
  const id = crypto.randomUUID();
  return prisma.todoItem.create({
    data: {
      id,
      projectId,
      moduleId: data.moduleId || null,
      title: data.title,
      description: data.description || null,
      content: data.content || null,
      status: 1,
      priority: data.priority || 2,
      assigneeId: data.assigneeId || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      createdBy,
      updatedAt: new Date(),
    },
  });
}

export async function batchCreateTodos(
  projectId: string,
  createdBy: string,
  items: CreateTodoData[],
) {
  const results = [];
  for (const item of items) {
    const todo = await createTodo(projectId, createdBy, item);
    results.push(todo);
  }
  return results;
}

interface UpdateTodoData {
  title?: string;
  description?: string;
  content?: string;
  moduleId?: string;
  status?: number;
  priority?: number;
  assigneeId?: string;
  startDate?: string | null;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  sortOrder?: number;
}

export async function updateTodo(todoId: string, data: UpdateTodoData) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = { updatedAt: new Date() };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.content !== undefined) updateData.content = data.content || null;
  if (data.moduleId !== undefined) updateData.moduleId = data.moduleId || null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.assigneeId !== undefined) updateData.assigneeId = data.assigneeId;
  if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
  if (data.endDate !== undefined) updateData.endDate = data.endDate ? new Date(data.endDate) : null;
  if (data.startTime !== undefined) updateData.startTime = data.startTime || null;
  if (data.endTime !== undefined) updateData.endTime = data.endTime || null;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  return prisma.todoItem.update({ where: { id: todoId }, data: updateData });
}

export async function deleteTodo(todoId: string) {
  return prisma.todoItem.delete({ where: { id: todoId } });
}
