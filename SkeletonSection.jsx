import { useState, useCallback } from 'react';
import { setMuscleOpacity, setAutoRotate, resetView, setLayerVisible } from './scene.js';

export default function SkeletonSection({ stageRef, active }) {
  const [xray, setXray] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [skeletalOn, setSkeletalOn] = useState(true);
  const [muscularOn, setMuscularOn] = useState(true);

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

  return (
    <section className="skelSection">
      <div className="sectionHead">
        <div className="sectionRuleRow">
          <span className="sectionRule" aria-hidden="true" />
          <span className="sectionLabel">Опорно-двигательный аппарат</span>
          <span className="sectionRule" aria-hidden="true" />
        </div>
        <h2 className="sectionTitle">Скелет и мышцы</h2>
        <p className="sectionSubtitle">Костная система и мышечная система человека в трёхмерной модели</p>
      </div>

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
      </div>

      <div className="skelInfo">
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
      </div>
    </section>
  );
}