import { Router } from 'express';
import { getArticles, createArticle, updateArticle, deleteArticle } from './knowledge-base.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/:projectId', authenticate, getArticles);
router.post('/:projectId', authenticate, createArticle);
router.put('/:projectId/:articleId', authenticate, updateArticle);
router.delete('/:projectId/:articleId', authenticate, deleteArticle);

export default router;
