import { type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { MoreButton } from "./ui";

/** The 300px card used in every horizontal row: icon, title, subtitle, meta, chevron.
 *  With `href` it is a real top-level link (web app tiles → their Cloudflare
 *  hostname, same tab); the browser navigates and `onClick` is not used. */
export function ItemCard({ icon, title, subtitle, meta, badge, href, onClick, onMore, chevron, wide, action, children }: { icon: ReactNode; title: ReactNode; subtitle?: ReactNode; meta?: ReactNode; badge?: ReactNode; href?: string; onClick?: (e: React.MouseEvent<HTMLElement>) => void; onMore?: (e: React.MouseEvent<HTMLButtonElement>) => void; chevron?: boolean; wide?: boolean; action?: ReactNode; children?: ReactNode }) {
  const className = `card item${wide ? " wide" : ""}`;
  const inner = (
    <>
      {icon}
      <div className="body">
        <div className="t">
          <span className="truncate">{title}</span>
          {badge}
        </div>
        {subtitle && <div className="s truncate">{subtitle}</div>}
        {meta && <div className="m">{meta}</div>}
        {children}
      </div>
      {action && <span className="action" onClick={(e) => e.stopPropagation()}>{action}</span>}
      {chevron && <ChevronRight size={18} className="chev" />}
      {onMore && <MoreButton onClick={onMore} />}
    </>
  );
  if (href) return <a href={href} className={className}>{inner}</a>;
  const Tag = onClick ? "button" : "div";
  return <Tag type={onClick ? "button" : undefined} className={className} onClick={onClick}>{inner}</Tag>;
}
