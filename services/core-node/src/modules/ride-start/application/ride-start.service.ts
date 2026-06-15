import { createHmac, randomInt } from "node:crypto";

export interface IssueStartCodesResult {
  rideId: string;
  passengerCode: string;
  driverCode: string;
  expiresAt: string;
  reissueCount: number;
}

export interface ValidateStartCodeInput {
  rideId: string;
  role: "PASSENGER" | "DRIVER";
  code: string;
  counterpartCode?: string;
}

export interface ValidateStartCodeResult {
  rideId: string;
  role: "PASSENGER" | "DRIVER";
  validated: boolean;
  rideStarted: boolean;
  message: string;
}

export interface RideStartRepository {
  deactivateActiveCodes(rideId: string): Promise<void>;
  createCodePair(input: {
    rideId: string;
    passengerCodeHash: string;
    driverCodeHash: string;
    expiresAt: Date;
    reissueCount: number;
  }): Promise<string>;
  getActivePair(rideId: string): Promise<{
    id: string;
    passengerCodeHash: string;
    driverCodeHash: string;
    expiresAt: Date;
    passengerValidatedAt: Date | null;
    driverValidatedAt: Date | null;
    passengerAttempts: number;
    driverAttempts: number;
    reissueCount: number;
  } | null>;
  recordAttempt(rideId: string, codePairId: string | null, role: "PASSENGER" | "DRIVER", success: boolean): Promise<void>;
  incrementAttempts(codePairId: string, role: "PASSENGER" | "DRIVER"): Promise<number>;
  markValidated(codePairId: string, role: "PASSENGER" | "DRIVER"): Promise<void>;
  markRideInProgress(rideId: string): Promise<void>;
  countReissues(rideId: string): Promise<number>;
}

export class RideStartService {
  constructor(
    private readonly repository: RideStartRepository,
    private readonly secret: string,
  ) {}

  public async issueCodes(rideId: string): Promise<IssueStartCodesResult> {
    if (!rideId) {
      throw new Error("rideId is required");
    }

    const reissueCount = await this.repository.countReissues(rideId);
    if (reissueCount >= 3) {
      throw new Error("maximum reissue count reached");
    }

    await this.repository.deactivateActiveCodes(rideId);

    const passengerCode = generateCode();
    const driverCode = generateCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await this.repository.createCodePair({
      rideId,
      passengerCodeHash: hashCode(passengerCode, rideId, "PASSENGER", this.secret),
      driverCodeHash: hashCode(driverCode, rideId, "DRIVER", this.secret),
      expiresAt,
      reissueCount,
    });

    return {
      rideId,
      passengerCode,
      driverCode,
      expiresAt: expiresAt.toISOString(),
      reissueCount,
    };
  }

  public async validate(input: ValidateStartCodeInput): Promise<ValidateStartCodeResult> {
    const rideId = (input.rideId ?? "").trim();
    const code = (input.code ?? "").trim();
    const role = input.role;

    if (!rideId || !code) {
      throw new Error("rideId and code are required");
    }
    if (role !== "PASSENGER" && role !== "DRIVER") {
      throw new Error("role must be PASSENGER or DRIVER");
    }

    const pair = await this.repository.getActivePair(rideId);
    if (!pair) {
      throw new Error("no active start codes for ride");
    }

    if (pair.expiresAt.getTime() < Date.now()) {
      throw new Error("start codes expired");
    }

    const expectedHash = hashCode(code, rideId, role, this.secret);
    const targetHash = role === "PASSENGER" ? pair.passengerCodeHash : pair.driverCodeHash;
    const attempts = await this.repository.incrementAttempts(pair.id, role);

    if (expectedHash !== targetHash) {
      await this.repository.recordAttempt(rideId, pair.id, role, false);
      if (attempts >= 5) {
        return {
          rideId,
          role,
          validated: false,
          rideStarted: false,
          message: "too many failed attempts, cooldown activated",
        };
      }
      return {
        rideId,
        role,
        validated: false,
        rideStarted: false,
        message: "invalid code",
      };
    }

    await this.repository.markValidated(pair.id, role);
    await this.repository.recordAttempt(rideId, pair.id, role, true);

    const refreshed = await this.repository.getActivePair(rideId);
    const passengerOk = refreshed?.passengerValidatedAt !== null;
    const driverOk = refreshed?.driverValidatedAt !== null;

    if (passengerOk && driverOk) {
      await this.repository.markRideInProgress(rideId);
      return {
        rideId,
        role,
        validated: true,
        rideStarted: true,
        message: "ride started",
      };
    }

    return {
      rideId,
      role,
      validated: true,
      rideStarted: false,
      message: "waiting counterpart validation",
    };
  }
}

export function hashCode(code: string, rideId: string, role: string, secret: string): string {
  return createHmac("sha256", secret).update(`${code}:${rideId}:${role}`).digest("hex");
}

function generateCode(): string {
  return String(randomInt(100000, 999999));
}
