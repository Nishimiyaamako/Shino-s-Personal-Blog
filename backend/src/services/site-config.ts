import type { DatabaseContext } from '../db/client';
import type { ApiSiteConfig } from '../types/api';

const DEFAULT_SITE_CONFIG: ApiSiteConfig = {
  siteTitle: 'ShinoLog',
  siteSubtitle: '',
  slogan: '',
  copyrightOwner: 'NagaShino',
  poweredBy: 'Powered by Vite + TypeScript.',
  icpRecordText: '',
  icpRecordUrl: '',
  publicSecurityRecordText: '',
  publicSecurityRecordUrl: '',
  friendLinkTemplate: `name: 'ShinoLog',
description: '某个状态混沌家伙的Blog',
avatar: 'https://example.com/avatar.png',
url: 'https://nagashino.top/'`
};

interface SiteConfigRow {
  siteTitle: string;
  siteSubtitle: string;
  slogan: string;
  copyrightOwner: string;
  poweredBy: string;
  icpRecordText: string;
  icpRecordUrl: string;
  publicSecurityRecordText: string;
  publicSecurityRecordUrl: string;
  friendLinkTemplate: string;
}

export function getSiteConfig(context: DatabaseContext): ApiSiteConfig {
  const row = context.sqlite
    .query(`
      SELECT site_title AS siteTitle, site_subtitle AS siteSubtitle, slogan,
             copyright_owner AS copyrightOwner, powered_by AS poweredBy,
             icp_record_text AS icpRecordText, icp_record_url AS icpRecordUrl,
             public_security_record_text AS publicSecurityRecordText,
             public_security_record_url AS publicSecurityRecordUrl,
             friend_link_template AS friendLinkTemplate
      FROM site_config WHERE id = 1 LIMIT 1
    `)
    .get() as SiteConfigRow | null;

  if (row) {
    return { ...row };
  }

  return { ...DEFAULT_SITE_CONFIG };
}

export function updateSiteConfig(
  context: DatabaseContext,
  patch: Partial<ApiSiteConfig>
): ApiSiteConfig {
  const current = getSiteConfig(context);

  const siteTitle = (patch.siteTitle ?? current.siteTitle).trim();
  const siteSubtitle = (patch.siteSubtitle ?? current.siteSubtitle).trim();
  const slogan = (patch.slogan ?? current.slogan).trim();
  const copyrightOwner = (patch.copyrightOwner ?? current.copyrightOwner).trim();
  const poweredBy = (patch.poweredBy ?? current.poweredBy).trim();
  const icpRecordText = (patch.icpRecordText ?? current.icpRecordText).trim();
  const icpRecordUrl = (patch.icpRecordUrl ?? current.icpRecordUrl).trim();
  const publicSecurityRecordText = (patch.publicSecurityRecordText ?? current.publicSecurityRecordText).trim();
  const publicSecurityRecordUrl = (patch.publicSecurityRecordUrl ?? current.publicSecurityRecordUrl).trim();
  const friendLinkTemplate = (patch.friendLinkTemplate ?? current.friendLinkTemplate).trim();

  if (!siteTitle) {
    throw new Error('站点标题不能为空');
  }

  const now = new Date().toISOString();

  context.sqlite
    .query(`
      INSERT INTO site_config (id, site_title, site_subtitle, slogan, copyright_owner, powered_by,
        icp_record_text, icp_record_url, public_security_record_text, public_security_record_url,
        friend_link_template, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        site_title = excluded.site_title,
        site_subtitle = excluded.site_subtitle,
        slogan = excluded.slogan,
        copyright_owner = excluded.copyright_owner,
        powered_by = excluded.powered_by,
        icp_record_text = excluded.icp_record_text,
        icp_record_url = excluded.icp_record_url,
        public_security_record_text = excluded.public_security_record_text,
        public_security_record_url = excluded.public_security_record_url,
        friend_link_template = excluded.friend_link_template,
        updated_at = excluded.updated_at
    `)
    .run(
      siteTitle, siteSubtitle, slogan, copyrightOwner, poweredBy,
      icpRecordText, icpRecordUrl, publicSecurityRecordText, publicSecurityRecordUrl,
      friendLinkTemplate, now
    );

  return {
    siteTitle,
    siteSubtitle,
    slogan,
    copyrightOwner,
    poweredBy,
    icpRecordText,
    icpRecordUrl,
    publicSecurityRecordText,
    publicSecurityRecordUrl,
    friendLinkTemplate
  };
}
