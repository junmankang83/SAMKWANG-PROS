export interface AuthUser {
  id: string;
  username: string;
  name?: string;
  organization?: string;
}

export interface AuthChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface AuthChangePasswordResponse {
  ok: boolean;
}

export interface AuthLoginRequest {
  username: string;
  password: string;
}

export interface AuthLoginResponse {
  ok: boolean;
  user: AuthUser;
}

export interface AuthRegisterRequest {
  username: string;
  password: string;
  organization: string;
}

export interface AuthRegisterResponse {
  ok: boolean;
  user: AuthUser;
}

export interface AuthMeResponse {
  user: AuthUser;
}

export interface AuthLogoutResponse {
  ok: boolean;
}
