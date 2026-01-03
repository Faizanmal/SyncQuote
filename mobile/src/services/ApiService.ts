import axios, {AxiosInstance, AxiosRequestConfig, AxiosResponse} from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';
import {ApiResponse, PaginatedResponse} from '@types/index';
import {showToast} from '@utils/toast';

class ApiService {
  private instance: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = Config.API_BASE_URL || 'https://api.syncquote.com';
    
    this.instance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.instance.interceptors.request.use(
      async (config) => {
        const token = await AsyncStorage.getItem('auth_token');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();
        
        console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`, {
          headers: config.headers,
          data: config.data,
        });
        
        return config;
      },
      (error) => {
        console.error('❌ Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => {
        console.log(`✅ API Response: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
          status: response.status,
          data: response.data,
        });
        return response;
      },
      async (error) => {
        console.error(`❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
        });

        // Handle token expiration
        if (error.response?.status === 401) {
          const refreshToken = await AsyncStorage.getItem('refresh_token');
          
          if (refreshToken && !error.config.url?.includes('/auth/refresh')) {
            try {
              const response = await this.post('/auth/refresh', {refreshToken});
              
              if (response.success) {
                const {token} = response.data;
                await AsyncStorage.setItem('auth_token', token);
                
                // Retry original request
                error.config.headers.Authorization = `Bearer ${token}`;
                return this.instance.request(error.config);
              }
            } catch (refreshError) {
              console.error('Token refresh failed:', refreshError);
              await this.handleAuthFailure();
            }
          } else {
            await this.handleAuthFailure();
          }
        }

        // Handle network errors
        if (!error.response) {
          showToast('error', 'Network Error', 'Please check your internet connection');
        }

        return Promise.reject(error);
      }
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async handleAuthFailure(): Promise<void> {
    await AsyncStorage.multiRemove(['auth_token', 'refresh_token', 'user_data']);
    showToast('error', 'Session Expired', 'Please log in again');
    // Note: Navigation would be handled by the auth context
  }

  // Generic request method
  private async request<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
    try {
      const response = await this.instance.request<ApiResponse<T>>(config);
      return response.data;
    } catch (error: any) {
      if (error.response?.data) {
        return error.response.data;
      }
      
      return {
        success: false,
        data: null as any,
        error: error.message || 'An unexpected error occurred',
      };
    }
  }

  // GET request
  async get<T>(url: string, params?: any): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'GET',
      url,
      params,
    });
  }

  // POST request
  async post<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'POST',
      url,
      data,
    });
  }

  // PUT request
  async put<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PUT',
      url,
      data,
    });
  }

  // PATCH request
  async patch<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'PATCH',
      url,
      data,
    });
  }

  // DELETE request
  async delete<T>(url: string): Promise<ApiResponse<T>> {
    return this.request<T>({
      method: 'DELETE',
      url,
    });
  }

  // File upload
  async upload<T>(url: string, file: any, onProgress?: (progress: number) => void): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append('file', {
      uri: file.uri,
      type: file.type,
      name: file.name,
    } as any);

    return this.request<T>({
      method: 'POST',
      url,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress);
        }
      },
    });
  }

  // Paginated request
  async getPaginated<T>(
    url: string,
    page: number = 1,
    limit: number = 20,
    params?: any
  ): Promise<ApiResponse<PaginatedResponse<T>>> {
    return this.get<PaginatedResponse<T>>(url, {
      page,
      limit,
      ...params,
    });
  }

  // Download file
  async download(url: string, onProgress?: (progress: number) => void): Promise<Blob> {
    const response = await this.instance.get(url, {
      responseType: 'blob',
      onDownloadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(progress);
        }
      },
    });

    return response.data;
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.get('/health');
      return response.success;
    } catch (error) {
      return false;
    }
  }

  // Get base URL
  getBaseURL(): string {
    return this.baseURL;
  }

  // Update base URL (for environment switching)
  updateBaseURL(newBaseURL: string): void {
    this.baseURL = newBaseURL;
    this.instance.defaults.baseURL = newBaseURL;
  }
}

export const apiService = new ApiService();