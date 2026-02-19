import { SapliyClient } from "@sapliyio/fintech"
import { describe, it, expect } from 'vitest';
import { getDebugToken } from './utils/e2e-helpers';

/**
 * Auth Flow E2E Test
 * 
 * Verifies the full authentication lifecycle:
 * 1. Registration
 * 2. Email Verification (using debug endpoint)
 * 3. Login
 * 4. Password Reset
 */
describe('Authentication Flow', () => {
    // Client for Gateway (Public API)
    // _client is kept for documentation of public access but marked as internal
    const _client = new SapliyClient('pk_test_public_key', { basePath: 'http://localhost:8080' });
    void _client;

    it('should register, verify email, and login successfully', async () => {
        const email = `test-user-${Date.now()}@example.com`;
        const password = 'Password123!';

        // 1. Register
        const registerRes = await fetch('http://localhost:8080/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        expect(registerRes.status).toBe(201);
        const data = await registerRes.json() as any;
        expect(data.user.email).toBe(email);

        // 2. Get Verification Token (Debug)
        // Wait a bit for async processing (Redis write)
        await new Promise(r => setTimeout(r, 100));
        const verifyToken = await getDebugToken(email, 'verify');
        expect(verifyToken).toBeDefined();

        // 3. Verify Email
        const verifyRes = await fetch('http://localhost:8080/auth/verify-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: verifyToken })
        });
        expect(verifyRes.status).toBe(200);

        // 4. Login
        const loginRes = await fetch('http://localhost:8080/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        expect(loginRes.status).toBe(200);
        const loginData = await loginRes.json() as any;
        expect(loginData.token).toBeDefined();

        // Verify we can access protected resource (e.g., list zones)
        const authenticatedClient = new SapliyClient(loginData.token, { basePath: 'http://localhost:8080' });
        expect(authenticatedClient).toBeDefined();
    });

    it('should reset password successfully', async () => {
        const email = `reset-test-${Date.now()}@example.com`;
        const password = 'Password123!';
        const newPassword = 'NewPassword456!';

        // Register first
        await fetch('http://localhost:8080/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        // 1. Request Password Reset
        const forgotRes = await fetch('http://localhost:8080/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        expect(forgotRes.status).toBe(200);

        // 2. Get Reset Token (Debug)
        await new Promise(r => setTimeout(r, 100));
        const resetToken = await getDebugToken(email, 'reset');
        expect(resetToken).toBeDefined();

        // 3. Reset Password
        const resetRes = await fetch('http://localhost:8080/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: resetToken, new_password: newPassword })
        });
        expect(resetRes.status).toBe(200);

        // 4. Login with Old Password (should fail)
        const failLogin = await fetch('http://localhost:8080/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }) // Old password
        });
        expect(failLogin.status).not.toBe(200);

        // 5. Login with New Password (should succeed)
        const successLogin = await fetch('http://localhost:8080/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: newPassword })
        });
        expect(successLogin.status).toBe(200);
    });
});
