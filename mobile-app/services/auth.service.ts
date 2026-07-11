import axios, { AxiosError } from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "../config/env";

const API_URL = `${API_BASE_URL}/api/auth`;

interface AuthResponse {
  message: string;
  token: string;
  user?: any;
  existingUser?: any;
}

interface ApiError {
  message: string;
}

interface ProfileResponse {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

interface UpdateProfileResponse {
  message: string;
  user: ProfileResponse;
}

export const authService = {
  async register(
    username: string,
    email: string,
    password: string,
  ): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(`${API_URL}/register`, {
        username,
        email,
        password,
      });

      if (response.data.token) {
        await AsyncStorage.setItem("token", response.data.token);
        await AsyncStorage.setItem("user", JSON.stringify(response.data.user));
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiError;
        throw apiError?.message || "Registration failed";
      }
      throw "Registration failed";
    }
  },

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await axios.post<AuthResponse>(`${API_URL}/login`, {
        email,
        password,
      });

      if (response.data.token) {
        await AsyncStorage.setItem("token", response.data.token);
        await AsyncStorage.setItem(
          "user",
          JSON.stringify(response.data.existingUser),
        );
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiError;
        throw apiError?.message || "Login failed";
      }
      throw "Login failed";
    }
  },

  async logout(): Promise<void> {
    try {
      await AsyncStorage.removeItem("token");
      await AsyncStorage.removeItem("user");
    } catch (error) {
      console.log("Logout error:", error);
    }
  },

  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem("token");
    } catch (error) {
      return null;
    }
  },

  async getUser(): Promise<any | null> {
    try {
      const userStr = await AsyncStorage.getItem("user");
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      return null;
    }
  },

  async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  },

  async getProfile(): Promise<ProfileResponse> {
    try {
      const token = await this.getToken();
      const response = await axios.get<ProfileResponse>(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiError;
        throw apiError?.message || "Failed to load profile";
      }
      throw "Failed to load profile";
    }
  },

  async updateProfile(data: {
    username?: string;
    email?: string;
  }): Promise<UpdateProfileResponse> {
    try {
      const token = await this.getToken();
      const response = await axios.put<UpdateProfileResponse>(
        `${API_URL}/profile`,
        data,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (response.data.user) {
        await AsyncStorage.setItem("user", JSON.stringify(response.data.user));
      }

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiError;
        throw apiError?.message || "Profile update failed";
      }
      throw "Profile update failed";
    }
  },

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    try {
      const token = await this.getToken();
      const response = await axios.put<{ message: string }>(
        `${API_URL}/password`,
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiError;
        throw apiError?.message || "Password change failed";
      }
      throw "Password change failed";
    }
  },

  async deleteAccount(password: string): Promise<{ message: string }> {
    try {
      const token = await this.getToken();
      const response = await axios.delete<{ message: string }>(
        `${API_URL}/account`,
        {
          headers: { Authorization: `Bearer ${token}` },
          data: { password },
        },
      );

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const apiError = error.response?.data as ApiError;
        throw apiError?.message || "Account deletion failed";
      }
      throw "Account deletion failed";
    }
  },
};
