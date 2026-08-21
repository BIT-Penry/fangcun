import { useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { DailyWorkspace } from "../journal/DailyWorkspace";
import { addLocalDays, formatLocalDate, localDateKey } from "../../shared/date";

export function HomePage() {
  const today = localDateKey();
  const [date, setDate] = useState(today);
  return (
    <section className="home-page">
      <header className="home-header">
        <div>
          <p className="eyebrow">{date === today ? "TODAY IN FANGCUN" : "A DAY IN FANGCUN"}</p>
          <h1>{date === today ? "今天" : formatLocalDate(date).replace(/星期.*/, "")}</h1>
          <p className="page-description">{formatLocalDate(date)}</p>
        </div>
        <div className="home-header-actions">
          <div className="date-navigation">
            <button type="button" className="icon-button" onClick={() => setDate(addLocalDays(date, -1))} aria-label="前一天"><ChevronLeft aria-hidden="true" size={17} /></button>
            <button type="button" className="button-secondary" onClick={() => setDate(today)} disabled={date === today}>今天</button>
            <button type="button" className="icon-button" onClick={() => setDate(addLocalDays(date, 1))} aria-label="后一天"><ChevronRight aria-hidden="true" size={17} /></button>
          </div>
          <Link className="journal-link" to={`/journal?date=${date}`}>打开完整日记 <ArrowRight aria-hidden="true" size={15} /></Link>
        </div>
      </header>
      <DailyWorkspace date={date} compact />
    </section>
  );
}
