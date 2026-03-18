import { Request, Response, NextFunction } from 'express';
import { sendSuccess, sendError } from '../../utils/response';
import * as kbService from './knowledge-base.service';
import prisma from '../../config/database';

async function validateProjectAccess(req: Request, res: Response): Promise<string | null> {
  if (!req.user) { sendError(res, 'Authentication required', 401); return null; }

  const projectId = req.params.projectId as string;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) { sendError(res, 'Project not found', 404); return null; }
  if (project.userId !== req.user.userId) { sendError(res, 'Forbidden', 403); return null; }

  return projectId;
}

export async function getArticles(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const articles = await kbService.getArticlesByProjectId(projectId);
    sendSuccess(res, articles);
  } catch (error) {
    next(error);
  }
}

export async function createArticle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const { title, content, category, fileUrl, fileType } = req.body;
    if (!title || typeof title !== 'string' || !title.trim()) {
      sendError(res, 'Title is required', 400);
      return;
    }

    const article = await kbService.createArticle(projectId, req.user!.userId, {
      title: title.trim(),
      content,
      category,
      fileUrl,
      fileType,
    });

    sendSuccess(res, article, undefined, 201);
  } catch (error) {
    next(error);
  }
}

export async function updateArticle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const articleId = req.params.articleId as string;
    const existing = await kbService.getArticleById(articleId);
    if (!existing) { sendError(res, 'Article not found', 404); return; }
    if (existing.projectId !== projectId) { sendError(res, 'Forbidden', 403); return; }

    const article = await kbService.updateArticle(articleId, req.body);
    sendSuccess(res, article);
  } catch (error) {
    next(error);
  }
}

export async function deleteArticle(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = await validateProjectAccess(req, res);
    if (!projectId) return;

    const articleId = req.params.articleId as string;
    const existing = await kbService.getArticleById(articleId);
    if (!existing) { sendError(res, 'Article not found', 404); return; }
    if (existing.projectId !== projectId) { sendError(res, 'Forbidden', 403); return; }

    await kbService.deleteArticle(articleId);
    sendSuccess(res, null);
  } catch (error) {
    next(error);
  }
}
