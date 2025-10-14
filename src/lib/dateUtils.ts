// Utility functions for date parsing and formatting

export const parseDateFromExcel = (dateValue: string): Date | null => {
  if (!dateValue) return null;
  
  const dateStr = dateValue.toString().trim();
  
  // Try dd/mm/yyyy format
  const ddmmyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const ddmmyyyyMatch = dateStr.match(ddmmyyyyRegex);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Try yyyy/mm/dd format
  const yyyymmddRegex = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
  const yyyymmddMatch = dateStr.match(yyyymmddRegex);
  if (yyyymmddMatch) {
    const [, year, month, day] = yyyymmddMatch;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  return null;
};

export const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
};

export const detectDateFormat = (dateStr: string): string => {
  const ddmmyyyyRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const yyyymmddRegex = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;
  
  if (ddmmyyyyRegex.test(dateStr)) {
    return 'DD/MM/YYYY';
  } else if (yyyymmddRegex.test(dateStr)) {
    return 'YYYY/MM/DD';
  }
  
  return 'Formato desconocido';
};
