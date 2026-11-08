import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

/**
 * Sign in with fingerprint from a saved profile.
 *
 * - Syncro desktop app on Mac: Touch ID (asked by the app itself) unlocks a secret that the app
 *   keeps encrypted in the Mac's keychain. Syncro stores only a hash of that secret (DEVICE_TOKEN).
 * - Everywhere else (Windows Hello, Touch ID in Chrome): a WebAuthn passkey bound to that computer
 *   (PASSKEY). Syncro stores only its public key.
 *
 * Fingerprints never reach Syncro: the operating system checks them and answers yes or no.
 */
const MAX_PER_USER = 10;
const CHALLENGE_TTL = 5 * 60_000;

type Challenge = { challenge: string; rpID: string; origin: string; userId: string | null; at: number };

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
const b64url = {
  encode: (u: Uint8Array) => Buffer.from(u).toString('base64url'),
  decode: (s: string) => new Uint8Array(Buffer.from(s, 'base64url')),
};

@Injectable()
export class BiometricService {
  private challenges = new Map<string, Challenge>();

  constructor(
    private prisma: PrismaService,
    private auth: AuthService,
  ) {}

  /** The page asking (https, or localhost while developing). Its host is the passkey's domain. */
  private site(origin?: string) {
    try {
      const u = new URL(String(origin || ''));
      const local = ['localhost', '127.0.0.1'].includes(u.hostname);
      if (u.protocol !== 'https:' && !(local && u.protocol === 'http:')) throw new Error();
      return { origin: u.origin, rpID: u.hostname };
    } catch {
      throw new BadRequestException('Origen no válido para el acceso con huella');
    }
  }

  private remember(key: string, c: Omit<Challenge, 'at'>) {
    const now = Date.now();
    for (const [k, v] of this.challenges) if (now - v.at > CHALLENGE_TTL) this.challenges.delete(k);
    this.challenges.set(key, { ...c, at: now });
  }

  private take(key: string) {
    const c = this.challenges.get(key);
    this.challenges.delete(key);
    if (!c || Date.now() - c.at > CHALLENGE_TTL) throw new UnauthorizedException('La solicitud venció. Inténtalo de nuevo');
    return c;
  }

  private cleanName(name: unknown) {
    return String(name || 'Esta computadora').replace(/\s+/g, ' ').trim().slice(0, 60) || 'Esta computadora';
  }

  private async roomFor(userId: string) {
    const n = await this.prisma.biometricCredential.count({ where: { userId } });
    if (n >= MAX_PER_USER) throw new BadRequestException('Ya tienes demasiadas computadoras con huella. Quita alguna en Configuración');
  }

  private async userFor(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('No se pudo entrar con huella');
    return user;
  }

  // ── Your computers ─────────────────────────────────────────────────────────

