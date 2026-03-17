const DATE_LABEL_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  timeZone: 'Asia/Shanghai'
});

export function formatDateLabel(dateText: string): string {
  const candidate = new Date(`${dateText}T00:00:00+08:00`);

  if (Number.isNaN(candidate.getTime())) {
    return dateText;
  }

  return DATE_LABEL_FORMATTER.format(candidate);
}

export function formatArchiveLabel(key: string): string {
  const [year, month] = key.split('-');

  if (!year || !month) {
    return key;
  }

  return `${year} 年 ${month} 月`;
}
