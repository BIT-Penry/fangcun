import {
  ArrowRight,
  Gauge,
  Sigma,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

type ToolDefinition = {
  name: string;
  description: string;
  detail: string;
  category: string;
  icon: LucideIcon;
  status: "available" | "planned";
  path?: string;
};

const TOOLS: readonly ToolDefinition[] = [
  {
    name: "公式识别",
    description: "把公式截图转换成可编辑的 LaTeX。",
    detail: "支持粘贴、拖入和导入图片，并提供公式渲染预览。",
    category: "图像与文本",
    icon: Sigma,
    status: "available",
    path: "/tools/formula",
  },
  {
    name: "网速测量",
    description: "测量当前网络的下载、上传与响应速度。",
    detail: "通过 Cloudflare 边缘节点进行自适应测速，结果不会保存在方寸中。",
    category: "网络诊断",
    icon: Gauge,
    status: "available",
    path: "/tools/speed-test",
  },
];

function ToolCard({ tool }: { tool: ToolDefinition }) {
  const Icon = tool.icon;
  const content = <>
    <header className="tool-card-header">
      <span className="tool-card-icon" aria-hidden="true"><Icon size={22} /></span>
      <span className={tool.status === "available" ? "tool-status available" : "tool-status"}>
        {tool.status === "available" ? "可用" : "规划中"}
      </span>
    </header>
    <div className="tool-card-content">
      <span className="tool-category">{tool.category}</span>
      <h2>{tool.name}</h2>
      <p>{tool.description}</p>
      <small>{tool.detail}</small>
    </div>
    <footer className="tool-card-footer">
      <span>{tool.status === "available" ? "打开工具" : "等待开发"}</span>
      {tool.status === "available" && <ArrowRight aria-hidden="true" size={16} />}
    </footer>
  </>;

  return tool.path
    ? <Link className="tool-card" to={tool.path} aria-label={`打开${tool.name}`}>{content}</Link>
    : <article className="tool-card tool-card-planned" aria-label={`${tool.name}，规划中`}>{content}</article>;
}

export function ToolboxPage() {
  const availableCount = TOOLS.filter((tool) => tool.status === "available").length;
  const plannedCount = TOOLS.length - availableCount;

  return (
    <section className="toolbox-page">
      <header className="toolbox-header">
        <div>
          <span className="page-eyebrow">UTILITY SHELF</span>
          <h1>工具箱</h1>
          <p className="page-description">把轻量、常用的小工具收在一个安静的工作台里。</p>
        </div>
        <dl className="toolbox-summary" aria-label="工具箱概览">
          <div><dt>现在可用</dt><dd>{availableCount}</dd></div>
          <div><dt>后续计划</dt><dd>{plannedCount}</dd></div>
        </dl>
      </header>

      <div className="toolbox-section-heading">
        <div><h2>全部工具</h2><p>按需打开，用完即走。</p></div>
        <span>{TOOLS.length} 个工具</span>
      </div>
      <div className="toolbox-grid" aria-label="工具列表">
        {TOOLS.map((tool) => <ToolCard key={tool.name} tool={tool} />)}
      </div>

      <aside className="toolbox-note">
        <span>持续扩展</span>
        <p>新的工具会沿用同一套卡片入口；功能本身保持独立，互不影响。</p>
      </aside>
    </section>
  );
}
