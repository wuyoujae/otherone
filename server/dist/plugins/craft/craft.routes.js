"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const craft_controller_1 = require("./craft.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.get('/:projectId/tree', auth_1.authenticate, craft_controller_1.getTree);
router.get('/:projectId/node/:nodeId', auth_1.authenticate, craft_controller_1.getNode);
router.post('/:projectId/node', auth_1.authenticate, craft_controller_1.createNode);
router.put('/:projectId/node/:nodeId', auth_1.authenticate, craft_controller_1.updateNode);
router.delete('/:projectId/node/:nodeId', auth_1.authenticate, craft_controller_1.deleteNode);
exports.default = router;
//# sourceMappingURL=craft.routes.js.map