  list(userId: string) {
    return this.prisma.biometricCredential.findMany({
      where: { userId },
      select: { id: true, kind: true, deviceName: true, platform: true, createdAt: true, lastUsedAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(userId: string, id: string) {
    const r = await this.prisma.biometricCredential.deleteMany({ where: { id, userId } });
    if (!r.count) throw new NotFoundException('No encontrado');
    return { ok: true };
  }

  // ── Syncro desktop on Mac: Touch ID + a secret in the keychain ────────────

  async registerDeviceToken(userId: string, body: { deviceName?: string; platform?: string }) {
    await this.roomFor(userId);
    const secret = randomBytes(32).toString('base64url');
    const row = await this.prisma.biometricCredential.create({
      data: { userId, kind: 'DEVICE_TOKEN', deviceName: this.cleanName(body?.deviceName), platform: String(body?.platform || 'mac').slice(0, 30), secretHash: sha256(secret) },
    });
    return { id: row.id, secret };
  }

  async loginDeviceToken(body: { id?: string; secret?: string }) {
    const fail = new UnauthorizedException('No se pudo entrar con huella. Usa tu contraseña');
    if (typeof body?.id !== 'string' || typeof body?.secret !== 'string') throw fail;
    const row = await this.prisma.biometricCredential.findUnique({ where: { id: body.id } });
    if (!row || row.kind !== 'DEVICE_TOKEN' || !row.secretHash) throw fail;
    const a = Buffer.from(sha256(body.secret), 'hex');
    const b = Buffer.from(row.secretHash, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) throw fail;
    await this.prisma.biometricCredential.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
    return this.auth.login(await this.userFor(row.userId));
  }

  // ── Passkeys (WebAuthn): Windows Hello, Touch ID in Chrome ─────────────────

  async passkeyRegisterOptions(userId: string, origin?: string) {
    await this.roomFor(userId);
    const site = this.site(origin);
    const user = await this.userFor(userId);
    const existing = await this.prisma.biometricCredential.findMany({ where: { userId, kind: 'PASSKEY' }, select: { credentialId: true, transports: true } });
    const options = await generateRegistrationOptions({
      rpName: 'Syncro',
      rpID: site.rpID,
      userName: user.email,
      userDisplayName: user.name || user.email,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials: existing.filter((c) => c.credentialId).map((c) => ({ id: c.credentialId!, transports: c.transports as any })),
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
    });
    this.remember(`reg:${userId}`, { challenge: options.challenge, ...site, userId });
    return options;
  }

  async passkeyRegisterVerify(userId: string, body: { response?: any; deviceName?: string; platform?: string }) {
    const c = this.take(`reg:${userId}`);
    let verified;
    try {
      verified = await verifyRegistrationResponse({
        response: body?.response,
        expectedChallenge: c.challenge,
        expectedOrigin: c.origin,
        expectedRPID: c.rpID,
        requireUserVerification: true,
      });
    } catch {
      throw new BadRequestException('No se pudo confirmar con la huella');
    }
    if (!verified.verified || !verified.registrationInfo) throw new BadRequestException('No se pudo confirmar con la huella');
    const cred = verified.registrationInfo.credential;
    const row = await this.prisma.biometricCredential.create({
      data: {
        userId,
        kind: 'PASSKEY',
        deviceName: this.cleanName(body?.deviceName),
        platform: String(body?.platform || '').slice(0, 30) || null,
        credentialId: cred.id,
        publicKey: b64url.encode(cred.publicKey),
        counter: cred.counter,
        transports: (cred.transports ?? []) as string[],
      },
    });
    return { id: row.id, credentialId: cred.id };
  }

  /** Options to sign in as the saved profile with this email. Never says whether the account exists. */
  async passkeyLoginOptions(body: { email?: string }, origin?: string) {
    const site = this.site(origin);
    const email = String(body?.email || '').trim().toLowerCase().slice(0, 200);
    const user = email ? await this.prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } }) : null;
    const creds = user ? await this.prisma.biometricCredential.findMany({ where: { userId: user.id, kind: 'PASSKEY' }, select: { credentialId: true, transports: true } }) : [];
    const options = await generateAuthenticationOptions({
      rpID: site.rpID,
      userVerification: 'required',
      allowCredentials: creds.filter((c) => c.credentialId).map((c) => ({ id: c.credentialId!, transports: c.transports as any })),
    });
    const challengeId = randomUUID();
    this.remember(`auth:${challengeId}`, { challenge: options.challenge, ...site, userId: user?.id ?? null });
    return { options, challengeId };
  }

  async passkeyLoginVerify(body: { challengeId?: string; response?: any }) {
    const fail = new UnauthorizedException('No se pudo entrar con huella. Usa tu contraseña');
    const c = this.take(`auth:${String(body?.challengeId || '')}`);
    const credentialId = body?.response?.id;
    if (typeof credentialId !== 'string') throw fail;
    const row = await this.prisma.biometricCredential.findUnique({ where: { credentialId } });
    if (!row || row.kind !== 'PASSKEY' || !row.publicKey || (c.userId && row.userId !== c.userId)) throw fail;
    let verified;
    try {
      verified = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge: c.challenge,
        expectedOrigin: c.origin,
        expectedRPID: c.rpID,
        requireUserVerification: true,
        credential: { id: row.credentialId!, publicKey: b64url.decode(row.publicKey), counter: row.counter, transports: row.transports as any },
      });
    } catch {
      throw fail;
    }
    if (!verified.verified) throw fail;
    await this.prisma.biometricCredential.update({ where: { id: row.id }, data: { counter: verified.authenticationInfo.newCounter, lastUsedAt: new Date() } });
    return this.auth.login(await this.userFor(row.userId));
  }

  /** A new password ends every fingerprint sign-in of that person (they enable it again). */
  revokeAll(userId: string) {
    return this.prisma.biometricCredential.deleteMany({ where: { userId } });
  }
}
