import { apiClient } from "./api";
import type { User } from "@/types";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface LoginResponse {
  success?: boolean;
  accessToken: string;
  refreshToken?: string;
  user: User;
}

export interface AuthResponse {
  success?: boolean;
  message?: string;
  accessToken?: string;
  refreshToken?: string;
  user: User;
}

export const authService = {
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    return apiClient.post<LoginResponse>("/api/auth/login", credentials);
  },

  async register(data: RegisterRequest): Promise<AuthResponse> {
    return apiClient.post<AuthResponse>("/api/auth/register", data);
  },

  async getProfile(): Promise<User> {
    const response = await apiClient.get<{ success: boolean; user: User }>(
      "/api/auth/profile"
    );
    return response.user;
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    return apiClient.put<User>("/api/users/profile", data);
  },

  async refreshToken(): Promise<{ accessToken: string }> {
    return apiClient.post<{ accessToken: string }>("/api/auth/refresh");
  },

  async logout(): Promise<void> {
    return apiClient.post<void>("/api/auth/logout");
  },
};
