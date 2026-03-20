import { Response } from 'express';
export declare function sendSuccess<T>(res: Response, data: T, message?: string, statusCode?: number): void;
export declare function sendError(res: Response, message: string, statusCode?: number): void;
//# sourceMappingURL=response.d.ts.map