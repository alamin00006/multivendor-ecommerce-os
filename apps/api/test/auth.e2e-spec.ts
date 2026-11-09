import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { API, createTestApp, type TestContext } from './helpers.js';

interface AuthBody {
  data: { user: { id: string; email: string | null; phone: string | null; role: string }; tokens: { accessToken: string; refreshToken: string } };
}

describe('Auth (e2e)', () => {
  let ctx: TestContext;
  const email = `e2e-${Date.now()}@marketbd.example`;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  it('registers, signs in and reads the profile', async () => {
    const reg = await ctx
      .http()
      .post(`${API}/auth/register`)
      .send({ name: 'E2E User', email, password: 'Passw0rd!' })
      .expect(201);
    const body = reg.body as AuthBody & { success: boolean };
    expect(body.success).toBe(true);
    expect(body.data.user.role).toBe('CUSTOMER');
    expect(reg.headers['set-cookie']?.[0]).toContain('mbd_rt=');

    const login = await ctx.http().post(`${API}/auth/login`).send({ email, password: 'Passw0rd!' }).expect(200);
    const token = (login.body as AuthBody).data.tokens.accessToken;
    const me = await ctx.http().get(`${API}/users/me`).set('Authorization', `Bearer ${token}`).expect(200);
    expect((me.body as { data: { email: string } }).data.email).toBe(email);
  });

  it('rejects duplicate emails, bad passwords and invalid payloads', async () => {
    await ctx.http().post(`${API}/auth/register`).send({ name: 'Dup', email, password: 'Passw0rd!' }).expect(409);
    await ctx.http().post(`${API}/auth/login`).send({ email, password: 'wrong-pass1' }).expect(401);
    const invalid = await ctx.http().post(`${API}/auth/register`).send({ name: 'X', email: 'nope', password: 'short' }).expect(400);
    expect((invalid.body as { errors: unknown[] }).errors.length).toBeGreaterThan(0);
  });

  it('rotates refresh tokens and revokes the family on reuse', async () => {
    const login = await ctx.http().post(`${API}/auth/login`).send({ email, password: 'Passw0rd!' }).expect(200);
    const first = (login.body as AuthBody).data.tokens.refreshToken;

    const rotated = await ctx.http().post(`${API}/auth/refresh`).send({ refreshToken: first }).expect(200);
    const second = (rotated.body as AuthBody).data.tokens.refreshToken;
    expect(second).not.toBe(first);

    // Replaying the old token is treated as theft: both tokens die.
    await ctx.http().post(`${API}/auth/refresh`).send({ refreshToken: first }).expect(401);
    await ctx.http().post(`${API}/auth/refresh`).send({ refreshToken: second }).expect(401);
  });

  it('signs in with a phone OTP and creates the account on first use', async () => {
    const phone = `+88017${String(Date.now()).slice(-8)}`;
    await ctx.http().post(`${API}/auth/otp/request`).send({ phone }).expect(200);
    const code = ctx.otp.codes.get(phone);
    expect(code).toMatch(/^\d{6}$/);

    await ctx.http().post(`${API}/auth/otp/verify`).send({ phone, code: code === '000000' ? '111111' : '000000' }).expect(400);
    const ok = await ctx.http().post(`${API}/auth/otp/verify`).send({ phone, code, name: 'OTP User' }).expect(200);
    expect((ok.body as AuthBody).data.user.phone).toBe(phone);

    // A code can be used only once.
    await ctx.http().post(`${API}/auth/otp/verify`).send({ phone, code }).expect(400);
  });

  it('protects private routes and enforces roles', async () => {
    await ctx.http().get(`${API}/users/me`).expect(401);
    const login = await ctx.http().post(`${API}/auth/login`).send({ email, password: 'Passw0rd!' }).expect(200);
    const token = (login.body as AuthBody).data.tokens.accessToken;
    await ctx.http().get(`${API}/admin/dashboard`).set('Authorization', `Bearer ${token}`).expect(403);
  });
});
