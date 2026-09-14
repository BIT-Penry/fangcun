import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { addLocalDays, formatLocalDate, localDateKey, parseLocalDate } from "../../shared/date";
import { DailyWorkspace } from "./DailyWorkspace";
import { useJournalStore } from "./JournalContext";
import { formatLunarDate } from "./lunar";
import { PriorityBadge } from "./PriorityBadge";
import type { JournalMonthSummary } from "./types";

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
  const repository = useJournalStore();
  const today = localDateKey();
  const [searchParams] = useSearchParams();
  const requestedDate = searchParams.get("date");
  const [date, setDate] = useState(
    requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today,
  );
  const days = useMemo(() => monthDays(date), [date]);
  const parsedDate = parseLocalDate(date);
  const selectedMonth = parsedDate.getMonth();
  const monthKey = date.slice(0, 7);
  const selectedLunarDate = formatLunarDate(date);
  const [summary, setSummary] = useState<JournalMonthSummary | null>(null);
  const [openTodoCounts, setOpenTodoCounts] = useState<Record<string, number>>({});
  const [summaryRevision, setSummaryRevision] = useState(0);
  const refreshMonthSummary = useCallback(() => setSummaryRevision((value) => value + 1), []);

  useEffect(() => {
    let active = true;
    const startDate = `${monthKey}-01`;
    const start = parseLocalDate(startDate);
    const endDate = localDateKey(new Date(start.getFullYear(), start.getMonth() + 1, 1));
    const calendarStartDate = days[0];
    const calendarEndDate = addLocalDays(days[days.length - 1], 1);
    setSummary(null);
    void Promise.all([
      repository.getMonthSummary(startDate, endDate),
      repository.getOpenTodoCounts(calendarStartDate, calendarEndDate),
    ]).then(([nextSummary, nextOpenTodoCounts]) => {
      if (!active) return;
      setSummary(nextSummary);
      setOpenTodoCounts(nextOpenTodoCounts);
    }).catch(() => {
      if (!active) return;
      setSummary({
        entryDays: 0, todoCount: 0, completedTodoCount: 0,
        p1TodoCount: 0, p2TodoCount: 0, p3TodoCount: 0,
      });
      setOpenTodoCounts({});
    });
    return () => { active = false; };
  }, [days, monthKey, repository, summaryRevision]);

  const completionRate = summary?.todoCount
    ? Math.round((summary.completedTodoCount / summary.todoCount) * 100)
    : 0;
  const priorityCounts = summary ? {
    p1: summary.p1TodoCount ?? 0,
    p2: summary.p2TodoCount ?? 0,
    p3: summary.p3TodoCount ?? 0,
  } : null;
  const prioritizedTodoCount = priorityCounts
    ? priorityCounts.p1 + priorityCounts.p2 + priorityCounts.p3
    : null;

  return (
    <section className="journal-page">
      <header className="bookmarks-header journal-header">
        <div>
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
        <aside className="journal-calendar-rail" aria-label="日期与本月概览">
          <section className="calendar-panel" aria-label="月历">
            <div className="calendar-heading">
              <button type="button" className="icon-button" onClick={() => setDate(moveMonth(date, -1))} aria-label="上个月"><ChevronLeft aria-hidden="true" size={16} /></button>
              <strong>{new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(parsedDate)}</strong>
              <button type="button" className="icon-button" onClick={() => setDate(moveMonth(date, 1))} aria-label="下个月"><ChevronRight aria-hidden="true" size={16} /></button>
            </div>
            <div className="calendar-grid calendar-weekdays">
              {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
            </div>
            <div className="calendar-grid">
              {days.map((day) => {
                const parsed = parseLocalDate(day);
                const lunar = formatLunarDate(day);
                const openTodoCount = openTodoCounts[day] ?? 0;
                const openTodoLevel = openTodoCount >= 4 ? "many" : openTodoCount >= 2 ? "some" : "one";
                const classes = [
                  "calendar-day",
                  parsed.getMonth() !== selectedMonth ? "outside" : "",
                  day === today ? "today" : "",
                  day === date ? "selected" : "",
                  openTodoCount > 0 ? "has-open-todos" : "",
                ].filter(Boolean).join(" ");
                const accessibleLabel = `${formatLocalDate(day)}，农历${lunar.full}${openTodoCount ? `，${openTodoCount}项任务未完成` : ""}`;
                return (
                  <button key={day} type="button" className={classes}
                    aria-label={accessibleLabel}
                    title={openTodoCount ? `${openTodoCount} 项任务未完成` : undefined}
                    aria-pressed={day === date} onClick={() => setDate(day)}>
                    <span className="calendar-solar">{parsed.getDate()}</span>
                    <span className="calendar-lunar">{lunar.compact}</span>
                    {openTodoCount > 0 && (
                      <span className="calendar-open-todos" data-level={openTodoLevel} data-count={openTodoCount} aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="calendar-selected-date">
              <strong>{new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(parsedDate)}</strong>
              <span>农历 {selectedLunarDate.full}</span>
            </div>
          </section>

          <section className="calendar-month-summary" aria-label="本月概览">
            <header><strong>本月概览</strong><span>{Number(monthKey.slice(5))}月</span></header>
            <dl>
              <div><dt>记录</dt><dd>{summary?.entryDays ?? "—"}<small>天</small></dd></div>
              <div><dt>清单</dt><dd>{summary?.todoCount ?? "—"}<small>项</small></dd></div>
              <div><dt>完成</dt><dd>{summary?.completedTodoCount ?? "—"}<small>项</small></dd></div>
            </dl>
            <div className="month-progress-label"><span>清单完成率</span><strong>{completionRate}%</strong></div>
            <div className="month-progress" aria-label={`清单完成率 ${completionRate}%`}>
              <span style={{ width: `${completionRate}%` }} />
            </div>
            <div className="month-priority-summary">
              <header>
                <span>待完成优先级</span>
                <small>{prioritizedTodoCount ?? "—"} 项待完成</small>
              </header>
              <ul>
                <li><PriorityBadge priority="high" /><span>高优先级</span><strong>{priorityCounts?.p1 ?? "—"}<small>项</small></strong></li>
                <li><PriorityBadge priority="medium" /><span>中优先级</span><strong>{priorityCounts?.p2 ?? "—"}<small>项</small></strong></li>
                <li><PriorityBadge priority="low" /><span>低优先级</span><strong>{priorityCounts?.p3 ?? "—"}<small>项</small></strong></li>
              </ul>
            </div>
          </section>
        </aside>
        <DailyWorkspace date={date} onDataChange={refreshMonthSummary} />
      </div>
    </section>
  );
}
