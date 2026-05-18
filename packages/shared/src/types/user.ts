export interface UserRow {
  id: string;
  username: string;
  organization: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserCreateRequest {
  username: string;
  password: string;
  organization: string;
}
