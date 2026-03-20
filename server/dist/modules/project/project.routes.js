"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const project_controller_1 = require("./project.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.get('/', auth_1.authenticate, project_controller_1.getProjects);
router.get('/recent', auth_1.authenticate, project_controller_1.getRecentProjects);
router.post('/', auth_1.authenticate, project_controller_1.createProject);
router.get('/:id', auth_1.authenticate, project_controller_1.getProject);
router.put('/:id', auth_1.authenticate, project_controller_1.updateProject);
router.post('/:id/archive', auth_1.authenticate, project_controller_1.archiveProject);
router.delete('/:id', auth_1.authenticate, project_controller_1.deleteProject);
exports.default = router;
//# sourceMappingURL=project.routes.js.map