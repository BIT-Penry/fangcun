import { parseLocalDate } from "../../shared/date";

const lunarFormatter = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

const LUNAR_DAYS = [
  "", "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
];

export interface LunarDate {
  yearName: string;
  month: string;
  day: string;
  compact: string;
  full: string;
}

export function formatLunarDate(value: string): LunarDate {
  const parts = lunarFormatter.formatToParts(parseLocalDate(value)) as Array<{ type: string; value: string }>;
  const yearName = parts.find((part) => part.type === "yearName")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const dayNumber = Number(parts.find((part) => part.type === "day")?.value);
  const day = LUNAR_DAYS[dayNumber] ?? String(dayNumber);

  return {
    yearName,
    month,
    day,
    compact: dayNumber === 1 ? month : day,
    full: `${yearName ? `${yearName}年` : ""}${month}${day}`,
  };
}
