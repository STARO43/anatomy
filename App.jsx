import { useState, useEffect, useRef, useCallback } from 'react';
import SkeletonSection from './SkeletonSection.jsx';
import OrgansSection from './OrgansSection.jsx';
import { init, showSection, attachCanvas, dispose, prefetchModels } from './scene.js';

const PANELS = [
  { id: 'about', num: '01', label: 'О человеке' },
  { id: 'skeleton', num: '02', label: 'Скелет и мышцы' },
  { id: 'organs', num: '03', label: 'Девять органов' },
];

export default function App() {
  const [active, setActive] = useState(0);
  const deckRef = useRef(null);
  const panelRefs = [useRef(null), useRef(null), useRef(null)];
  const skelStageRef = useRef(null);
  const organsStageRef = useRef(null);
  const initialized = useRef(false);
  const organsPlayed = useRef(false);

  // Единая 3D-сцена: canvas переезжает между панелями.
  useEffect(() => {
    if (!skelStageRef.current || initialized.current) return;
    initialized.current = true;
    init(skelStageRef.current);
    showSection('skeleton', { immediate: true });
    return () => dispose();
  }, []);

  // Активная панель: чей центр ближе к центру deck (rAF-троттлинг).
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return undefined;

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const cx = deck.scrollLeft + deck.clientWidth / 2;
        let best = 0;
        let bestDist = Infinity;
        panelRefs.forEach((ref, i) => {
          const p = ref.current;
          if (!p) return;
          const d = Math.abs(p.offsetLeft + p.offsetWidth / 2 - cx);
          if (d < bestDist) {
            bestDist = d;
            best = i;
          }
        });
        setActive(prev => (prev === best ? prev : best));
      });
    };

    deck.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      deck.removeEventListener('scroll', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Переключение 3D-секции вслед за активной панелью.
  useEffect(() => {
    const id = PANELS[active]?.id;
    if (id !== 'skeleton' && id !== 'organs') return;

    const container = id === 'organs' ? organsStageRef.current : skelStageRef.current;
    if (container) attachCanvas(container);

    if (id === 'organs') {
      showSection('organs', { animate: !organsPlayed.current });
      organsPlayed.current = true;
    } else {
      showSection('skeleton');
    }
  }, [active]);

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

  const goTo = useCallback(index => {
    const deck = deckRef.current;
    const panel = panelRefs[index]?.current;
    if (!deck || !panel) return;
    deck.scrollTo({ left: panel.offsetLeft, behavior: 'smooth' });
  }, []);

  // Колесо мыши: вертикальная прокрутка уходит внутрь панели,
  // а на её краях — двигает deck по горизонтали.
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck) return undefined;

    const canConsume = (el, dy) => {
      if (!el) return false;
      if (el.scrollHeight <= el.clientHeight + 1) return false;
      if (dy > 0) return el.scrollTop + el.clientHeight < el.scrollHeight - 1;
      return el.scrollTop > 0;
    };

    const onWheel = event => {
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;

      const target = event.target instanceof Element ? event.target : null;
      const panel = target?.closest('.panel');
      if (!panel) return;

      const scroller =
        panel.querySelector('.sectionScroll') || panel.querySelector('.heroScroll');
      if (canConsume(scroller, event.deltaY)) return;

      event.preventDefault();
      const px = event.deltaMode === 1 ? event.deltaY * 32 : event.deltaY;
      deck.scrollLeft += px;
    };

    deck.addEventListener('wheel', onWheel, { passive: false });
    return () => deck.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Клавиатура: стрелки листают панели.
  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'ArrowRight') {
        setActive(prev => {
          const next = Math.min(prev + 1, PANELS.length - 1);
          const panel = panelRefs[next]?.current;
          if (panel) deckRef.current?.scrollTo({ left: panel.offsetLeft, behavior: 'smooth' });
          return next;
        });
      } else if (event.key === 'ArrowLeft') {
        setActive(prev => {
          const next = Math.max(prev - 1, 0);
          const panel = panelRefs[next]?.current;
          if (panel) deckRef.current?.scrollTo({ left: panel.offsetLeft, behavior: 'smooth' });
          return next;
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="deckRoot">
      <header className="topBar">
        <span className="brand">
          <span className="brandMark" aria-hidden="true" />
          Анатомия человека
        </span>
        <nav className="deckNav" aria-label="Разделы страницы">
          {PANELS.map((panel, index) => (
            <button
              key={panel.id}
              type="button"
              className={`navItem ${active === index ? 'navItemActive' : ''}`}
              aria-label={panel.label}
              aria-current={active === index ? 'page' : undefined}
              onClick={() => goTo(index)}
            >
              <span className="navNum">{panel.num}</span>
              <span className="navLabel">{panel.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <div className="deck" ref={deckRef}>
        {/* 01 · О человеке */}
        <section className="panel" ref={panelRefs[0]} aria-label="О человеке">
          <div className="heroScroll">
            <div className="heroInner">
              <div className="heroKickerRow">
                <span className="heroKicker">Наглядная страница</span>
                <span className="heroKickerRule" aria-hidden="true" />
              </div>

              <h1 className="heroTitle">Знакомство с анатомией человека</h1>

              <div className="heroGrid">
                <div className="heroCols">
                  <p className="infoIntro">Человек (Homo sapiens) с биологической точки зрения — вид приматов из семейства гоминид, обладающий высокоразвитым мозгом, способностью к членораздельной речи и коллективному труду. Отличительные черты человека включают прямохождение, развитую кисть руки с противопоставленным большим пальцем, сложную социальную организацию и способность к абстрактному мышлению. Анатомически современный человек возник в Африке около 200-300 тысяч лет назад и постепенно расселился по всему земному шару, вытеснив другие виды рода Homo.</p>
                  <p className="infoIntro">Человек биологически отличается крупным объемом мозга (в среднем 1300-1400 см³), сложной структурой коры головного мозга и длительным периодом детства.</p>
                  <p className="infoIntro">Социальная природа человека проявляется в способности создавать материальную и духовную культуру, преобразовывать природу и себя самого. Трудовая деятельность, сознание и речь являются ключевыми факторами, определившими эволюционное развитие человека как вида и его доминирующее положение в природе.</p>
                </div>

                <div className="heroCols">
                  <blockquote className="infoQuote">
                    «Сначала труд, а затем и вместе с ним членораздельная речь явились двумя самыми главными стимулами, под влиянием которых мозг обезьяны постепенно превратился в человеческий мозг, который, при всем своем сходстве с обезьяньим, далеко превосходит его по величине и совершенству» (Энгельс)
                  </blockquote>
                  <p className="infoOutro">Труд сделал из обезьяны человека!</p>
                </div>
              </div>

              <div className="heroCards">
                {PANELS.slice(1).map((panel, i) => (
                  <button
                    key={panel.id}
                    type="button"
                    className="heroCard"
                    onClick={() => goTo(i + 1)}
                  >
                    <span className="heroCardNum">{panel.num}</span>
                    <span className="heroCardTitle">{panel.label}</span>
                    <span className="heroCardArrow" aria-hidden="true">→</span>
                  </button>
                ))}
              </div>

              <div className="heroFoot">
                <a
                  className="footerLink"
                  href="https://bodyparts3d.dbcls.jp"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  BodyParts3D · DBCLS · CC BY-SA 2.1 JP
                </a>
                <span className="swipeHint">
                  Свайп вправо
                  <span className="swipeHintArrow" aria-hidden="true">→</span>
                </span>
                <a
                  className="footerLink footerCredit"
                  href="https://gramotinho.kick.sh/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  @ГРАМОТИНЬО
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* 02 · Скелет и мышцы */}
        <section className="panel" ref={panelRefs[1]} aria-label="Скелет и мышцы">
          <SkeletonSection stageRef={skelStageRef} active={PANELS[active].id === 'skeleton'} />
        </section>

        {/* 03 · Девять органов */}
        <section className="panel" ref={panelRefs[2]} aria-label="Девять органов">
          <OrgansSection stageRef={organsStageRef} active={PANELS[active].id === 'organs'} />
        </section>
      </div>
    </div>
  );
}
