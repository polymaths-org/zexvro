import { useEffect, useRef } from 'react';
import SplitType from 'split-type';
import { animate, stagger } from 'animejs';
import { Check } from 'lucide-react';
import { gsap, prefersReducedMotion } from '../lib/smoothScroll';

const auditLines = [
  ['READ', 'Repository inspection request captured', 'visible'],
  ['PLAN', 'Migration proposal attached to workspace context', 'review'],
  ['MEMORY', 'Durable memory separated from logs and secrets', 'scoped'],
  ['APPROVE', 'Human-controlled authorization before risky actions', 'required'],
];

export default function ChapterAgentFirst() {
  const rootRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const title = titleRef.current;
    if (!root || !title || prefersReducedMotion()) return undefined;

    let split: SplitType | null = null;
    const ctx = gsap.context(() => {
      split = new SplitType(title, { types: 'words' });
      gsap.fromTo(
        split.words || [],
        { yPercent: 110, opacity: 0 },
        {
          yPercent: 0,
          opacity: 1,
          stagger: 0.045,
          duration: 0.9,
          immediateRender: false,
          scrollTrigger: {
            trigger: root,
            start: 'top 70%',
          },
        },
      );

      gsap.from('.audit-line', {
        opacity: 0,
        y: 18,
        stagger: 0.08,
        duration: 0.72,
        scrollTrigger: {
          trigger: '.audit-log',
          start: 'top 78%',
          onEnter: () => {
            animate(root.querySelectorAll('.audit-check'), {
              scale: [0.7, 1],
              opacity: [0, 1],
              delay: stagger(85),
              duration: 380,
              ease: 'out(3)',
            });
          },
        },
      });
    }, root);

    return () => {
      split?.revert();
      ctx.revert();
    };
  }, []);

  return (
    <section ref={rootRef} className="platform-close" id="agent-first" aria-labelledby="agent-first-title">
      <div className="closing-shell">
        <div className="closing-grid">
          <div>
            <p className="section-kicker">07 / Agent-first close</p>
            <h2 ref={titleRef} className="closing-title" id="agent-first-title">
              Agents should make work visible, not mysterious.
            </h2>
          </div>
          <div>
            <p className="closing-copy">
              ZEXVRO treats agents as first-class platform users, but not as unsupervised
              operators. The design direction is explicit context, auditable actions,
              separated memory, and human approval where authority matters.
            </p>
            <div className="audit-log" aria-label="Agent audit trail preview">
              {auditLines.map(([type, text, state]) => (
                <div className="audit-line" key={type}>
                  <span>{type}</span>
                  <strong>{text}</strong>
                  <span className="audit-check"><Check size={15} aria-hidden="true" /> {state}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
