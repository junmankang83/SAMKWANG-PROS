export interface AuthUser {
  id: string;
  username: string;
  organization?: string;
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
