import { Router } from 'express';
import { getProjects, getRecentProjects, createProject, getProject, updateProject, archiveProject, deleteProject } from './project.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/', authenticate, getProjects);
router.get('/recent', authenticate, getRecentProjects);
router.post('/', authenticate, createProject);
router.get('/:id', authenticate, getProject);
router.put('/:id', authenticate, updateProject);
router.post('/:id/archive', authenticate, archiveProject);
router.delete('/:id', authenticate, deleteProject);

export default router;
