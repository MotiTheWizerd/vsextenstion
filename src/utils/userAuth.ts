import { SessionManager } from "./sessionManager";

export interface LoginResponse {
  user_id: string;
  username?: string;
  email?: string;
  token?: string;
  expires_at?: string;
}

export interface LoginCredentials {
  username?: string;
  email?: string;
  password: string;
}

export class UserAuth {
  private static instance: UserAuth;
  private authToken: string | null = null;
  private userInfo: Partial<LoginResponse> | null = null;

  private constructor() {}

  public static getInstance(): UserAuth {
    if (!UserAuth.instance) {
      UserAuth.instance = new UserAuth();
    }
    return UserAuth.instance;
  }

  /**
   * Handle successful login response from server
   */
  public handleLoginSuccess(loginResponse: LoginResponse): void {
    console.log("[UserAuth] Processing login response");

    // Validate required fields
    if (!loginResponse.user_id) {
      throw new Error("Login response missing required user_id field");
    }

    // Store user info
    this.userInfo = loginResponse;
    this.authToken = loginResponse.token || null;

    // Set user ID in session manager
    const sessionManager = SessionManager.getInstance();
    sessionManager.setUserId(loginResponse.user_id);

    console.log(`[UserAuth] User logged in successfully: ${loginResponse.user_id}`);
    if (loginResponse.username) {
      console.log(`[UserAuth] Username: ${loginResponse.username}`);
    }
    if (loginResponse.email) {
      console.log(`[UserAuth] Email: ${loginResponse.email}`);
    }
  }

  /**
   * Logout user and clear all auth data
   */
  public logout(): void {
    console.log("[UserAuth] Logging out user");

    // Clear auth data
    this.authToken = null;
    this.userInfo = null;

    // Reset user in session manager
    const sessionManager = SessionManager.getInstance();
    sessionManager.logoutUser();

    console.log("[UserAuth] User logged out successfully");
  }

  /**
   * Check if user is currently authenticated
   */
  public isAuthenticated(): boolean {
    const sessionManager = SessionManager.getInstance();
    return sessionManager.isUserLoggedIn() && this.userInfo !== null;
  }

  /**
   * Get current user info
   */
  public getUserInfo(): Partial<LoginResponse> | null {
    return this.userInfo;
  }

  /**
   * Get current auth token
   */
  public getAuthToken(): string | null {
    return this.authToken;
  }

  /**
   * Get current user ID
   */
  public getUserId(): string {
    const sessionManager = SessionManager.getInstance();
    return sessionManager.getUserId();
  }

  /**
   * Check if auth token is expired
   */
  public isTokenExpired(): boolean {
    if (!this.userInfo?.expires_at) {
      return false; // No expiration set
    }

    const expirationTime = new Date(this.userInfo.expires_at);
    const currentTime = new Date();

    return currentTime > expirationTime;
  }

  /**
   * Get headers for authenticated API requests
   */
  public getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.authToken) {
      headers["Authorization"] = `Bearer ${this.authToken}`;
    }

    return headers;
  }

  /**
   * Validate login credentials format
   */
  public static validateCredentials(credentials: LoginCredentials): string[] {
    const errors: string[] = [];

    if (!credentials.password || credentials.password.length < 1) {
      errors.push("Password is required");
    }

    if (!credentials.username && !credentials.email) {
      errors.push("Either username or email is required");
    }

    if (credentials.email && !UserAuth.isValidEmail(credentials.email)) {
      errors.push("Invalid email format");
    }

    return errors;
  }

  /**
   * Basic email validation
   */
  private static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Create a sample login request payload
   */
  public static createLoginPayload(credentials: LoginCredentials): object {
    return {
      username: credentials.username,
      email: credentials.email,
      password: credentials.password,
      client: "raydaemon-vscode",
      version: "1.2.2",
    };
  }

  /**
   * Handle login error response
   */
  public handleLoginError(error: any): string {
    console.error("[UserAuth] Login failed:", error);

    if (error.response?.data?.message) {
      return error.response.data.message;
    }

    if (error.message) {
      return error.message;
    }

    return "Login failed. Please check your credentials and try again.";
  }

  /**
   * Get user status summary for debugging
   */
  public getStatusSummary(): object {
    return {
      authenticated: this.isAuthenticated(),
      user_id: this.getUserId(),
      username: this.userInfo?.username || null,
      email: this.userInfo?.email || null,
      has_token: !!this.authToken,
      token_expired: this.isTokenExpired(),
    };
  }
}
