import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../../utils/response';
import * as todoService from './todo.service';
import prisma from '../../config/database';

async function validateProjectAccess(req: Request, res: Response): Promise<string | null> {
  if (!req.user) { sendError(res, 'Authentication required', 401); return null; }

  const projectId = req.params.projectId as string;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) { sendError(res, 'Project not found', 404); return null; }
  if (project.userId !== req.user.userId) { sendError(res, 'Forbidden', 403); return null; }

  return projectId;
}

/* ═══════════ Module Handlers ═══════════ */

export async function getModules(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const modules = await todoService.getModulesByProjectId(projectId);
    sendSuccess(res, modules);
  } catch (error) {
    next(error);
  }
}

export async function createModule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const { name, parentId, color } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      sendError(res, 'Module name is required', 400);
      return;
    }

    if (parentId) {
      const parent = await todoService.getModuleById(parentId);
      if (!parent || parent.projectId !== projectId) {
        sendError(res, 'Parent module not found', 404);
        return;
      }
    }

    const mod = await todoService.createModule(projectId, req.user!.userId, {
      name: name.trim(),
      parentId,
      color,
    });

    sendSuccess(res, mod, undefined, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateModule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const moduleId = req.params.moduleId as string;
    const existing = await todoService.getModuleById(moduleId);
    if (!existing) { sendError(res, 'Module not found', 404); return; }
    if (existing.projectId !== projectId) { sendError(res, 'Forbidden', 403); return; }

    const mod = await todoService.updateModule(moduleId, req.body);
    sendSuccess(res, mod);
  } catch (error) {
    next(error);
  }
}

export async function deleteModule(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const moduleId = req.params.moduleId as string;
    const existing = await todoService.getModuleById(moduleId);
    if (!existing) { sendError(res, 'Module not found', 404); return; }
    if (existing.projectId !== projectId) { sendError(res, 'Forbidden', 403); return; }

    await todoService.deleteModule(projectId, moduleId);
    sendSuccess(res, null);
  } catch (error) {
    next(error);
  }
}

/* ═══════════ Todo Handlers ═══════════ */

export async function getTodos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const todos = await todoService.getTodosByProjectId(projectId);
    sendSuccess(res, todos);
  } catch (error) {
    next(error);
  }
}

export async function createTodo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const { title, description, content, moduleId, priority, assigneeId, startDate, endDate, startTime, endTime } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      sendError(res, 'Title is required', 400);
      return;
    }

    if (moduleId) {
      const mod = await todoService.getModuleById(moduleId);
      if (!mod || mod.projectId !== projectId) {
        sendError(res, 'Module not found', 404);
        return;
      }
    }

    const todo = await todoService.createTodo(projectId, req.user!.userId, {
      title: title.trim(),
      description,
      content,
      moduleId,
      priority,
      assigneeId,
      startDate,
      endDate,
      startTime,
      endTime,
    });

    sendSuccess(res, todo, undefined, 201);
  } catch (error) {
    next(error);
  }
}

export async function batchCreateTodos(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      sendError(res, 'Items array is required and must not be empty', 400);
      return;
    }
    if (items.length > 50) {
      sendError(res, 'Cannot create more than 50 items at once', 400);
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.title || typeof item.title !== 'string' || !item.title.trim()) {
        sendError(res, `Item ${i + 1}: title is required`, 400);
        return;
      }
    }

    const todos = await todoService.batchCreateTodos(
      projectId,
      req.user!.userId,
      items.map((item: { title: string; [key: string]: unknown }) => ({
        ...item,
        title: item.title.trim(),
      })),
    );

    sendSuccess(res, todos, undefined, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateTodo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const todoId = req.params.todoId as string;
    const existing = await todoService.getTodoById(todoId);
    if (!existing) { sendError(res, 'Todo not found', 404); return; }
    if (existing.projectId !== projectId) { sendError(res, 'Forbidden', 403); return; }

    const todo = await todoService.updateTodo(todoId, req.body);
    sendSuccess(res, todo);
  } catch (error) {
    next(error);
  }
}

export async function deleteTodo(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const todoId = req.params.todoId as string;
    const existing = await todoService.getTodoById(todoId);
    if (!existing) { sendError(res, 'Todo not found', 404); return; }
    if (existing.projectId !== projectId) { sendError(res, 'Forbidden', 403); return; }

    await todoService.deleteTodo(todoId);
    sendSuccess(res, null);
  } catch (error) {
    next(error);
  }
}
