import { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { loadModel } from './models.js';
import {
  getOrgansGroup,
  getCamera,
  getCanvas,
  subscribeFrame,
  setAutoRotate,
  resetView,
} from './scene.js';
import ORGANS from './organs-data.js';

const TARGET_SIZE = 3.8;
const HOTSPOT_SCREEN_RADIUS_PX = 14;
const DRAG_THRESHOLD_PX2 = 25;

function makeSpotTexture(hex) {
  const color = new THREE.Color(hex);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;

  const ctx = canvas.getContext('2d');
  const c = 64;

  const halo = ctx.createRadialGradient(c, c, 15, c, c, 64);
  halo.addColorStop(0, `rgba(${(color.r * 255) | 0}, ${(color.g * 255) | 0}, ${(color.b * 255) | 0}, 0.40)`);
  halo.addColorStop(0.55, `rgba(${(color.r * 255) | 0}, ${(color.g * 255) | 0}, ${(color.b * 255) | 0}, 0.14)`);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(c, c, c, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(c, c, 37, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(38,41,51,0.22)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(c, c, 36, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.97)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(c, c, 24, 0, Math.PI * 2);
  ctx.fillStyle = `rgb(${(color.r * 255) | 0}, ${(color.g * 255) | 0}, ${(color.b * 255) | 0})`;
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function clearOrgansGroup(group) {
  if (!group) return;

  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);

    if (child.userData?.isHotspotSprite) {
      child.material.map?.dispose();
      child.material.dispose();
    }
  }
}

export default function OrgansSection({ stageRef, active }) {
  const [organ, setOrgan] = useState(ORGANS[0]);
  const [spot, setSpot] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(false);
  const [spin, setSpin] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  const loadedOrganId = useRef(null);
  const spotSprites = useRef([]);
  const raycaster = useRef(new THREE.Raycaster());
  const pointer = useRef(new THREE.Vector2());
  const downPos = useRef(null);
  const unsubscribeFrame = useRef(null);

  const number = ORGANS.indexOf(organ) + 1;

  const selectOrgan = useCallback(nextOrgan => {
    setSpot(null);
    setOrgan(nextOrgan);
  }, []);

  const toggleSpin = useCallback(() => {
    setSpin(prev => {
      const next = !prev;
      if (active) setAutoRotate(next);
      return next;
    });
  }, [active]);

  const handleHome = useCallback(() => {
    resetView();
  }, []);

  const closeLightbox = useCallback(() => {
    setLightbox(null);
  }, []);

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key === 'Escape') setLightbox(null);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Пока рисунок рассматривают в лайтбоксе, страница не прокручивается.
  useEffect(() => {
    document.body.classList.toggle('has-lightbox', Boolean(lightbox));
    return () => document.body.classList.remove('has-lightbox');
  }, [lightbox]);

  useEffect(() => {
    if (!active) return;

    setAutoRotate(spin);

    const group = getOrgansGroup();
    if (!group) return;

    if (loadedOrganId.current === organ.id) {
      setLoading(false);
      setError(false);
      return undefined;
    }

    let cancelled = false;

    setLoading(true);
    setError(false);
    setProgress(0);

    loadModel(organ.id, event => {
      if (cancelled) return;
      if (event?.total > 0) {
        setProgress(Math.min(100, Math.round((event.loaded / event.total) * 100)));
      }
    })
      .then(gltf => {
        if (cancelled) return;

        clearOrgansGroup(group);
        spotSprites.current = [];

        const root = gltf.scene;

        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const scale = TARGET_SIZE / Math.max(size.x, size.y, size.z, 0.001);

        root.scale.setScalar(scale);
        root.position.copy(center.multiplyScalar(-scale));
        root.rotation.set(0.05, -0.28, 0);

        group.add(root);

        organ.hotspots.forEach(hotspot => {
          const material = new THREE.SpriteMaterial({
            map: makeSpotTexture(hotspot.color),
            transparent: true,
            depthTest: true,
            depthWrite: false,
          });

          const sprite = new THREE.Sprite(material);
          sprite.position.set(...hotspot.position);
          sprite.renderOrder = 20;
          sprite.userData.isHotspotSprite = true;
          sprite.userData.hotspot = hotspot;

          group.add(sprite);
          spotSprites.current.push({
            hotspot,
            sprite,
            localPosition: new THREE.Vector3(...hotspot.position),
            worldPosition: new THREE.Vector3(),
          });
        });

        loadedOrganId.current = organ.id;
        setLoading(false);
        setProgress(100);
      })
      .catch(err => {
        if (cancelled) return;
        console.error(err);
        setError(true);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [active, organ, spin]);

  useEffect(() => {
    if (!active) {
      unsubscribeFrame.current?.();
      unsubscribeFrame.current = null;
      return undefined;
    }

    unsubscribeFrame.current = subscribeFrame(() => {
      const camera = getCamera();
      const canvas = getCanvas();
      const group = getOrgansGroup();

      if (!camera || !canvas || !group || !group.visible) return;
      if (spotSprites.current.length === 0) return;

      const canvasHeight = canvas.clientHeight;
      if (!canvasHeight) return;

      group.updateMatrixWorld(true);

      const vFov = THREE.MathUtils.degToRad(camera.fov * 0.5);

      for (const item of spotSprites.current) {
        item.worldPosition
          .copy(item.localPosition)
          .applyMatrix4(group.matrixWorld);

        const distance = camera.position.distanceTo(item.worldPosition);
        const worldPerPixel = (2 * Math.tan(vFov) * distance) / canvasHeight;
        const spriteSize = HOTSPOT_SCREEN_RADIUS_PX * 2 * worldPerPixel;

        item.sprite.scale.set(spriteSize, spriteSize, 1);
      }
    });

    return () => {
      unsubscribeFrame.current?.();
      unsubscribeFrame.current = null;
    };
  }, [active]);

  useEffect(() => {
    if (!active) return undefined;

    const canvas = getCanvas();
    const camera = getCamera();

    if (!canvas || !camera) return undefined;

    const onPointerDown = event => {
      downPos.current = { x: event.clientX, y: event.clientY };
    };

    const onPointerUp = event => {
      if (!downPos.current) return;

      const dx = event.clientX - downPos.current.x;
      const dy = event.clientY - downPos.current.y;
      downPos.current = null;

      if (dx * dx + dy * dy > DRAG_THRESHOLD_PX2) return;

      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      pointer.current.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      raycaster.current.setFromCamera(pointer.current, camera);

      const sprites = spotSprites.current.map(item => item.sprite);
      const hits = raycaster.current.intersectObjects(sprites, false);

      if (hits.length > 0) {
        setSpot(hits[0].object.userData.hotspot);
      } else {
        setSpot(null);
      }
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointerup', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', onPointerUp);
    };
  }, [active, organ]);

  return (
    <section className="organsSection sectionScroll">
      <div className="sectionHead">
        <div className="sectionRuleRow">
          <span className="sectionRule" aria-hidden="true" />
          <span className="sectionLabel">Внутренние органы</span>
          <span className="sectionRule" aria-hidden="true" />
        </div>
        <h2 className="sectionTitle">Внутренние органы</h2>
        <p className="sectionSubtitle">
          Интерактивные трёхмерные модели основных органов и систем человека
        </p>
      </div>

      <div className="organsLayout">
        <aside className="panel libraryPanel">
          <div className="libraryHead">
            <h3 className="panelTitle">
              <span className="titleRule" aria-hidden="true" />
              <span>Органы</span>
              <span className="titleRule" aria-hidden="true" />
            </h3>
          </div>

          <nav className="organList" aria-label="Органы">
            {ORGANS.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={`organEntry ${organ.id === item.id ? 'organEntryActive' : ''}`}
                onClick={() => selectOrgan(item)}
                aria-pressed={organ.id === item.id}
              >
                <span className="organNum">{index + 1}.</span>
                <span className="organText">
                  <span className="organName">{item.ru}</span>
                  <span className="organSub">{item.system}</span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="stageWrap">
          <div className="stageFrame" ref={stageRef}>
            <div
              className={`loader ${!active || !loading ? 'loaderHidden' : ''}`}
              aria-hidden={!active || !loading}
            >
              <div className="loaderCard">
                {error ? (
                  <div className="loaderLabel">
                    Не удалось загрузить модель
                    <small>Проверьте соединение и обновите страницу</small>
                  </div>
                ) : (
                  <>
                    <div className="loaderLabel">Загрузка модели</div>
                    <div className="loaderBar">
                      <div className="loaderFill" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="loaderPct">{progress} %</div>
                  </>
                )}
              </div>
            </div>

            <div className="stageCaption">
              <span className="captionName">Рис. {number}. {organ.ru}</span>
            </div>

            <div className="stageControls">
              <button
                type="button"
                title="Автовращение"
                aria-label="Автовращение"
                aria-pressed={spin}
                className={`ctlBtn ${spin ? 'ctlBtnActive' : ''}`}
                onClick={toggleSpin}
              >
                ⟳
              </button>
              <button
                type="button"
                title="Сбросить вид"
                aria-label="Сбросить вид"
                className="ctlBtn"
                onClick={handleHome}
              >
                ⌂
              </button>
            </div>
          </div>
        </div>

        <aside className="panel infoPanel">
          {spot ? (
            <div className="infoContent">
              <div className="hsHead">
                <span
                  className="hsDot"
                  style={{ background: spot.color }}
                  aria-hidden="true"
                />
                <span className="hsKicker">{organ.ru} · строение органа</span>
                <button
                  className="closeX"
                  type="button"
                  title="Закрыть"
                  aria-label="Закрыть"
                  onClick={() => setSpot(null)}
                >
                  ×
                </button>
              </div>

              <div className="hsName">{spot.ru}</div>
              <div className="hsLatin">{spot.latin}</div>
              <p className="hsDesc">{spot.desc}</p>

              <hr className="infoDivider" />

              <div className="factsTitle">Об органе</div>
              <table className="facts">
                <tbody>
                  <tr>
                    <th scope="row">Орган</th>
                    <td>{organ.ru}</td>
                  </tr>
                  <tr>
                    <th scope="row">Система</th>
                    <td>{organ.system}</td>
                  </tr>
                  <tr>
                    <th scope="row">Функция</th>
                    <td>{organ.facts[3][1]}</td>
                  </tr>
                </tbody>
              </table>

              <button className="backLink" type="button" onClick={() => setSpot(null)}>
                ← Назад
              </button>
            </div>
          ) : (
            <div className="infoContent">
              <div className="infoTitleRow">
                <div>
                  <div className="infoTitle">{organ.ru}</div>
                  <div className="infoPoetic">{organ.poetic}</div>
                </div>
                <img
                  className="infoThumb"
                  src={`thumbs/${organ.id}.webp`}
                  alt={`Орган: ${organ.ru}`}
                  loading="lazy"
                />
              </div>

              <div className="infoMetaLine">
                {organ.system} · <em className="latin">{organ.latin}</em>
              </div>

              <p className="infoDesc">{organ.description}</p>

              <hr className="infoDivider" />

              <div className="factsTitle">Основные сведения</div>
              <table className="facts">
                <tbody>
                  {organ.facts.map(([key, value]) => (
                    <tr key={key}>
                      <th scope="row">{key}</th>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <hr className="infoDivider" />

              <div className="atlasGrid">
                {organ.atlas.map(([file, caption], index) => (
                  <button
                    key={file}
                    type="button"
                    className="atlasItem"
                    onClick={() =>
                      setLightbox([
                        organ,
                        file,
                        caption,
                        `Рис. ${number}${'абвг'[index]} — ${caption}`,
                      ])
                    }
                  >
                    <img
                      className="atlasImg"
                      src={`atlas/${organ.id}/${file}.webp`}
                      alt={caption}
                      loading="lazy"
                    />
                    <span className="atlasCap">
                      Рис. {number}{'абвг'[index]} — {caption}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {lightbox && (
        <div className="lightbox" onClick={closeLightbox}>
          <figure className="lightboxCard" onClick={event => event.stopPropagation()}>
            <button
              type="button"
              className="lightboxClose"
              onClick={closeLightbox}
              aria-label="Закрыть"
            >
              ×
            </button>
            <img
              className="lightboxImg"
              src={`atlas/${lightbox[0].id}/${lightbox[1]}.webp`}
              alt={lightbox[2]}
            />
            <figcaption className="lightboxCap">{lightbox[3]}</figcaption>
          </figure>
        </div>
      )}
    </section>
  );
}
