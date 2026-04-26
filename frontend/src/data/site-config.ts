import { SITE_CONFIG } from '../config/site';
import type { AdminSiteConfig } from '../types/api';

const DEFAULT_SITE_CONFIG: AdminSiteConfig = {
  siteTitle: SITE_CONFIG.title,
  siteSubtitle: SITE_CONFIG.subtitle,
  copyrightOwner: SITE_CONFIG.footer.copyrightOwner,
  poweredBy: SITE_CONFIG.footer.poweredBy,
  icpRecordText: SITE_CONFIG.footer.icpRecordText,
  icpRecordUrl: SITE_CONFIG.footer.icpRecordUrl,
  publicSecurityRecordText: SITE_CONFIG.footer.publicSecurityRecordText,
  publicSecurityRecordUrl: SITE_CONFIG.footer.publicSecurityRecordUrl,
  friendLinkTemplate: `name: 'ShinoLog',
description: '某个状态混沌家伙的Blog',
avatar: 'https://example.com/avatar.png',
url: 'https://nagashino.top/'`
};

let remoteSiteConfigOverride: AdminSiteConfig | null = null;

export function loadSiteConfig(): AdminSiteConfig {
  return remoteSiteConfigOverride ? { ...remoteSiteConfigOverride } : { ...DEFAULT_SITE_CONFIG };
}

export function applyRemoteSiteConfig(config: AdminSiteConfig): boolean {
  const normalized: AdminSiteConfig = {
    siteTitle: config.siteTitle.trim(),
    siteSubtitle: config.siteSubtitle.trim(),
    copyrightOwner: config.copyrightOwner.trim(),
    poweredBy: config.poweredBy.trim(),
    icpRecordText: config.icpRecordText.trim(),
    icpRecordUrl: config.icpRecordUrl.trim(),
    publicSecurityRecordText: config.publicSecurityRecordText.trim(),
    publicSecurityRecordUrl: config.publicSecurityRecordUrl.trim(),
    friendLinkTemplate: config.friendLinkTemplate.trim()
  };

  const current = remoteSiteConfigOverride ?? DEFAULT_SITE_CONFIG;
  const currentFingerprint = JSON.stringify(current);
  const nextFingerprint = JSON.stringify(normalized);

  if (currentFingerprint === nextFingerprint) {
    return false;
  }

  remoteSiteConfigOverride = normalized;
  return true;
}
