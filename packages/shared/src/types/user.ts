export interface UserRow {
  id: string;
  username: string;
  name: string;
  organization: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserCreateRequest {
  username: string;
  name: string;
  password: string;
  organization: string;
}
