import { useState, useEffect, useRef, useCallback } from 'react';
import SkeletonSection from './SkeletonSection.jsx';
import OrgansSection from './OrgansSection.jsx';
import { init, showSection, attachCanvas, dispose, prefetchModels } from './scene.js';

export default function App() {
  const [activeSection, setActiveSection] = useState('skeleton');
  const skelStageRef = useRef(null);
  const organsStageRef = useRef(null);
  const skelSectionRef = useRef(null);
  const organsSectionRef = useRef(null);
  const initialized = useRef(false);
  const organsPlayed = useRef(false);

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
            if (id === 'organs') {
              showSection('organs', { animate: !organsPlayed.current });
              organsPlayed.current = true;
            } else {
              showSection('skeleton');
            }
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

  // Прогрев кэша ключевых моделей в простое после первой отрисовки.
  useEffect(() => {
    const warm = () => {
      if ('requestIdleCallback' in window) {
        requestIdleCallback(() => prefetchModels(), { timeout: 3500 });
      } else {
        setTimeout(prefetchModels, 1800);
      }
    };

    if (document.readyState === 'complete') warm();
    else {
      window.addEventListener('load', warm, { once: true });
      return () => window.removeEventListener('load', warm);
    }
  }, []);

  const scrollToSection = useCallback(targetRef => {
    targetRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="root">
      <nav className="edgeNav" aria-label="Разделы страницы">
        <button
          type="button"
          className={`edgeDot ${activeSection === 'skeleton' ? 'edgeDotActive' : ''}`}
          aria-label="Скелет и мышцы"
          aria-current={activeSection === 'skeleton' ? 'true' : undefined}
          onClick={() => scrollToSection(skelSectionRef)}
        />
        <button
          type="button"
          className={`edgeDot ${activeSection === 'organs' ? 'edgeDotActive' : ''}`}
          aria-label="Девять органов"
          aria-current={activeSection === 'organs' ? 'true' : undefined}
          onClick={() => scrollToSection(organsSectionRef)}
        />
      </nav>

      <header className="header">
        <div className="headerTop">
          <span className="topRule" aria-hidden="true" />
          <span className="topLabel">Наглядная страница</span>
          <span className="topRule" aria-hidden="true" />
        </div>
        <div className="headerInner">
          <h1 className="brandTitle">Знакомство с анатомией человека</h1>
          <div className="infoBlock">
            <p className="infoIntro">Человек (Homo sapiens) с биологической точки зрения — вид приматов из семейства гоминид, обладающий высокоразвитым мозгом, способностью к членораздельной речи и коллективному труду. Отличительные черты человека включают прямохождение, развитую кисть руки с противопоставленным большим пальцем, сложную социальную организацию и способность к абстрактному мышлению. Анатомически современный человек возник в Африке около 200-300 тысяч лет назад и постепенно расселился по всему земному шару, вытеснив другие виды рода Homo.</p>
            <p className="infoIntro">Человек биологически отличается крупным объемом мозга (в среднем 1300-1400 см³), сложной структурой коры головного мозга и длительным периодом детства.</p>
            <p className="infoIntro">Социальная природа человека проявляется в способности создавать материальную и духовную культуру, преобразовывать природу и себя самого. Трудовая деятельность, сознание и речь являются ключевыми факторами, определившими эволюционное развитие человека как вида и его доминирующее положение в природе.</p>
            <blockquote className="infoQuote">
              «Сначала труд, а затем и вместе с ним членораздельная речь явились двумя самыми главными стимулами, под влиянием которых мозг обезьяны постепенно превратился в человеческий мозг, который, при всем своем сходстве с обезьяньим, далеко превосходит его по величине и совершенству» (Энгельс)
            </blockquote>
            <p className="infoOutro">Труд сделал из обезьяны человека!</p>
          </div>
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
        <a
          className="footerLink footerCredit"
          href="https://gramotinho.kick.sh/"
          target="_blank"
          rel="noopener noreferrer"
        >
          @ГРАМОТИНЬО
        </a>
      </footer>
    </div>
  );
}
