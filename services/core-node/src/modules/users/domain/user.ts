export type UserType = "PASSAGEIRO" | "MOTORISTA" | "ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: UserType;
  active: boolean;
  createdAt: string;
}

export interface AuthUser extends User {
  passwordHash: string;
}

export interface RegisterUserInput {
  name: string;
  email: string;
  phone: string;
  password: string;
  type: UserType;
}

export interface LoginInput {
  login: string;
  password: string;
}

export interface SessionResult {
  token: string;
  expiresAt: string;
  user: User;
}

export interface UserRepository {
  findByEmail(email: string): Promise<AuthUser | null>;
  findByPhone(phone: string): Promise<AuthUser | null>;
  findById(id: string): Promise<User | null>;
  create(input: RegisterUserInput, passwordHash: string): Promise<User>;
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findUserBySessionToken(tokenHash: string): Promise<User | null>;
}
