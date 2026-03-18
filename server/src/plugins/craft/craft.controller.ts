import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../../utils/response';
import * as craftService from './craft.service';
import prisma from '../../config/database';

async function validateProjectAccess(req: Request, res: Response): Promise<string | null> {
  if (!req.user) { sendError(res, 'Authentication required', 401); return null; }

  const projectId = req.params.projectId as string;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) { sendError(res, 'Project not found', 404); return null; }
  if (project.userId !== req.user.userId) { sendError(res, 'Forbidden', 403); return null; }

  return projectId;
}

export async function getTree(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const nodes = await craftService.getTreeByProjectId(projectId);
    sendSuccess(res, nodes);
  } catch (error) {
    next(error);
  }
}

export async function getNode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const nodeId = req.params.nodeId as string;
    const node = await craftService.getNodeById(nodeId);
    if (!node) { sendError(res, 'Node not found', 404); return; }
    if (node.projectId !== projectId) { sendError(res, 'Forbidden', 403); return; }

    sendSuccess(res, node);
  } catch (error) {
    next(error);
  }
}

export async function createNode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const { name, nodeType, parentId, content } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      sendError(res, 'Name is required', 400);
      return;
    }

    if (nodeType !== 1 && nodeType !== 2) {
      sendError(res, 'nodeType must be 1 (file) or 2 (directory)', 400);
      return;
    }

    // Validate parent exists and belongs to project (if provided)
    if (parentId) {
      const parent = await craftService.getNodeById(parentId);
      if (!parent) { sendError(res, 'Parent node not found', 404); return; }
      if (parent.projectId !== projectId) { sendError(res, 'Forbidden', 403); return; }
      if (parent.nodeType !== 2) { sendError(res, 'Parent must be a directory', 400); return; }
    }

    const node = await craftService.createNode(projectId, req.user!.userId, {
      name: name.trim(),
      nodeType,
      parentId,
      content,
    });

    sendSuccess(res, node, undefined, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateNode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const nodeId = req.params.nodeId as string;
    const existing = await craftService.getNodeById(nodeId);
    if (!existing) { sendError(res, 'Node not found', 404); return; }
    if (existing.projectId !== projectId) { sendError(res, 'Forbidden', 403); return; }

    const { name, content, parentId, sortOrder } = req.body;

    // If renaming, validate name
    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      sendError(res, 'Name cannot be empty', 400);
      return;
    }

    // If moving to a new parent, validate
    if (parentId !== undefined && parentId !== null) {
      if (parentId === nodeId) { sendError(res, 'Cannot move node into itself', 400); return; }
      const parent = await craftService.getNodeById(parentId);
      if (!parent) { sendError(res, 'Parent node not found', 404); return; }
      if (parent.projectId !== projectId) { sendError(res, 'Forbidden', 403); return; }
      if (parent.nodeType !== 2) { sendError(res, 'Parent must be a directory', 400); return; }
    }

    const node = await craftService.updateNode(nodeId, {
      name: name?.trim(),
      content,
      parentId,
      sortOrder,
    });

    // Activate project if content is saved and project is still draft
    if (content !== undefined) {
      await craftService.activateProjectIfDraft(projectId);
    }

    sendSuccess(res, node);
  } catch (error) {
    next(error);
  }
}

export async function deleteNode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const nodeId = req.params.nodeId as string;
    const existing = await craftService.getNodeById(nodeId);
    if (!existing) { sendError(res, 'Node not found', 404); return; }
    if (existing.projectId !== projectId) { sendError(res, 'Forbidden', 403); return; }

    await craftService.deleteNode(projectId, nodeId);
    sendSuccess(res, null);
  } catch (error) {
    next(error);
  }
}
