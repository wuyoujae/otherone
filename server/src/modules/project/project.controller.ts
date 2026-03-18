import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../../utils/response';
import * as projectService from './project.service';

export async function getProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { sendError(res, 'Authentication required', 401); return; }

    const filter = req.query.filter as string | undefined;
    const search = req.query.search as string | undefined;

    const [projects, counts] = await Promise.all([
      projectService.getProjects(req.user.userId, filter, search),
      projectService.getProjectCounts(req.user.userId),
    ]);

    sendSuccess(res, { projects, counts });
  } catch (error) {
    next(error);
  }
}

export async function getRecentProjects(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { sendError(res, 'Authentication required', 401); return; }
    const projects = await projectService.getRecentProjects(req.user.userId);
    sendSuccess(res, projects);
  } catch (error) {
    next(error);
  }
}

export async function createProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { sendError(res, 'Authentication required', 401); return; }

    const displayName = req.body.displayName || 'U';
    const project = await projectService.createProject(req.user.userId, displayName);
    sendSuccess(res, project, 'Project created', 201);
  } catch (error) {
    next(error);
  }
}

export async function getProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { sendError(res, 'Authentication required', 401); return; }

    const project = await projectService.getProjectById(req.params.id as string);
    if (!project) { sendError(res, 'Project not found', 404); return; }
    if (project.userId !== req.user.userId) { sendError(res, 'Forbidden', 403); return; }

    sendSuccess(res, project);
  } catch (error) {
    next(error);
  }
}

export async function updateProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { sendError(res, 'Authentication required', 401); return; }

    const project = await projectService.getProjectById(req.params.id as string);
    if (!project) { sendError(res, 'Project not found', 404); return; }
    if (project.userId !== req.user.userId) { sendError(res, 'Forbidden', 403); return; }

    const { name, description, systemPrompt } = req.body;
    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      sendError(res, 'Project name cannot be empty');
      return;
    }

    const updated = await projectService.updateProject(project.id, {
      name: name?.trim(),
      description: description !== undefined ? description : undefined,
      systemPrompt: systemPrompt !== undefined ? systemPrompt : undefined,
    });

    sendSuccess(res, updated);
  } catch (error) {
    next(error);
  }
}

export async function archiveProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { sendError(res, 'Authentication required', 401); return; }

    const project = await projectService.getProjectById(req.params.id as string);
    if (!project) { sendError(res, 'Project not found', 404); return; }
    if (project.userId !== req.user.userId) { sendError(res, 'Forbidden', 403); return; }

    const updated = await projectService.archiveProject(project.id);
    sendSuccess(res, updated);
  } catch (error) {
    next(error);
  }
}

export async function deleteProject(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.user) { sendError(res, 'Authentication required', 401); return; }

    const project = await projectService.getProjectById(req.params.id as string);
    if (!project) { sendError(res, 'Project not found', 404); return; }
    if (project.userId !== req.user.userId) { sendError(res, 'Forbidden', 403); return; }

    await projectService.deleteProject(project.id);
    sendSuccess(res, null, 'Project deleted');
  } catch (error) {
    next(error);
  }
}
