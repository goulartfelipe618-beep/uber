import { generateSessionToken, hashPassword, hashToken, verifyPassword } from "../../../shared/password";
import {
  LoginInput,
  RegisterUserInput,
  SessionResult,
  User,
  UserRepository,
  UserType,
} from "../domain/user";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export class UserService {
  constructor(private readonly repository: UserRepository) {}

  public async register(input: RegisterUserInput): Promise<SessionResult> {
    const name = requireText(input.name, "name");
    const email = requireText(input.email, "email");
    const phone = requireText(input.phone, "phone");
    const password = requireText(input.password, "password");
    const type = normalizeType(input.type);

    if (password.length < 6) {
      throw new Error("password must be at least 6 characters");
    }

    const existingEmail = await this.repository.findByEmail(email);
    if (existingEmail) {
      throw new Error("email already registered");
    }

    const existingPhone = await this.repository.findByPhone(phone);
    if (existingPhone) {
      throw new Error("phone already registered");
    }

    const user = await this.repository.create({ name, email, phone, password, type }, hashPassword(password));
    return this.issueSession(user.id);
  }

  public async login(input: LoginInput): Promise<SessionResult> {
    const login = requireText(input.login, "login");
    const password = requireText(input.password, "password");
    const user = login.includes("@")
      ? await this.repository.findByEmail(login)
      : await this.repository.findByPhone(login);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new Error("invalid credentials");
    }

    if (!user.active) {
      throw new Error("account inactive");
    }

    return this.issueSession(user.id);
  }

  public async me(token: string): Promise<User> {
    const user = await this.repository.findUserBySessionToken(hashToken(token));
    if (!user) {
      throw new Error("unauthorized");
    }

    return user;
  }

  private async issueSession(userId: string): Promise<SessionResult> {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await this.repository.createSession(userId, hashToken(token), expiresAt);

    const user = await this.repository.findById(userId);
    if (!user) {
      throw new Error("user not found");
    }

    return { token, expiresAt: expiresAt.toISOString(), user };
  }
}

function normalizeType(value: UserType): UserType {
  if (value !== "PASSAGEIRO" && value !== "MOTORISTA" && value !== "ADMIN") {
    throw new Error("type must be PASSAGEIRO, MOTORISTA or ADMIN");
  }

  return value;
}

function requireText(value: string | undefined, field: string): string {
  const text = (value ?? "").trim();
  if (!text) {
    throw new Error(`${field} is required`);
  }

  return text;
}
