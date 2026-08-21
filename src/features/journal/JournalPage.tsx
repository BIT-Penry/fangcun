import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addLocalDays, formatLocalDate, localDateKey, parseLocalDate } from "../../shared/date";
import { DailyWorkspace } from "./DailyWorkspace";

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"];

function monthDays(anchor: string): string[] {
  const selected = parseLocalDate(anchor);
  const first = new Date(selected.getFullYear(), selected.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, index) => localDateKey(new Date(
    first.getFullYear(), first.getMonth(), index - mondayOffset + 1,
  )));
}

function moveMonth(value: string, amount: number): string {
  const date = parseLocalDate(value);
  const targetDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(targetDay, lastDay));
  return localDateKey(date);
}

export function JournalPage() {
  const today = localDateKey();
  const [date, setDate] = useState(today);
  const days = useMemo(() => monthDays(date), [date]);
  const selectedMonth = parseLocalDate(date).getMonth();

  return (
    <section className="journal-page">
      <header className="bookmarks-header journal-header">
        <div>
          <p className="eyebrow">DAILY LEDGER</p>
          <h1>日记</h1>
          <p className="page-description">一日一页，把行动与念头安放在同一个日期里。</p>
        </div>
        <div className="date-navigation">
          <button type="button" className="icon-button" onClick={() => setDate(addLocalDays(date, -1))} aria-label="前一天"><ChevronLeft aria-hidden="true" size={17} /></button>
          <button type="button" className="button-secondary" onClick={() => setDate(today)} disabled={date === today}>今天</button>
          <button type="button" className="icon-button" onClick={() => setDate(addLocalDays(date, 1))} aria-label="后一天"><ChevronRight aria-hidden="true" size={17} /></button>
        </div>
      </header>

      <div className="journal-layout">
        <aside className="calendar-panel" aria-label="月历">
          <div className="calendar-heading">
            <button type="button" className="icon-button" onClick={() => setDate(moveMonth(date, -1))} aria-label="上个月"><ChevronLeft aria-hidden="true" size={16} /></button>
            <strong>{new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(parseLocalDate(date))}</strong>
            <button type="button" className="icon-button" onClick={() => setDate(moveMonth(date, 1))} aria-label="下个月"><ChevronRight aria-hidden="true" size={16} /></button>
          </div>
          <div className="calendar-grid calendar-weekdays">
            {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="calendar-grid">
            {days.map((day) => {
              const parsed = parseLocalDate(day);
              const classes = [
                "calendar-day",
                parsed.getMonth() !== selectedMonth ? "outside" : "",
                day === today ? "today" : "",
                day === date ? "selected" : "",
              ].filter(Boolean).join(" ");
              return <button key={day} type="button" className={classes} aria-label={formatLocalDate(day)} aria-pressed={day === date} onClick={() => setDate(day)}>{parsed.getDate()}</button>;
            })}
          </div>
          <p className="calendar-selected-date">{formatLocalDate(date)}</p>
        </aside>
        <DailyWorkspace date={date} />
      </div>
    </section>
  );
}
