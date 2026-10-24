import test from 'node:test';
import assert from 'node:assert/strict';
import { targetMarkets, marketPolicies, getMarketPolicy, resolveDocumentLanguage, marketPrompt, recommendedPaper, sectionHeading } from '../src/lib/career-localization/markets.ts';

test('six markets and neutral fallback have complete versioned advisory policies', () => {
  assert.deepEqual(targetMarkets, ['GLOBAL', 'CD', 'FR', 'CA', 'US', 'GB', 'DE']);
  for (const market of targetMarkets) {
    const rule = marketPolicies[market];
    assert.equal(rule.market, market);
    assert.ok(rule.label && rule.labelFr && rule.coverFr && rule.coverEn);
    assert.ok(rule.guidanceFr.length >= 2 && rule.guidanceEn.length >= 2);
    assert.ok(['A4', 'LETTER'].includes(rule.paper));
    assert.ok(rule.sources.every(link => link.startsWith('https://')));
    assert.equal(rule.sourceQuality === 'official', market !== 'CD' && market !== 'GLOBAL');
  }
  assert.deepEqual(getMarketPolicy('__proto__'), getMarketPolicy('GLOBAL'));
});

test('avoid photo and sensitive data by default in Anglo-American markets', () => {
  for (const market of ['CA','US','GB']) {
    assert.equal(getMarketPolicy(market).photo, 'avoid');
    assert.match(marketPrompt(market,'auto'), /Never reveal or generate identity numbers/);
  }
  assert.equal(getMarketPolicy('DE').photo, 'optional');
  assert.equal(getMarketPolicy('FR').photo, 'optional');
});

test('country controls document writing language with explicit override, not UI nationality', () => {
  assert.equal(resolveDocumentLanguage('DE', 'auto', 'fr'), 'de');
  assert.equal(resolveDocumentLanguage('CA', 'auto', 'fr'), 'en');
  assert.equal(resolveDocumentLanguage('CA', 'fr', 'en'), 'fr');
  assert.equal(resolveDocumentLanguage('CD', 'auto', 'en'), 'fr');
  assert.equal(resolveDocumentLanguage('GLOBAL', 'auto', 'fr'), 'fr');
  assert.equal(resolveDocumentLanguage('US', 'de', 'en'), 'de');
});

test('page sizes follow market and are recommendations, never forced in existing documents', () => {
  assert.equal(recommendedPaper('US'), 'LETTER');
  assert.equal(recommendedPaper('CA'), 'LETTER');
  assert.equal(recommendedPaper('GB'), 'A4');
  assert.equal(recommendedPaper('DE'), 'A4');
});

test('AI policy marks job descriptions as untrusted and keeps factual scope unchanged', () => {
  const s = marketPrompt('CA','fr');
  assert.match(s,/NOT laws/);
  assert.match(s,/untrusted input/);
  assert.match(s,/Never invent addresses/);
  assert.match(s,/Document writing language: fr/);
  assert.doesNotMatch(s,/candidate is a Canadian citizen|candidate lives in Canada/);
});

test('preview and PDF section labels can be localized to German without changing candidate text', () => {
  assert.equal(sectionHeading("experiences", "DE", "auto", "fr"), "Berufserfahrung");
  assert.equal(sectionHeading("skills", "CA", "fr", "en"), "Compétences");
  assert.equal(sectionHeading("educations", "GLOBAL", "auto", "en"), "Education");
});
