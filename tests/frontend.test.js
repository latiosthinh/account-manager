import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { maskEmail, maskPassword, filterAccounts } from '../public/app.js';
import { createApp, startServer } from '../src/server.js';
import { initDb, closeDb } from '../src/db.js';

describe('Frontend Logic & Static Integration Tests', () => {
  describe('Credential Masking (MASK-01 & MASK-02)', () => {
    it('maskEmail masks standard email address preserving domain (MASK-01)', () => {
      assert.equal(maskEmail('thinh@gmail.com'), 'thi***@gmail.com');
      assert.equal(maskEmail('administrator@outlook.com'), 'admin***@outlook.com');
      assert.equal(maskEmail('john.doe@company.org'), 'john.***@company.org');
    });

    it('maskEmail handles short prefix email addresses', () => {
      assert.equal(maskEmail('a@domain.com'), 'a***@domain.com');
      assert.equal(maskEmail('ab@domain.com'), 'a***@domain.com');
      assert.equal(maskEmail('abc@domain.com'), 'a***@domain.com');
    });

    it('maskEmail handles usernames and edge cases', () => {
      assert.equal(maskEmail(''), '');
      assert.equal(maskEmail(null), '');
      assert.equal(maskEmail('adminuser'), 'adm***');
      assert.equal(maskEmail('root'), 'roo***');
      assert.equal(maskEmail('me'), 'm***');
    });

    it('maskPassword masks password with bullet characters (MASK-02)', () => {
      assert.equal(maskPassword('secret123'), '•••••••••');
      assert.equal(maskPassword('short'), '••••••••'); // Min length 8
      assert.equal(maskPassword('verylongpasswordexceedingbounds'), '••••••••••••••••'); // Max 16
      assert.equal(maskPassword(''), '');
      assert.equal(maskPassword(null), '');
    });
  });

  describe('Account Filtering & Search (VIEW-01 & VIEW-02)', () => {
    const sampleAccounts = [
      { id: '1', categoryId: 'cat-google', categoryName: 'Google', email: 'dev@gmail.com', password: 'p1', notes: 'Personal account' },
      { id: '2', categoryId: 'cat-outlook', categoryName: 'Outlook', email: 'work@outlook.com', password: 'p2', notes: 'Corporate SSO' },
      { id: '3', categoryId: 'cat-custom', categoryName: 'AWS Cloud', email: 'admin@aws.amazon.com', password: 'p3', notes: 'Root credentials' },
      { id: '4', categoryId: 'cat-google', categoryName: 'Google', email: 'backup@gmail.com', password: 'p4', notes: '' }
    ];

    it('filterAccounts returns all accounts when category is "all" and query is empty (VIEW-01)', () => {
      const result = filterAccounts(sampleAccounts, { selectedCategory: 'all', searchQuery: '' });
      assert.equal(result.length, 4);
    });

    it('filterAccounts filters by category ID (VIEW-01)', () => {
      const googleAccounts = filterAccounts(sampleAccounts, { selectedCategory: 'cat-google' });
      assert.equal(googleAccounts.length, 2);
      assert.ok(googleAccounts.every(a => a.categoryId === 'cat-google'));

      const outlookAccounts = filterAccounts(sampleAccounts, { selectedCategory: 'cat-outlook' });
      assert.equal(outlookAccounts.length, 1);
      assert.equal(outlookAccounts[0].email, 'work@outlook.com');
    });

    it('filterAccounts searches by email query case-insensitively (VIEW-02)', () => {
      const result = filterAccounts(sampleAccounts, { searchQuery: 'GMAIL' });
      assert.equal(result.length, 2);
      assert.ok(result.some(a => a.email === 'dev@gmail.com'));
      assert.ok(result.some(a => a.email === 'backup@gmail.com'));
    });

    it('filterAccounts searches by category name query (VIEW-02)', () => {
      const result = filterAccounts(sampleAccounts, { searchQuery: 'aws cloud' });
      assert.equal(result.length, 1);
      assert.equal(result.email || result[0].email, 'admin@aws.amazon.com');
    });

    it('filterAccounts searches by notes query (VIEW-02)', () => {
      const result = filterAccounts(sampleAccounts, { searchQuery: 'Corporate SSO' });
      assert.equal(result.length, 1);
      assert.equal(result[0].id, '2');
    });

    it('filterAccounts combines category and search filtering', () => {
      const result = filterAccounts(sampleAccounts, { selectedCategory: 'cat-google', searchQuery: 'backup' });
      assert.equal(result.length, 1);
      assert.equal(result[0].email, 'backup@gmail.com');

      const noMatch = filterAccounts(sampleAccounts, { selectedCategory: 'cat-outlook', searchQuery: 'backup' });
      assert.equal(noMatch.length, 0);
    });

    it('filterAccounts handles invalid or null inputs gracefully', () => {
      assert.deepEqual(filterAccounts(null), []);
      assert.deepEqual(filterAccounts(undefined), []);
      assert.deepEqual(filterAccounts([]), []);
    });
  });

  describe('Static Asset Delivery Integration', () => {
    let server;
    let baseUrl;

    before(async () => {
      initDb();
      const app = createApp();
      server = await startServer(0, '127.0.0.1', app);
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
    });

    after(async () => {
      await new Promise(resolve => server.close(resolve));
      closeDb();
    });

    it('serves GET / (index.html) with 200 OK and text/html', async () => {
      const res = await fetch(`${baseUrl}/`);
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('text/html'));
      const text = await res.text();
      assert.ok(text.includes('Account Manager'));
      assert.ok(text.includes('login-view'));
      assert.ok(text.includes('dashboard-view'));
      assert.ok(text.includes('app.js'));
    });

    it('serves GET /style.css with 200 OK and text/css', async () => {
      const res = await fetch(`${baseUrl}/style.css`);
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('text/css'));
      const text = await res.text();
      assert.ok(text.includes('--bg-dominant'));
      assert.ok(text.includes('.account-card'));
    });

    it('serves GET /app.js with 200 OK and javascript MIME type', async () => {
      const res = await fetch(`${baseUrl}/app.js`);
      assert.equal(res.status, 200);
      assert.ok(res.headers.get('content-type')?.includes('javascript'));
      const text = await res.text();
      assert.ok(text.includes('maskEmail'));
      assert.ok(text.includes('maskPassword'));
      assert.ok(text.includes('filterAccounts'));
    });
  });
});
