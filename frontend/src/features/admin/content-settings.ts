import {
  adminFetchAbout,
  adminFetchProfileCard,
  adminUpdateAbout,
  adminUpdateProfileCard,
  adminUploadImage
} from '../../data/api';
import { PLATFORM_PRESETS, getPresetLabel } from '../../data/platform-presets';
import type { AboutNarrativeSection, AboutStructuredPayload, AboutTimelineEvent } from '../../types/about';
import type { ProfileContact } from '../../types/profile-card';
import { escapeHtml } from '../../utils/escape-html';
import { cropImageToSquare } from './avatar-crop';
import { setMessage } from './shared';

interface AdminContentSettingsModuleOptions {
  rootElement: HTMLElement;
  token: string;
  onDirtyChange?: (scope: 'about-form' | 'profile-form', dirty: boolean) => void;
}

export interface AdminContentSettingsModule {
  refresh: () => Promise<void>;
  destroy: () => void;
}

export function setupAdminContentSettingsModule(
  options: AdminContentSettingsModuleOptions
): AdminContentSettingsModule | null {
  const { rootElement, token, onDirtyChange } = options;

  const aboutForm = rootElement.querySelector<HTMLFormElement>('[data-role="admin-about-form"]');
  const aboutErrorElement = rootElement.querySelector<HTMLElement>('[data-role="admin-about-error"]');
  const aboutSuccessElement = rootElement.querySelector<HTMLElement>('[data-role="admin-about-success"]');

  const profileForm = rootElement.querySelector<HTMLFormElement>('[data-role="admin-profile-form"]');
  const profileErrorElement = rootElement.querySelector<HTMLElement>('[data-role="admin-profile-error"]');
  const profileSuccessElement = rootElement.querySelector<HTMLElement>('[data-role="admin-profile-success"]');

  if (!aboutForm || !profileForm) return null;

  // --- Profile elements ---
  const avatarUploadInput = profileForm.querySelector<HTMLInputElement>('[data-role="admin-avatar-upload"]');
  const avatarUploadButton = profileForm.querySelector<HTMLButtonElement>('[data-role="admin-avatar-upload-btn"]');
  const avatarPreviewImg = profileForm.querySelector<HTMLImageElement>('[data-role="admin-avatar-preview"]');
  const avatarUrlInput = profileForm.querySelector<HTMLInputElement>('[data-role="admin-avatar-url"]');
  const contactListElement = profileForm.querySelector<HTMLElement>('[data-role="admin-contact-list"]');
  const contactPlatformSelect = profileForm.querySelector<HTMLSelectElement>('[data-role="admin-contact-platform"]');
  const contactHrefInput = profileForm.querySelector<HTMLInputElement>('[data-role="admin-contact-href"]');
  const contactAddButton = profileForm.querySelector<HTMLButtonElement>('[data-role="admin-contact-add"]');

  if (!avatarUploadInput || !avatarUploadButton || !avatarPreviewImg || !avatarUrlInput
    || !contactListElement || !contactPlatformSelect || !contactHrefInput || !contactAddButton) return null;

  // --- About elements ---
  const aboutIntroList = aboutForm.querySelector<HTMLElement>('[data-role="admin-about-intro-list"]');
  const aboutNarrativeList = aboutForm.querySelector<HTMLElement>('[data-role="admin-about-narrative-list"]');
  const aboutTimelineList = aboutForm.querySelector<HTMLElement>('[data-role="admin-about-timeline-list"]');

  if (!aboutIntroList || !aboutNarrativeList || !aboutTimelineList) return null;

  let busy = false;
  let aboutFormDirty = false;
  let profileFormDirty = false;

  // --- State ---
  let introParagraphs: string[] = [];
  let narrativeSections: AboutNarrativeSection[] = [];
  let timelineEvents: AboutTimelineEvent[] = [];
  let contacts: ProfileContact[] = [];
  let avatarUrl = '';

  const setAboutFormDirty = (d: boolean): void => {
    if (aboutFormDirty === d) return; aboutFormDirty = d; onDirtyChange?.('about-form', d);
  };
  const setProfileFormDirty = (d: boolean): void => {
    if (profileFormDirty === d) return; profileFormDirty = d; onDirtyChange?.('profile-form', d);
  };
  const setBusy = (v: boolean): void => {
    busy = v;
    for (const form of [aboutForm, profileForm]) {
      const submitBtn = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      if (v) submitBtn?.setAttribute('disabled', 'true');
      else submitBtn?.removeAttribute('disabled');
    }
  };

  // --- Profile rendering ---
  const renderContactList = (): void => {
    contactListElement.innerHTML = contacts.map((c, i) => {
      const preset = PLATFORM_PRESETS.find((p) => p.key === c.platform.trim().toLowerCase());
      const icon = preset ? preset.iconifyIcon : 'mdi:link-variant';
      const label = c.label?.trim() || getPresetLabel(c.platform);
      return `<div class="admin-contact-row" data-contact-index="${i}">
        <iconify-icon icon="${icon}" class="admin-contact-row-icon" aria-hidden="true"></iconify-icon>
        <span class="admin-contact-row-platform">${escapeHtml(label)}</span>
        <span class="admin-contact-row-href">${escapeHtml(c.href)}</span>
        <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-role="admin-contact-remove" data-contact-index="${i}">删除</button>
      </div>`;
    }).join('');
  };

  const populatePlatformSelect = (): void => {
    contactPlatformSelect.innerHTML = `<option value="">选择平台...</option>`
      + PLATFORM_PRESETS.map((p) => `<option value="${escapeHtml(p.key)}">${escapeHtml(p.label)}</option>`).join('')
      + `<option value="__custom__">自定义...</option>`;
  };

  // --- About rendering ---
  const renderIntroList = (): void => {
    aboutIntroList.innerHTML = introParagraphs.map((p, i) => `
      <div class="admin-about-intro-row" data-intro-index="${i}">
        <textarea data-role="admin-about-intro-text" rows="2">${escapeHtml(p)}</textarea>
        <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-role="admin-about-remove-intro" data-intro-index="${i}">删除</button>
      </div>
    `).join('');
  };

  const renderNarrativeList = (): void => {
    aboutNarrativeList.innerHTML = narrativeSections.map((s, i) => `
      <div class="admin-about-narrative-block" data-narrative-index="${i}">
        <div class="admin-form-grid">
          <label><span>标题</span><input type="text" data-role="admin-about-narrative-title" value="${escapeHtml(s.title)}" /></label>
          <label><span>标签</span><input type="text" data-role="admin-about-narrative-label" value="${escapeHtml(s.label)}" /></label>
          <label><span>位置</span>
            <select data-role="admin-about-narrative-side">
              <option value="left"${s.side === 'left' ? ' selected' : ''}>左侧</option>
              <option value="right"${s.side === 'right' ? ' selected' : ''}>右侧</option>
            </select>
          </label>
        </div>
        <div class="admin-about-narrative-items" data-role="admin-about-narrative-items" data-narrative-index="${i}">
          ${(s.items).map((item, j) => `
            <div class="admin-about-narrative-item-row" data-narrative-index="${i}" data-item-index="${j}">
              <input type="text" data-role="admin-about-narrative-item" value="${escapeHtml(item)}" />
              <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-role="admin-about-remove-narrative-item" data-narrative-index="${i}" data-item-index="${j}">×</button>
            </div>
          `).join('')}
        </div>
        <div class="admin-about-block-actions">
          <button type="button" class="admin-btn admin-btn-ghost admin-btn-sm" data-role="admin-about-add-narrative-item" data-narrative-index="${i}">添加条目</button>
          <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-role="admin-about-remove-narrative" data-narrative-index="${i}">删除此区</button>
        </div>
      </div>
    `).join('');
  };

  const renderTimelineList = (): void => {
    aboutTimelineList.innerHTML = timelineEvents.map((e, i) => `
      <div class="admin-about-timeline-row" data-timeline-index="${i}">
        <input type="text" data-role="admin-about-timeline-date" value="${escapeHtml(e.date)}" placeholder="YYYY-MM" />
        <input type="text" data-role="admin-about-timeline-detail" value="${escapeHtml(e.detail)}" placeholder="事件描述" />
        <button type="button" class="admin-btn admin-btn-danger admin-btn-sm" data-role="admin-about-remove-timeline" data-timeline-index="${i}">删除</button>
      </div>
    `).join('');
  };

  // --- Profile handlers ---
  const handleAddContact = (): void => {
    const platformVal = contactPlatformSelect.value;
    if (!platformVal) return;
    const href = contactHrefInput.value.trim();
    if (!href) return;

    if (platformVal === '__custom__') {
      const customPlatform = window.prompt('请输入自定义平台名称（英文小写，如 zhihu）：');
      if (!customPlatform?.trim()) return;
      const customLabel = window.prompt('请输入平台显示名称（如 知乎）：');
      contacts.push({ platform: customPlatform.trim().toLowerCase(), label: customLabel?.trim() || customPlatform.trim(), href });
    } else {
      const preset = PLATFORM_PRESETS.find((p) => p.key === platformVal);
      contacts.push({ platform: platformVal, label: preset?.label || platformVal, href });
    }
    contactHrefInput.value = '';
    contactPlatformSelect.value = '';
    renderContactList();
    setProfileFormDirty(true);
  };

  const handleContactRemove = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const button = target.closest<HTMLButtonElement>('[data-role="admin-contact-remove"]');
    if (!button) return;
    const index = Number(button.dataset.contactIndex);
    if (Number.isNaN(index) || index < 0 || index >= contacts.length) return;
    contacts.splice(index, 1);
    renderContactList();
    setProfileFormDirty(true);
  };

  const handleAvatarUpload = (): void => { avatarUploadInput.click(); };

  const handleAvatarFileChange = async (): Promise<void> => {
    const file = avatarUploadInput.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessage(profileErrorElement, '仅支持图片文件，请重新选择。', { error: true });
      avatarUploadInput.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage(profileErrorElement, '图片超过 10MB，请压缩后再上传。', { error: true });
      avatarUploadInput.value = '';
      return;
    }

    try {
      const cropped = await cropImageToSquare(file);
      const uploaded = await adminUploadImage(token, new File([cropped], file.name || 'avatar.webp', { type: 'image/webp' }));
      avatarUrl = uploaded.url;
      avatarUrlInput.value = uploaded.url;
      avatarPreviewImg.src = uploaded.url;
      avatarUploadInput.value = '';
      setProfileFormDirty(true);
      setMessage(profileSuccessElement, '头像已上传并裁剪。');
    } catch (error) {
      setMessage(profileErrorElement, error instanceof Error ? error.message : '头像上传失败', { error: true });
    }
  };

  const handlePlatformSelectChange = (): void => {
    contactHrefInput.placeholder = contactPlatformSelect.value === '__custom__' ? '自定义平台链接' : '链接地址';
  };

  // --- About CRUD handlers (delegated) ---
  const handleAboutClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    // Add intro
    if (target.closest('[data-role="admin-about-add-intro"]')) {
      introParagraphs.push('');
      renderIntroList();
      setAboutFormDirty(true);
      return;
    }

    // Remove intro
    const removeIntroBtn = target.closest<HTMLButtonElement>('[data-role="admin-about-remove-intro"]');
    if (removeIntroBtn) {
      const idx = Number(removeIntroBtn.dataset.introIndex);
      if (!Number.isNaN(idx)) { introParagraphs.splice(idx, 1); renderIntroList(); setAboutFormDirty(true); }
      return;
    }

    // Add narrative section
    if (target.closest('[data-role="admin-about-add-narrative"]')) {
      narrativeSections.push({ id: '', title: '', label: '', side: (narrativeSections.length % 2 === 0 ? 'left' : 'right'), items: [''] });
      renderNarrativeList();
      setAboutFormDirty(true);
      return;
    }

    // Remove narrative section
    const removeNarrBtn = target.closest<HTMLButtonElement>('[data-role="admin-about-remove-narrative"]');
    if (removeNarrBtn) {
      const idx = Number(removeNarrBtn.dataset.narrativeIndex);
      if (!Number.isNaN(idx)) { narrativeSections.splice(idx, 1); renderNarrativeList(); setAboutFormDirty(true); }
      return;
    }

    // Add narrative item
    const addItemBtn = target.closest<HTMLButtonElement>('[data-role="admin-about-add-narrative-item"]');
    if (addItemBtn) {
      const idx = Number(addItemBtn.dataset.narrativeIndex);
      if (!Number.isNaN(idx) && narrativeSections[idx]) { narrativeSections[idx].items.push(''); renderNarrativeList(); setAboutFormDirty(true); }
      return;
    }

    // Remove narrative item
    const removeItemBtn = target.closest<HTMLButtonElement>('[data-role="admin-about-remove-narrative-item"]');
    if (removeItemBtn) {
      const nIdx = Number(removeItemBtn.dataset.narrativeIndex);
      const iIdx = Number(removeItemBtn.dataset.itemIndex);
      if (!Number.isNaN(nIdx) && !Number.isNaN(iIdx) && narrativeSections[nIdx]) {
        narrativeSections[nIdx].items.splice(iIdx, 1);
        renderNarrativeList();
        setAboutFormDirty(true);
      }
      return;
    }

    // Add timeline
    if (target.closest('[data-role="admin-about-add-timeline"]')) {
      timelineEvents.push({ id: '', date: '', detail: '' });
      renderTimelineList();
      setAboutFormDirty(true);
      return;
    }

    // Remove timeline
    const removeTLBtn = target.closest<HTMLButtonElement>('[data-role="admin-about-remove-timeline"]');
    if (removeTLBtn) {
      const idx = Number(removeTLBtn.dataset.timelineIndex);
      if (!Number.isNaN(idx)) { timelineEvents.splice(idx, 1); renderTimelineList(); setAboutFormDirty(true); }
      return;
    }
  };

  const collectAboutPayload = (): AboutStructuredPayload => {
    const formData = new FormData(aboutForm);

    // Read intro paragraphs from DOM
    introParagraphs = Array.from(aboutIntroList.querySelectorAll<HTMLTextAreaElement>('[data-role="admin-about-intro-text"]'))
      .map((ta) => ta.value.trim())
      .filter(Boolean);

    // Read narrative sections from DOM
    const narrBlocks = aboutNarrativeList.querySelectorAll<HTMLElement>('.admin-about-narrative-block');
    narrativeSections = Array.from(narrBlocks).map((block, i) => {
      const titleInput = block.querySelector<HTMLInputElement>('[data-role="admin-about-narrative-title"]');
      const labelInput = block.querySelector<HTMLInputElement>('[data-role="admin-about-narrative-label"]');
      const sideSelect = block.querySelector<HTMLSelectElement>('[data-role="admin-about-narrative-side"]');
      const itemInputs = block.querySelectorAll<HTMLInputElement>('[data-role="admin-about-narrative-item"]');
      return {
        id: `section-${i + 1}`,
        title: titleInput?.value.trim() ?? '',
        label: labelInput?.value.trim() ?? '',
        side: (sideSelect?.value === 'right' ? 'right' : 'left') as 'left' | 'right',
        items: Array.from(itemInputs).map((inp) => inp.value.trim()).filter(Boolean)
      };
    }).filter((s) => s.title);

    // Read timeline events from DOM
    const tlRows = aboutTimelineList.querySelectorAll<HTMLElement>('.admin-about-timeline-row');
    timelineEvents = Array.from(tlRows).map((row, i) => {
      const dateInput = row.querySelector<HTMLInputElement>('[data-role="admin-about-timeline-date"]');
      const detailInput = row.querySelector<HTMLInputElement>('[data-role="admin-about-timeline-detail"]');
      return {
        id: `event-${i + 1}`,
        date: dateInput?.value.trim() ?? '',
        detail: detailInput?.value.trim() ?? ''
      };
    }).filter((e) => e.date || e.detail);

    return {
      heroTitle: String(formData.get('heroTitle') ?? ''),
      heroSubtitle: String(formData.get('heroSubtitle') ?? ''),
      introParagraphs,
      narrativeSections,
      timelineTitle: String(formData.get('timelineTitle') ?? ''),
      timelineLabel: 'Milestones',
      timelineEvents
    };
  };

  // --- Refresh ---
  const refresh = async (): Promise<void> => {
    const [aboutPayload, profilePayload] = await Promise.all([
      adminFetchAbout(token),
      adminFetchProfileCard(token)
    ]);

    (aboutForm.elements.namedItem('heroTitle') as HTMLInputElement).value = aboutPayload.heroTitle ?? '';
    (aboutForm.elements.namedItem('heroSubtitle') as HTMLInputElement).value = aboutPayload.heroSubtitle ?? '';
    (aboutForm.elements.namedItem('timelineTitle') as HTMLInputElement).value = aboutPayload.timelineTitle ?? '';
    introParagraphs = [...(aboutPayload.introParagraphs ?? [])];
    narrativeSections = [...(aboutPayload.narrativeSections ?? [])];
    timelineEvents = [...(aboutPayload.timelineEvents ?? [])];
    renderIntroList();
    renderNarrativeList();
    renderTimelineList();

    (profileForm.elements.namedItem('name') as HTMLInputElement).value = profilePayload.name;
    (profileForm.elements.namedItem('bio') as HTMLTextAreaElement).value = profilePayload.bio;
    avatarUrl = profilePayload.avatar;
    avatarUrlInput.value = avatarUrl;
    avatarPreviewImg.src = avatarUrl || '';
    contacts = [...profilePayload.contacts];
    renderContactList();
    populatePlatformSelect();

    setAboutFormDirty(false);
    setProfileFormDirty(false);
  };

  // --- Submit handlers ---
  const handleAboutSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(aboutErrorElement, '');
    setMessage(aboutSuccessElement, '');
    try {
      const payload = collectAboutPayload();
      await adminUpdateAbout(token, payload);
      setMessage(aboutSuccessElement, '关于页已保存并立即生效。');
      setAboutFormDirty(false);
    } catch (error) {
      setMessage(aboutErrorElement, error instanceof Error ? error.message : '保存失败', { error: true });
    } finally { setBusy(false); }
  };

  const handleProfileSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage(profileErrorElement, '');
    setMessage(profileSuccessElement, '');
    try {
      const formData = new FormData(profileForm);
      await adminUpdateProfileCard(token, {
        name: String(formData.get('name') ?? ''),
        bio: String(formData.get('bio') ?? ''),
        avatar: avatarUrl,
        contacts
      });
      setMessage(profileSuccessElement, '名片卡已保存并立即生效。');
      setProfileFormDirty(false);
    } catch (error) {
      setMessage(profileErrorElement, error instanceof Error ? error.message : '保存失败', { error: true });
    } finally { setBusy(false); }
  };

  const handleAboutFormInput = (): void => setAboutFormDirty(true);
  const handleProfileFormInput = (): void => setProfileFormDirty(true);

  // --- Bind events ---
  aboutForm.addEventListener('submit', handleAboutSubmit);
  aboutForm.addEventListener('input', handleAboutFormInput);
  aboutForm.addEventListener('change', handleAboutFormInput);
  aboutForm.addEventListener('click', handleAboutClick);
  profileForm.addEventListener('submit', handleProfileSubmit);
  profileForm.addEventListener('input', handleProfileFormInput);
  profileForm.addEventListener('change', handleProfileFormInput);
  avatarUploadButton.addEventListener('click', handleAvatarUpload);
  avatarUploadInput.addEventListener('change', handleAvatarFileChange);
  contactAddButton.addEventListener('click', handleAddContact);
  contactListElement.addEventListener('click', handleContactRemove);
  contactPlatformSelect.addEventListener('change', handlePlatformSelectChange);

  return {
    refresh,
    destroy: () => {
      aboutForm.removeEventListener('submit', handleAboutSubmit);
      aboutForm.removeEventListener('input', handleAboutFormInput);
      aboutForm.removeEventListener('change', handleAboutFormInput);
      aboutForm.removeEventListener('click', handleAboutClick);
      profileForm.removeEventListener('submit', handleProfileSubmit);
      profileForm.removeEventListener('input', handleProfileFormInput);
      profileForm.removeEventListener('change', handleProfileFormInput);
      avatarUploadButton.removeEventListener('click', handleAvatarUpload);
      avatarUploadInput.removeEventListener('change', handleAvatarFileChange);
      contactAddButton.removeEventListener('click', handleAddContact);
      contactListElement.removeEventListener('click', handleContactRemove);
      contactPlatformSelect.removeEventListener('change', handlePlatformSelectChange);
      setAboutFormDirty(false);
      setProfileFormDirty(false);
    }
  };
}

