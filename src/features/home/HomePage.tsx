import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { DailyWorkspace } from "../journal/DailyWorkspace";
import { formatLocalDate, localDateKey } from "../../shared/date";

export function HomePage() {
  const today = localDateKey();
  return (
    <section className="home-page">
      <header className="home-header">
        <div>
          <p className="eyebrow">TODAY IN FANGCUN</p>
          <h1>今天</h1>
          <p className="page-description">{formatLocalDate(today)}</p>
        </div>
        <Link className="journal-link" to="/journal">打开完整日记 <ArrowRight aria-hidden="true" size={15} /></Link>
      </header>
      <DailyWorkspace date={today} compact />
    </section>
  );
}
