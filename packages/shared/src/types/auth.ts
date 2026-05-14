export interface AuthLoginRequest {
  username: string;
  password: string;
}

export interface AuthLoginResponse {
  ok: boolean;
  user: { id: string; username: string };
}

export interface AuthMeResponse {
  user: { id: string; username: string };
}

export interface AuthLogoutResponse {
  ok: boolean;
}
