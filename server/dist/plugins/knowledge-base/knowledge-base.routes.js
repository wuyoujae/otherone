"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const knowledge_base_controller_1 = require("./knowledge-base.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.get('/:projectId', auth_1.authenticate, knowledge_base_controller_1.getArticles);
router.post('/:projectId', auth_1.authenticate, knowledge_base_controller_1.createArticle);
router.put('/:projectId/:articleId', auth_1.authenticate, knowledge_base_controller_1.updateArticle);
router.delete('/:projectId/:articleId', auth_1.authenticate, knowledge_base_controller_1.deleteArticle);
exports.default = router;
//# sourceMappingURL=knowledge-base.routes.js.map