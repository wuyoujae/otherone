import crypto from 'crypto';
import prisma from '../../config/database';

export async function deleteArticlesForProject(projectId: string): Promise<void> {
  await prisma.kbArticle.deleteMany({ where: { projectId } });
}

export async function getArticlesByProjectId(projectId: string) {
  return prisma.kbArticle.findMany({
    where: { projectId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
  });
}

export async function createArticle(
  projectId: string,
  createdBy: string,
  data: { title: string; content?: string; category?: string; fileUrl?: string; fileType?: string },
) {
  const id = crypto.randomUUID();
  return prisma.kbArticle.create({
    data: {
      id,
      projectId,
      title: data.title,
      content: data.content || null,
      category: data.category || null,
      status: 0, // draft
      fileUrl: data.fileUrl || null,
      fileType: data.fileType || null,
      createdBy,
      updatedAt: new Date(),
    },
  });
}

export async function updateArticle(
  articleId: string,
  data: { title?: string; content?: string; category?: string; status?: number; fileUrl?: string; fileType?: string; sortOrder?: number },
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = { updatedAt: new Date() };
  if (data.title !== undefined) updateData.title = data.title;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.fileUrl !== undefined) updateData.fileUrl = data.fileUrl;
  if (data.fileType !== undefined) updateData.fileType = data.fileType;
  if (data.sortOrder !== undefined) updateData.sortOrder = data.sortOrder;

  return prisma.kbArticle.update({
    where: { id: articleId },
    data: updateData,
  });
}

export async function deleteArticle(articleId: string) {
  return prisma.kbArticle.delete({ where: { id: articleId } });
}

export async function getArticleById(articleId: string) {
  return prisma.kbArticle.findUnique({ where: { id: articleId } });
}
