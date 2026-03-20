export interface RegisterInput {
    displayName: string;
    email: string;
    password: string;
}
export interface LoginInput {
    email: string;
    password: string;
}
export declare function register(input: RegisterInput): Promise<{
    token: string;
    user: {
        id: string;
        displayName: string;
        email: string;
        avatarUrl: string | null;
        createdAt: Date;
    };
}>;
export declare function login(input: LoginInput): Promise<{
    token: string;
    user: {
        id: string;
        displayName: string;
        email: string;
        avatarUrl: string | null;
        createdAt: Date;
    };
}>;
export declare function getProfile(userId: string): Promise<{
    id: string;
    displayName: string;
    email: string;
    avatarUrl: string | null;
    createdAt: Date;
}>;
//# sourceMappingURL=auth.service.d.ts.map