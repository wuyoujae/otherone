export declare function deleteArticlesForProject(projectId: string): Promise<void>;
export declare function getArticlesByProjectId(projectId: string): Promise<{
    id: string;
    status: number;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    content: string | null;
    sortOrder: number;
    createdBy: string | null;
    title: string;
    category: string | null;
    fileUrl: string | null;
    fileType: string | null;
}[]>;
export declare function createArticle(projectId: string, createdBy: string, data: {
    title: string;
    content?: string;
    category?: string;
    fileUrl?: string;
    fileType?: string;
}): Promise<{
    id: string;
    status: number;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    content: string | null;
    sortOrder: number;
    createdBy: string | null;
    title: string;
    category: string | null;
    fileUrl: string | null;
    fileType: string | null;
}>;
export declare function updateArticle(articleId: string, data: {
    title?: string;
    content?: string;
    category?: string;
    status?: number;
    fileUrl?: string;
    fileType?: string;
    sortOrder?: number;
}): Promise<{
    id: string;
    status: number;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    content: string | null;
    sortOrder: number;
    createdBy: string | null;
    title: string;
    category: string | null;
    fileUrl: string | null;
    fileType: string | null;
}>;
export declare function deleteArticle(articleId: string): Promise<{
    id: string;
    status: number;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    content: string | null;
    sortOrder: number;
    createdBy: string | null;
    title: string;
    category: string | null;
    fileUrl: string | null;
    fileType: string | null;
}>;
export declare function getArticleById(articleId: string): Promise<{
    id: string;
    status: number;
    createdAt: Date;
    updatedAt: Date;
    projectId: string;
    content: string | null;
    sortOrder: number;
    createdBy: string | null;
    title: string;
    category: string | null;
    fileUrl: string | null;
    fileType: string | null;
} | null>;
//# sourceMappingURL=knowledge-base.service.d.ts.map