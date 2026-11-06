import { useState, useEffect, useRef, useCallback } from 'react';
import SkeletonSection from './SkeletonSection.jsx';
import OrgansSection from './OrgansSection.jsx';
import { init, showSection, attachCanvas, dispose } from './scene.js';

export default function App() {
  const [activeSection, setActiveSection] = useState('skeleton');
  const skelStageRef = useRef(null);
  const organsStageRef = useRef(null);
  const skelSectionRef = useRef(null);
  const organsSectionRef = useRef(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!skelStageRef.current || initialized.current) return;
    initialized.current = true;
    init(skelStageRef.current);
    showSection('skeleton', { immediate: true });
    return () => dispose();
  }, []);

  useEffect(() => {
    if (!skelSectionRef.current || !organsSectionRef.current) return;

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const id = entry.target === organsSectionRef.current ? 'organs' : 'skeleton';
          setActiveSection(prev => {
            if (prev === id) return prev;
            const container = id === 'organs' ? organsStageRef.current : skelStageRef.current;
            if (container) attachCanvas(container);
            showSection(id);
            return id;
          });
        }
      },
      // Секции выше окна просмотра, поэтому порог в долях секции недостижим:
      // активируем секцию, когда она пересекает центральную полосу окна.
      { root: null, rootMargin: '-45% 0px -45% 0px', threshold: 0 }
    );

    observer.observe(skelSectionRef.current);
    observer.observe(organsSectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="root">
      <header className="header">
        <div className="headerTop">
          <span className="topRule" aria-hidden="true" />
          <span className="topLabel">Наглядная страница</span>
          <span className="topRule" aria-hidden="true" />
        </div>
        <div className="headerInner">
          <h1 className="brandTitle">Знакомство с анатомией человека</h1>
          <p className="brandSubtitle">Интерактивная трёхмерная модель костно-мышечной системы и внутренних органов</p>
        </div>
      </header>

      <div ref={skelSectionRef}>
        <SkeletonSection stageRef={skelStageRef} active={activeSection === 'skeleton'} />
      </div>

      <div ref={organsSectionRef}>
        <OrgansSection stageRef={organsStageRef} active={activeSection === 'organs'} />
      </div>

      <footer className="footer">
        <a
          className="footerLink"
          href="https://bodyparts3d.dbcls.jp"
          target="_blank"
          rel="noopener noreferrer"
        >
          BodyParts3D · DBCLS · CC BY-SA 2.1 JP
        </a>
      </footer>
    </div>
  );
}