"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const todo_controller_1 = require("./todo.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// Module routes
router.get('/:projectId/modules', auth_1.authenticate, todo_controller_1.getModules);
router.post('/:projectId/modules', auth_1.authenticate, todo_controller_1.createModule);
router.put('/:projectId/modules/:moduleId', auth_1.authenticate, todo_controller_1.updateModule);
router.delete('/:projectId/modules/:moduleId', auth_1.authenticate, todo_controller_1.deleteModule);
// Todo routes
router.get('/:projectId', auth_1.authenticate, todo_controller_1.getTodos);
router.post('/:projectId', auth_1.authenticate, todo_controller_1.createTodo);
router.post('/:projectId/batch', auth_1.authenticate, todo_controller_1.batchCreateTodos);
router.put('/:projectId/:todoId', auth_1.authenticate, todo_controller_1.updateTodo);
router.delete('/:projectId/:todoId', auth_1.authenticate, todo_controller_1.deleteTodo);
exports.default = router;
//# sourceMappingURL=todo.routes.js.map