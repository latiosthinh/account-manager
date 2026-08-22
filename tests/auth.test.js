import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyPassword, createSessionToken, verifySessionToken } from '../src/auth.js';

test('verifyPassword verifies matching password', () => {
  assert.equal(verifyPassword('supersecret', 'supersecret'), true);
  assert.equal(verifyPassword('wrongpassword', 'supersecret'), false);
  assert.equal(verifyPassword('', 'supersecret'), false);
  assert.equal(verifyPassword(null, 'supersecret'), false);
  assert.equal(verifyPassword('supersecret', ''), false);
});

test('createSessionToken and verifySessionToken roundtrip', () => {
  const secret = 'test-secret-key-12345';
  const token = createSessionToken({ role: 'admin' }, secret, 60000);
  assert.ok(typeof token === 'string');
  assert.ok(token.includes('.'));

  const payload = verifySessionToken(token, secret);
  assert.ok(payload);
  assert.equal(payload.role, 'admin');
  assert.ok(payload.exp > Date.now());
});

test('verifySessionToken rejects tampered token', () => {
  const secret = 'test-secret-key-12345';
  const token = createSessionToken({ role: 'admin' }, secret);
  const [dataPart, sigPart] = token.split('.');
  
  // Tamper payload
  const tamperedPayload = Buffer.from(JSON.stringify({ role: 'superadmin', exp: Date.now() + 10000 })).toString('base64url');
  assert.equal(verifySessionToken(`${tamperedPayload}.${sigPart}`, secret), null);

  // Tamper signature
  assert.equal(verifySessionToken(`${dataPart}.invalid-sig`, secret), null);
  assert.equal(verifySessionToken('invalid.token.extra', secret), null);
  assert.equal(verifySessionToken('', secret), null);
  assert.equal(verifySessionToken(null, secret), null);
});

test('verifySessionToken rejects expired token', () => {
  const secret = 'test-secret-key-12345';
  const expiredToken = createSessionToken({ role: 'admin' }, secret, -1000);
  assert.equal(verifySessionToken(expiredToken, secret), null);
});
