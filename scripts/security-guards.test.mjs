import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { accountEmailChanged } from '../src/lib/security/account-email.ts';
import { detectPreviewMime, validTemplatePreview, MAX_TEMPLATE_IMAGE_BYTES } from '../src/lib/security/template-preview.ts';

test('account email cannot be changed through an ordinary profile update', () => {
  assert.equal(accountEmailChanged('  User@Example.COM', 'user@example.com'), false);
  assert.equal(accountEmailChanged('user@example.com', 'other@example.com'), true);
  assert.equal(accountEmailChanged('user@example.com', undefined), false);
  assert.equal(accountEmailChanged('user@example.com', 45), false);
});

test('template previews require recognized, matching signatures', () => {
  const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0]);
  const jpeg = Uint8Array.from([255,216,255,224,0,0,255,217]);
  const webp = new TextEncoder().encode('RIFF\u0000\u0000\u0000\u0000WEBP');
  assert.equal(detectPreviewMime(png), 'image/png');
  assert.equal(detectPreviewMime(jpeg), 'image/jpeg');
  assert.equal(detectPreviewMime(webp), 'image/webp');
  assert.equal(validTemplatePreview(png, 'image/png'), 'image/png');
  assert.equal(validTemplatePreview(png, 'image/jpeg'), null);
  assert.equal(validTemplatePreview(new TextEncoder().encode('<script>alert(1)</script>'), 'image/png'), null);
  assert.equal(validTemplatePreview(new Uint8Array(MAX_TEMPLATE_IMAGE_BYTES + 1), 'image/png'), null);
  assert.equal(validTemplatePreview(new Uint8Array(), 'image/png'), null);
});

test('credential email updates are guarded in both profile write paths', () => {
  for (const file of ['src/lib/career-profile/service.ts', 'src/app/api/users/[id]/route.ts']) {
    const src = readFileSync(file, 'utf8');
    assert.match(src, /accountEmailChanged\(/);
    assert.match(src, /EMAIL_CHANGE_REQUIRES_VERIFICATION/);
  }
});

test('public template metadata endpoints do not select binary previews', () => {
  for (const file of ['src/app/api/templates/route.ts', 'src/app/api/templates/[id]/route.ts']) {
    const src = readFileSync(file, 'utf8');
    assert.match(src, /select: publicTemplateFields|select: \{/);
    assert.doesNotMatch(src, /templateFile:\s*true/);
  }
});

test('template selection returns allowlisted fields only', () => {
  for (const file of ['src/app/api/users/[id]/updateTemplate/route.ts', 'src/app/api/users/[id]/updateCoverLetter/route.ts']) {
    const src = readFileSync(file, 'utf8');
    assert.match(src, /select: \{ id: true/);
    assert.match(src, /session.id !== id/);
    assert.match(src, /profileJson\(req, 4096\)/);
  }
});
