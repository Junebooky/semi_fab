import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * Issue #46: one sentence for the situation, one clear next step, honest
 * simulation provenance. Presentation only: no API or data-contract mutations.
 */
export interface FriendlyPageIntroProps {
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel?: string;
  primaryHref?: string;
  detailLabel?: string;
  detail?: ReactNode;
  aside?: ReactNode;
  variant?: 'plain' | 'soft';
}

export function FriendlyPageIntro({
  eyebrow, title, description, primaryLabel, primaryHref,
  detailLabel = '데이터와 기준 자세히 보기', detail, aside, variant = 'plain'
}: FriendlyPageIntroProps) {
  return (
    <section className={'ux-intro ux-intro--' + variant} aria-label={eyebrow + ' 안내'}>
      <div className="ux-intro__body">
        <p className="ux-intro__eyebrow">{eyebrow}</p>
        <h1 className="ux-intro__title">{title}</h1>
        <p className="ux-intro__description">{description}</p>
        <div className="ux-intro__actions">
          {primaryLabel && primaryHref && (
            <Link className="ux-btn ux-btn--primary" href={primaryHref}>{primaryLabel}<span aria-hidden="true"> →</span></Link>
          )}
          <span className="ux-intro__provenance">연습용 합성 데이터 · 실제 FAB 연결 아님</span>
        </div>
        {detail && (
          <details className="ux-intro__details">
            <summary>{detailLabel}</summary>
            <div className="ux-intro__detail-body">{detail}</div>
          </details>
        )}
      </div>
      {aside && <div className="ux-intro__aside">{aside}</div>}
    </section>
  );
}

export function FriendlyModeLabel({ mode }: { mode: 'A' | 'B' }) {
  return (
    <span className="ux-mode-label">
      {mode === 'B' ? '서버에서 만든 연습 데이터' : '브라우저에서 살펴보는 예시'}
      <span className="ux-mode-label__technical"> · Mode {mode}</span>
    </span>
  );
}
