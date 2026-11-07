import { useState, useCallback, useEffect, useRef } from 'react';
import { setMuscleOpacity, setAutoRotate, resetView, setLayerVisible, subscribeHover, hidePartPlate, focusPart } from './scene.js';
import PART_NAMES from './anatomy-names.js';

// Плашка закрепляется на 3,2 с после тапа (мобильные), затем плавно уходит.
const PIN_MS = 3200;

export default function SkeletonSection({ stageRef, active }) {
  const [xray, setXray] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [skeletalOn, setSkeletalOn] = useState(true);
  const [muscularOn, setMuscularOn] = useState(true);
  const [plate, setPlate] = useState(null);

  const pinTimer = useRef(null);

  const clearPinTimer = useCallback(() => {
    if (pinTimer.current) {
      clearTimeout(pinTimer.current);
      pinTimer.current = null;
    }
  }, []);

  const handleXray = useCallback(() => {
    setXray(prev => {
      const next = !prev;
      setMuscleOpacity(next ? 0.3 : 1.0);
      return next;
    });
  }, []);

  const handleSpin = useCallback(() => {
    setSpinning(prev => {
      const next = !prev;
      setAutoRotate(next);
      return next;
    });
  }, []);

  const handleHome = useCallback(() => {
    resetView();
  }, []);

  const handleFocus = useCallback(name => {
    focusPart(name);
  }, []);

  const handleToggleSkeletal = useCallback(() => {
    setSkeletalOn(prev => {
      const next = !prev;
      setLayerVisible('skeletal', next);
      return next;
    });
  }, []);

  const handleToggleMuscular = useCallback(() => {
    setMuscularOn(prev => {
      const next = !prev;
      setLayerVisible('muscular', next);
      return next;
    });
  }, []);

  // Подписка на наведение и тап по частям тела: сцена отдаёт FJ-код части
  // и точку в координатах сцены, здесь превращаем их в выпадающую плашку.
  useEffect(() => {
    const unsubscribe = subscribeHover(event => {
      if (event.type === 'leave') {
        // Закреплённую (после тапа) плашку не трогаем — уйдёт по таймеру.
        setPlate(prev => (prev && prev.pinned ? prev : null));
        return;
      }

      const names = PART_NAMES[event.partId];
      if (!names) {
        setPlate(null);
        return;
      }

      const nextPlate = {
        partId: event.partId,
        ru: names[0],
        latin: names[1],
        kind: event.kind,
        x: event.x,
        y: event.y,
        pinned: event.type === 'pin',
      };

      if (event.type === 'pin') {
        clearPinTimer();
        pinTimer.current = setTimeout(() => {
          pinTimer.current = null;
          hidePartPlate();
          setPlate(null);
        }, PIN_MS);
      }

      setPlate(nextPlate);
    });

    return () => {
      unsubscribe();
      clearPinTimer();
    };
  }, [clearPinTimer]);

  // Смена видимости слоёв прячет плашку: выбранная часть может уйти со сцены.
  useEffect(() => {
    setPlate(null);
  }, [skeletalOn, muscularOn]);

  return (
    <section className="skelSection sectionScroll">
      <div className="sectionHead">
        <div className="sectionRuleRow">
          <span className="sectionRule" aria-hidden="true" />
          <span className="sectionLabel">Модель опорно-двигательной системы</span>
          <span className="sectionRule" aria-hidden="true" />
        </div>
        <h2 className="sectionTitle">Скелет и мышцы</h2>
        <p className="sectionSubtitle">Скелет и мышцы человека</p>
      </div>

      <div className="skelLayout">
        <div className="skelStageCol">
          <div className="stageWrap skelStageWrap">
            <div className="stageFrame skelStage" ref={stageRef}>
              <div className="layerChips" role="group" aria-label="Слои модели">
                <button
                  type="button"
                  className={`layerChip ${skeletalOn ? 'is-on' : ''}`}
                  onClick={handleToggleSkeletal}
                  aria-pressed={skeletalOn}
                >
                  <span className="layerDot layerDotBone" />
                  Скелет
                </button>
                <button
                  type="button"
                  className={`layerChip ${muscularOn ? 'is-on' : ''}`}
                  onClick={handleToggleMuscular}
                  aria-pressed={muscularOn}
                >
                  <span className="layerDot layerDotMuscle" />
                  Мышцы
                </button>
              </div>
              <div className="stageControls">
                <button
                  type="button"
                  className={`ctlBtn ${xray ? 'ctlBtnActive' : ''}`}
                  onClick={handleXray}
                  title="Рентген: мышцы полупрозрачные"
                  aria-label="Рентген"
                  aria-pressed={xray}
                >
                  ◎
                </button>
                <button
                  type="button"
                  className={`ctlBtn ${spinning ? 'ctlBtnActive' : ''}`}
                  onClick={handleSpin}
                  title="Медленное вращение"
                  aria-label="Вращение"
                  aria-pressed={spinning}
                >
                  ⟳
                </button>
                <button
                  type="button"
                  className="ctlBtn"
                  onClick={handleHome}
                  title="Сбросить вид"
                  aria-label="Сбросить вид"
                >
                  ⌂
                </button>
              </div>

              <div className="focusGroup" role="group" aria-label="Фокус камеры">
                <button type="button" className="focusBtn" onClick={() => handleFocus('head')}>Голова</button>
                <button type="button" className="focusBtn" onClick={() => handleFocus('torso')}>Туловище</button>
                <button type="button" className="focusBtn" onClick={() => handleFocus('arm')}>Рука</button>
                <button type="button" className="focusBtn" onClick={() => handleFocus('leg')}>Ноги</button>
              </div>

              {plate && (
                <div
                  key={`${plate.pinned ? 'pin' : 'hover'}-${plate.partId}`}
                  className={`partPlate ${plate.pinned ? 'partPlatePinned' : ''} partPlate-${plate.kind || 'bone'}`}
                  style={{ left: plate.x, top: plate.y }}
                  aria-hidden="true"
                >
                  <span className="partPlateName">{plate.ru}</span>
                  <span className="partPlateLatin">{plate.latin}</span>
                </div>
              )}
            </div>
            <p className="stageCaptionBelow">Скелет и мышцы человека · трёхмерная модель</p>
          </div>
        </div>

        <aside className="skelInfo">
        <h3 className="skelInfoTitle">Костная и мышечная системы</h3>
        <p className="skelInfoDesc">
          Модель представляет костную систему и основные скелетные мышцы человека.
          Костная система включает кости, связки, хрящи и межпозвоночные диски.
          Мышечная система включает скелетные мышцы с сухожилиями.
          Данные получены на основе МРТ-сканов с шагом 2 мм в единой системе координат.
        </p>
        <hr className="infoDivider" />
        <div className="factsTitle">Строение модели</div>
        <table className="facts">
          <tbody>
            <tr>
              <th>Скелет</th>
              <td>Опора и защита внутренних органов; включает 249 элементов: кости, связки, хрящи</td>
            </tr>
            <tr>
              <th>Мышцы</th>
              <td>Движение и поддержание позы; включает 418 скелетных мышц с сухожилиями</td>
            </tr>
            <tr>
              <th>Рентген</th>
              <td>Мышцы становятся полупрозрачными, открывая костную систему</td>
            </tr>
            <tr>
              <th>Данные</th>
              <td>МРТ-сканы с шагом 2 мм, единая система координат</td>
            </tr>
          </tbody>
        </table>
        <hr className="infoDivider" />
        <p className="skelAttrib">
          Модель: BodyParts3D, © The Database Center for Life Science (DBCLS), лицензия CC BY-SA 2.1 Japan.
          Русские названия приведены по международной анатомической терминологии; в скобках — латинский термин атласа.
        </p>
      </aside>
      </div>
    </section>
  );
}
