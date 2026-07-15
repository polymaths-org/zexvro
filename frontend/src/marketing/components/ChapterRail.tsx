import { useEffect, useState, type CSSProperties } from 'react';

const chapters = [
  { id: 'top', numeral: 'I', label: 'Manifest' },
  { id: 'privacy', numeral: 'II', label: 'Privacy' },
  { id: 'morph', numeral: 'III', label: 'Morph' },
  { id: 'a2a', numeral: 'IV', label: 'Trade' },
  { id: 'agent-auth', numeral: 'V', label: 'Auth' },
  { id: 'nft', numeral: 'VI', label: 'Assets' },
  { id: 'depin', numeral: 'VII', label: 'De-Pin' },
  { id: 'agent-first', numeral: 'VIII', label: 'Agents' },
];

export default function ChapterRail() {
  const [activeId, setActiveId] = useState('top');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const elements = chapters
      .map(chapter => document.getElementById(chapter.id))
      .filter((element): element is HTMLElement => Boolean(element));

    const observer = new IntersectionObserver(
      entries => {
        const visibleEntry = entries
          .filter(entry => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visibleEntry?.target.id) setActiveId(visibleEntry.target.id);
      },
      { rootMargin: '-22% 0px -56% 0px', threshold: [0, 0.15, 0.4, 0.7] },
    );

    elements.forEach(element => observer.observe(element));

    let frame = 0;
    const updateProgress = () => {
      frame = 0;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(scrollable > 0 ? Math.min(1, Math.max(0, window.scrollY / scrollable)) : 0);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateProgress);
    };

    updateProgress();
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <nav
      className="chapter-rail"
      aria-label="Page chapters"
      style={{ '--page-progress': `${progress * 100}%` } as CSSProperties}
    >
      <span className="chapter-rail-heading">Index</span>
      <div className="chapter-rail-track" aria-hidden="true"><span /></div>
      <div className="chapter-rail-links">
        {chapters.map(chapter => (
          <a
            key={chapter.id}
            href={`#${chapter.id}`}
            className={activeId === chapter.id ? 'is-active' : undefined}
            aria-current={activeId === chapter.id ? 'location' : undefined}
          >
            <span>{chapter.numeral}</span>
            <strong>{chapter.label}</strong>
          </a>
        ))}
      </div>
    </nav>
  );
}
