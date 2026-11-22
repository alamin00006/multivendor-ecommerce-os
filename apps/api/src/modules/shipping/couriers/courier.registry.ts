import { Injectable, NotFoundException } from '@nestjs/common';
import { COURIER_PROVIDERS, type CourierProvider } from '@marketbd/shared';
import type { CourierAdapter } from './courier.adapter.js';
import { PathaoAdapter } from './pathao.adapter.js';
import { SteadfastAdapter } from './steadfast.adapter.js';

/** Looks up the adapter for a courier. Register new adapters here. */
@Injectable()
export class CourierRegistry {
  private readonly adapters: Record<CourierProvider, CourierAdapter>;

  constructor(pathao: PathaoAdapter, steadfast: SteadfastAdapter) {
    this.adapters = { PATHAO: pathao, STEADFAST: steadfast };
  }

  get(provider: CourierProvider): CourierAdapter {
    return this.adapters[provider];
  }

  /** Parses a route segment such as "pathao" into a provider code. */
  static parse(value: string): CourierProvider {
    const code = value.toUpperCase();
    if (!(COURIER_PROVIDERS as readonly string[]).includes(code)) throw new NotFoundException('Unknown courier');
    return code as CourierProvider;
  }
}
