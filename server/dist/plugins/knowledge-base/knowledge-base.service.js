"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteArticlesForProject = deleteArticlesForProject;
exports.getArticlesByProjectId = getArticlesByProjectId;
exports.createArticle = createArticle;
exports.updateArticle = updateArticle;
exports.deleteArticle = deleteArticle;
exports.getArticleById = getArticleById;
const crypto_1 = __importDefault(require("crypto"));
const database_1 = __importDefault(require("../../config/database"));
async function deleteArticlesForProject(projectId) {
    await database_1.default.kbArticle.deleteMany({ where: { projectId } });
}
async function getArticlesByProjectId(projectId) {
    return database_1.default.kbArticle.findMany({
        where: { projectId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
}
async function createArticle(projectId, createdBy, data) {
    const id = crypto_1.default.randomUUID();
    return database_1.default.kbArticle.create({
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
async function updateArticle(articleId, data) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData = { updatedAt: new Date() };
    if (data.title !== undefined)
        updateData.title = data.title;
    if (data.content !== undefined)
        updateData.content = data.content;
    if (data.category !== undefined)
        updateData.category = data.category;
    if (data.status !== undefined)
        updateData.status = data.status;
    if (data.fileUrl !== undefined)
        updateData.fileUrl = data.fileUrl;
    if (data.fileType !== undefined)
        updateData.fileType = data.fileType;
    if (data.sortOrder !== undefined)
        updateData.sortOrder = data.sortOrder;
    return database_1.default.kbArticle.update({
        where: { id: articleId },
        data: updateData,
    });
}
async function deleteArticle(articleId) {
    return database_1.default.kbArticle.delete({ where: { id: articleId } });
}
async function getArticleById(articleId) {
    return database_1.default.kbArticle.findUnique({ where: { id: articleId } });
}
//# sourceMappingURL=knowledge-base.service.js.map