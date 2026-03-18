import { Router } from 'express';
import {
  getTodos,
  createTodo,
  batchCreateTodos,
  updateTodo,
  deleteTodo,
  getModules,
  createModule,
  updateModule,
  deleteModule,
} from './todo.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// Module routes
router.get('/:projectId/modules', authenticate, getModules);
router.post('/:projectId/modules', authenticate, createModule);
router.put('/:projectId/modules/:moduleId', authenticate, updateModule);
router.delete('/:projectId/modules/:moduleId', authenticate, deleteModule);

// Todo routes
router.get('/:projectId', authenticate, getTodos);
router.post('/:projectId', authenticate, createTodo);
router.post('/:projectId/batch', authenticate, batchCreateTodos);
router.put('/:projectId/:todoId', authenticate, updateTodo);
router.delete('/:projectId/:todoId', authenticate, deleteTodo);

export default router;
