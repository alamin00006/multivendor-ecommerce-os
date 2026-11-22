import { BadRequestException, Injectable } from '@nestjs/common';
import {
  COURIER_CATALOG,
  COURIER_PROVIDERS,
  type CourierAccountInput,
  CourierAccountSchema,
  type CourierAccountView,
  type CourierProvider,
} from '@marketbd/shared';
import { createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { openJson, sealJson } from '../../common/secret-box.js';
import type { CourierAccount } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { CourierContext, CourierCredentials } from './couriers/courier.adapter.js';
import { CourierRegistry } from './couriers/courier.registry.js';

const newSecret = () => randomBytes(24).toString('hex');
const webhookUrl = (provider: CourierProvider) => `${env.API_PUBLIC_URL}/api/v1/webhooks/${provider.toLowerCase()}`;

/** Courier accounts the admin manages in Admin → Couriers. Credentials are stored encrypted. */
@Injectable()
export class CourierAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: CourierRegistry,
  ) {}

  private credentialsOf(row: CourierAccount | null): CourierCredentials {
    if (!row?.credentials) return {};
    try {
      return openJson<CourierCredentials>(row.credentials);
    } catch {
      return {}; // key changed: the admin re-enters the credentials
    }
  }

  private missing(provider: CourierProvider, creds: CourierCredentials): string[] {
    return COURIER_CATALOG[provider].fields.filter((f) => !creds[f.key]).map((f) => f.label);
  }

  private view(provider: CourierProvider, row: CourierAccount | null): CourierAccountView {
    const entry = COURIER_CATALOG[provider];
    const creds = this.credentialsOf(row);
    return {
      provider,
      name: entry.name,
      enabled: row?.enabled ?? false,
      sandbox: row?.sandbox ?? false,
      hasSandbox: entry.hasSandbox,
      supportsStores: entry.supportsStores,
      credentials: Object.fromEntries(entry.fields.map((f) => [f.key, f.secret ? null : (creds[f.key] ?? '')])),
      configured: entry.fields.filter((f) => creds[f.key]).map((f) => f.key),
      webhookUrl: webhookUrl(provider),
      webhookSecret: row?.webhookSecret ?? '',
      updatedAt: row?.updatedAt.toISOString() ?? null,
    };
  }

  async list(): Promise<CourierAccountView[]> {
    const rows = await this.prisma.courierAccount.findMany();
    return COURIER_PROVIDERS.map((p) => this.view(p, rows.find((r) => r.provider === p) ?? null));
  }

  /** Saves a courier account. Blank credential fields keep their saved value. */
  async save(provider: CourierProvider, raw: CourierAccountInput): Promise<CourierAccountView> {
    const input = CourierAccountSchema.parse(raw);
    const entry = COURIER_CATALOG[provider];
    const row = await this.prisma.courierAccount.findUnique({ where: { provider } });
    const creds = this.credentialsOf(row);
    for (const f of entry.fields) {
      const v = input.credentials[f.key];
      if (v) creds[f.key] = v;
    }
    if (input.enabled) {
      const missing = this.missing(provider, creds);
      if (missing.length) throw new BadRequestException(`Fill in ${missing.join(', ')} before enabling ${entry.name}`);
    }
    const data = { enabled: input.enabled, sandbox: entry.hasSandbox && input.sandbox, credentials: sealJson(creds) };
    const saved = await this.prisma.courierAccount.upsert({
      where: { provider },
      create: { provider, webhookSecret: newSecret(), ...data },
      update: data,
    });
    return this.view(provider, saved);
  }

  async rotateWebhookSecret(provider: CourierProvider): Promise<CourierAccountView> {
    const saved = await this.prisma.courierAccount.upsert({
      where: { provider },
      create: { provider, webhookSecret: newSecret() },
      update: { webhookSecret: newSecret() },
    });
    return this.view(provider, saved);
  }

  /** Tries the saved credentials (even while the courier is switched off). */
  async test(provider: CourierProvider): Promise<{ message: string }> {
    const ctx = await this.context(provider, { requireEnabled: false });
    return { message: await this.registry.get(provider).testConnection(ctx) };
  }

  async enabledProviders(): Promise<CourierProvider[]> {
    const rows = await this.prisma.courierAccount.findMany({ where: { enabled: true }, select: { provider: true } });
    return COURIER_PROVIDERS.filter((p) => rows.some((r) => r.provider === p));
  }

  async webhookSecret(provider: CourierProvider): Promise<string | null> {
    const row = await this.prisma.courierAccount.findUnique({ where: { provider } });
    return row?.webhookSecret ?? null;
  }

  /** Credentials and environment for calling the courier. */
  async context(provider: CourierProvider, opts: { requireEnabled?: boolean } = {}): Promise<CourierContext> {
    const row = await this.prisma.courierAccount.findUnique({ where: { provider } });
    const name = COURIER_CATALOG[provider].name;
    if ((opts.requireEnabled ?? true) && !row?.enabled) throw new BadRequestException(`${name} is not enabled on this store`);
    const credentials = this.credentialsOf(row);
    const missing = this.missing(provider, credentials);
    if (missing.length) throw new BadRequestException(`${name} credentials are incomplete (${missing.join(', ')})`);
    const sandbox = row?.sandbox ?? false;
    const cacheKey = createHash('sha256').update(`${provider}:${sandbox}:${JSON.stringify(credentials)}`).digest('hex');
    return { credentials, sandbox, cacheKey };
  }
}
