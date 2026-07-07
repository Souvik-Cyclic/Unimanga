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

