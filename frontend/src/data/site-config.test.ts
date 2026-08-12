import { describe, expect, it } from 'vitest';
import { applyRemoteSiteConfig, loadSiteConfig } from './site-config';
import { SITE_CONFIG } from '../config/site';

describe('loadSiteConfig', () => {
  it('returns defaults matching SITE_CONFIG', () => {
    const config = loadSiteConfig();
    expect(config.siteTitle).toBe(SITE_CONFIG.title);
    expect(config.siteSubtitle).toBe(SITE_CONFIG.subtitle);
    expect(config.slogan).toBe(SITE_CONFIG.slogan);
  });

  it('returns a copy, not a shared reference', () => {
    const a = loadSiteConfig();
    const b = loadSiteConfig();
    a.siteTitle = 'mutated';
    expect(b.siteTitle).not.toBe('mutated');
  });
});

describe('applyRemoteSiteConfig', () => {
  const valid = {
    siteTitle: '  Shino  ',
    siteSubtitle: 'sub',
    slogan: ' 星尘 ',
    copyrightOwner: 'c',
    poweredBy: 'p',
    icpRecordText: '',
    icpRecordUrl: '',
    publicSecurityRecordText: '',
    publicSecurityRecordUrl: '',
    friendLinkTemplate: 'name: x'
  };

  it('normalizes by trimming all fields', () => {
    expect(applyRemoteSiteConfig({ ...valid })).toBe(true);
    const loaded = loadSiteConfig();
    expect(loaded.siteTitle).toBe('Shino');
    expect(loaded.slogan).toBe('星尘');
  });

  it('treats non-string slogan as empty string', () => {
    applyRemoteSiteConfig({ ...valid, slogan: undefined as never });
    expect(loadSiteConfig().slogan).toBe('');
  });

  it('returns false when nothing changed (fingerprint dedupe)', () => {
    // 用唯一 slogan 值避免与前置测试的模块级状态撞车
    const same = { ...valid, slogan: 'dedupe-slogan' };
    expect(applyRemoteSiteConfig(same)).toBe(true);
    expect(applyRemoteSiteConfig({ ...same })).toBe(false);
  });
});
