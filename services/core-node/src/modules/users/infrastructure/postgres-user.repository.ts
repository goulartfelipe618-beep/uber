import { Pool } from "pg";
import { AuthUser, RegisterUserInput, User, UserRepository, UserType } from "../domain/user";

type UserRow = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  tipo: string;
  ativo: boolean;
  criado_em: Date;
  senha_hash?: string;
};

export class PostgresUserRepository implements UserRepository {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: connectionString.includes("sslmode=") ? undefined : { rejectUnauthorized: false },
    });
  }

  public async findByEmail(email: string): Promise<AuthUser | null> {
    const result = await this.pool.query<UserRow>(
      `select id, nome, email, telefone, tipo, ativo, senha_hash, criado_em from usuarios where lower(email) = lower($1) limit 1`,
      [email.trim()],
    );

    return result.rows.length ? mapAuthRow(result.rows[0]) : null;
  }

  public async findByPhone(phone: string): Promise<AuthUser | null> {
    const normalized = phone.replace(/\D/g, "");
    const result = await this.pool.query<UserRow>(
      `select id, nome, email, telefone, tipo, ativo, senha_hash, criado_em from usuarios where regexp_replace(telefone, '[^0-9]', '', 'g') = $1 limit 1`,
      [normalized],
    );

    return result.rows.length ? mapAuthRow(result.rows[0]) : null;
  }

  public async findById(id: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `select id, nome, email, telefone, tipo, ativo, criado_em from usuarios where id = $1 limit 1`,
      [id],
    );

    return result.rows.length ? mapRow(result.rows[0]) : null;
  }

  public async create(input: RegisterUserInput, passwordHash: string): Promise<User> {
    const result = await this.pool.query<UserRow>(
      `
      insert into usuarios (nome, email, telefone, senha_hash, tipo)
      values ($1, $2, $3, $4, $5)
      returning id, nome, email, telefone, tipo, ativo, criado_em
      `,
      [input.name, input.email.trim().toLowerCase(), input.phone.trim(), passwordHash, input.type],
    );

    return mapRow(result.rows[0]);
  }

  public async createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.pool.query(
      `insert into user_sessions (user_id, token_hash, expires_at) values ($1, $2, $3)`,
      [userId, tokenHash, expiresAt],
    );
  }

  public async findUserBySessionToken(tokenHash: string): Promise<User | null> {
    const result = await this.pool.query<UserRow>(
      `
      select u.id, u.nome, u.email, u.telefone, u.tipo, u.ativo, u.criado_em
      from user_sessions s
      join usuarios u on u.id = s.user_id
      where s.token_hash = $1
        and s.revoked_at is null
        and s.expires_at > now()
        and u.ativo = true
      limit 1
      `,
      [tokenHash],
    );

    return result.rows.length ? mapRow(result.rows[0]) : null;
  }
}

function mapRow(row: UserRow): User {
  return {
    id: String(row.id),
    name: String(row.nome),
    email: String(row.email),
    phone: String(row.telefone),
    type: String(row.tipo) as UserType,
    active: Boolean(row.ativo),
    createdAt: new Date(row.criado_em).toISOString(),
  };
}

function mapAuthRow(row: UserRow): AuthUser {
  return { ...mapRow(row), passwordHash: String(row.senha_hash) };
}
