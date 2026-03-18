import { Router } from 'express';
import { getTree, getNode, createNode, updateNode, deleteNode } from './craft.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

router.get('/:projectId/tree', authenticate, getTree);
router.get('/:projectId/node/:nodeId', authenticate, getNode);
router.post('/:projectId/node', authenticate, createNode);
router.put('/:projectId/node/:nodeId', authenticate, updateNode);
router.delete('/:projectId/node/:nodeId', authenticate, deleteNode);

export default router;
