/*
 * Скелет и мышцы — трёхмерный препарат под органами.
 * Данные: BodyParts3D / Anatomography, © DBCLS, CC BY-SA 2.1 JP.
 * Вьювер: three.js r128 (vendored), GLTFLoader + MeshoptDecoder + OrbitControls.
 *
 * Секция вставляется в DOM под основной сеткой органов (перед подвалом),
 * не вмешиваясь в работу React-приложения.
 */
(function () {
  'use strict';

  if (window.__anatomyBodyViewer) return;
  window.__anatomyBodyViewer = true;

  var PARTS = window.ANATOMY_PARTS || {};
  var MODELS = window.ANATOMY_MODELS || {
    skeletal: { url: 'anatomy/models/skeletal.glb', size: 0, count: 249 },
    muscular: { url: 'anatomy/models/muscular.glb', size: 0, count: 418 }
  };

  var SYS_LABEL = {
    skeletal: 'Скелет: кости, связки и перепонки',
    muscular: 'Мышцы и сухожилия'
  };

  /* ---------- утилиты ---------- */

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function sysWord(entry) {
    if (!entry) return '';
    var en = (entry.en || '').toLowerCase();
    var sys = entry.sys;
    if (sys === 'muscular') {
      if (en.indexOf('tendon') >= 0) return 'Сухожилие';
      if (en.indexOf('raphe') >= 0) return 'Шов';
      if (en.indexOf('tract') >= 0) return 'Фасция';
      if (en.indexOf('arch') >= 0) return 'Дуга';
      return 'Мышца';
    }
    if (en.indexOf('ligament') >= 0) return 'Связка';
    if (en.indexOf('membrane') >= 0) return 'Перепонка';
    if (en.indexOf('cartilage') >= 0 || en.indexOf('disk') >= 0) return 'Хрящ';
    if (en.indexOf('tendon') >= 0) return 'Сухожилие';
    if (en.indexOf('sesamoid') >= 0) return 'Сесамовидная кость';
    return 'Кость';
  }

  /* ---------- разметка секции ---------- */

  function buildSection() {
    var s = el('section', 'bsSection');
    s.id = 'skelet-i-myshcy';
    s.setAttribute('aria-label', 'Скелет и мышцы человека');
    s.innerHTML =
      '<div class="bsHeadTop">' +
        '<span class="topRule" aria-hidden="true"></span>' +
        '<span class="topLabel">Опорно-двигательный аппарат</span>' +
        '<span class="topRule" aria-hidden="true"></span>' +
      '</div>' +
      '<h2 class="bsTitle">Скелет и мышцы</h2>' +
      '<div class="brandOrn bsOrn" aria-hidden="true">' +
        '<span class="ornLine"></span><span class="ornStar">✻</span><span class="ornLine"></span>' +
      '</div>' +
      '<p class="bsSubtitle">Каркас из костей и ткань движения — то, что держит и перемещает нас</p>' +
      '<div class="bsGrid">' +
        '<div class="stageFrame bsStage">' +
          '<canvas class="bsCanvas" aria-label="Трёхмерная модель скелета и мышц"></canvas>' +
          '<div class="bsChips" role="group" aria-label="Слои препарата">' +
            '<button type="button" class="bsChip is-on" data-layer="skeletal"><span class="bsDot bsDotBone"></span>Скелет</button>' +
            '<button type="button" class="bsChip is-on" data-layer="muscular"><span class="bsDot bsDotMuscle"></span>Мышцы</button>' +
          '</div>' +
          '<div class="stageControls">' +
            '<button type="button" class="ctlBtn" id="bsXray" title="Рентген: мышцы полупрозрачные" aria-label="Рентген">◎</button>' +
            '<button type="button" class="ctlBtn" id="bsSpin" title="Медленное вращение" aria-label="Вращение">⟳</button>' +
            '<button type="button" class="ctlBtn" id="bsHome" title="Сбросить вид" aria-label="Сбросить вид">⌂</button>' +
          '</div>' +
          '<div class="stageCaption bsCaption"><span class="captionName" id="bsCaption"></span></div>' +
          '<div class="bsHint">вращение — мышь&nbsp;·&nbsp;масштаб — колесо&nbsp;·&nbsp;выбор — щелчок</div>' +
          '<div class="bsTip" id="bsTip" aria-hidden="true"><span class="bsTipRu"></span><span class="bsTipEn"></span></div>' +
          '<div class="loader bsLoader" id="bsLoader">' +
            '<div class="loaderCard">' +
              '<div class="loaderOrn">✻</div>' +
              '<div class="loaderLabel">Препараты тела<small>кости, связки и мышцы — <span id="bsPct">0</span>%</small></div>' +
              '<div class="loaderBar"><div class="loaderFill" id="bsFill"></div></div>' +
              '<div class="loaderPct" id="bsNote">атлас BodyParts3D, 2&nbsp;мм МРТ</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<aside class="bsAside">' +
          '<div class="bsTitleRow">' +
            '<h3 class="bsAsideTitle">О препарате</h3>' +
          '</div>' +
          '<div class="infoMetaLine">' + SYS_LABEL.skeletal + ' — ' + MODELS.skeletal.count +
            ' препарата<br>' + SYS_LABEL.muscular + ' — ' + MODELS.muscular.count + '</div>' +
          '<p class="infoDesc">Перед вами целый опорно-двигательный аппарат: двести шесть костей взрослого ' +
            'человека вместе со связками, межкостными перепонками и межпозвоночными дисками — и ' +
            'основные скелетные мышцы с сухожилиями. Наведите курсор на любую часть — атлас подскажет ' +
            'её название; щелчок закрепит выбор, а поиск справа найдёт нужную кость или мышцу по имени.</p>' +
          '<hr class="infoDivider">' +
          '<div class="factsTitle">Как читать препарат</div>' +
          '<table class="facts"><tbody>' +
            '<tr><th>Скелет</th><td>опора и защита; в препарате — 249 частей, включая связки и хрящи</td></tr>' +
            '<tr><th>Мышцы</th><td>движение и тепло; 418 препаратов, от мимических до икроножной</td></tr>' +
            '<tr><th>Рентген</th><td>мышцы становятся полупрозрачными, открывая скелет под ними</td></tr>' +
            '<tr><th>Данные</th><td>МРТ-сканы с шагом 2&nbsp;мм, единая система координат</td></tr>' +
          '</tbody></table>' +
          '<hr class="infoDivider">' +
          '<div class="factsTitle">Найти препарат</div>' +
          '<input class="bsSearch" id="bsSearch" type="text" autocomplete="off" ' +
            'placeholder="например: трапециевидная, femur, пятое ребро…" aria-label="Поиск препарата">' +
          '<div class="bsResults" id="bsResults"></div>' +
          '<div class="bsSel" id="bsSel">' +
            '<div class="bsSelMain">' +
              '<div class="bsSelRu" id="bsSelRu"></div>' +
              '<div class="bsSelEn" id="bsSelEn"></div>' +
              '<div class="bsSelSys" id="bsSelSys"></div>' +
            '</div>' +
            '<button type="button" class="bsSelX" id="bsSelX" aria-label="Снять выделение">×</button>' +
          '</div>' +
          '<p class="bsAttrib">Модель: BodyParts3D, © The Database Center for Life Science (DBCLS), ' +
            'лицензия CC BY-SA 2.1 Japan. Русские названия приведены по международной анатомической ' +
            'терминологии; в скобках — латинский термин атласа.</p>' +
        '</aside>' +
      '</div>';
    return s;
  }

  /* ---------- вставка секции в страницу ---------- */

  var section = null;

  function place() {
    if (!section) section = buildSection();
    if (section.isConnected) return true;
    var root = document.querySelector('.root');
    if (!root) return false;
    var footer = root.querySelector(':scope > footer') || root.querySelector('.footer');
    if (!footer) return false;
    root.insertBefore(section, footer);
    return true;
  }

  function whenPlaced(cb) {
    if (place()) { cb(); return; }
    var obs = new MutationObserver(function () {
      if (place()) { obs.disconnect(); cb(); }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
    // страховка по времени
    var tries = 0;
    var t = setInterval(function () {
      tries += 1;
      if (place()) { clearInterval(t); obs.disconnect(); cb(); }
      else if (tries > 200) { clearInterval(t); obs.disconnect(); }
    }, 100);
  }

  // если React когда-нибудь удалит секцию — вернём её на место
  function keepPlaced() {
    if (!('MutationObserver' in window)) return;
    var pending = false;
    var obs = new MutationObserver(function () {
      if (pending) return;
      pending = true;
      setTimeout(function () {
        pending = false;
        if (section && !section.isConnected) place();
      }, 250);
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ---------- трёхмерный вьювер ---------- */

  var COL = {
    bg: 0xf6f0e2,
    bone: 0xe6d9ba,
    muscle: 0xb54a3e,
    emissive: 0x8a231b
  };

  function initViewer(stage, canvas) {
    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
    } catch (e) {
      var note = stage.querySelector('#bsNote');
      if (note) note.textContent = 'Браузер не поддерживает WebGL — трёхмерная сцена недоступна';
      return null;
    }
    renderer.setClearColor(COL.bg, 1);
    renderer.outputEncoding = THREE.sRGBEncoding;

    var scene = new THREE.Scene();

    var camera = new THREE.PerspectiveCamera(38, 1, 0.1, 2000);

    /* свет: тёплый дневной, книжный */
    var hemi = new THREE.HemisphereLight(0xfff4e2, 0x9c8c6a, 0.9);
    scene.add(hemi);
    var key = new THREE.DirectionalLight(0xffe9d0, 0.85);
    key.position.set(0.55, 1.0, 0.85);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0xd9e0ec, 0.32);
    fill.position.set(-0.9, 0.35, -0.55);
    scene.add(fill);

    /* материалы систем */
    var matBone = new THREE.MeshStandardMaterial({ color: COL.bone, roughness: 0.74, metalness: 0.02 });
    var matMuscle = new THREE.MeshStandardMaterial({ color: COL.muscle, roughness: 0.56, metalness: 0.02 });
    var matBoneHover = matBone.clone(); matBoneHover.emissive = new THREE.Color(COL.emissive); matBoneHover.emissiveIntensity = 0.22;
    var matMuscleHover = matMuscle.clone(); matMuscleHover.emissive = new THREE.Color(COL.emissive); matMuscleHover.emissiveIntensity = 0.22;
    var matBoneSel = matBone.clone(); matBoneSel.emissive = new THREE.Color(COL.emissive); matBoneSel.emissiveIntensity = 0.42;
    var matMuscleSel = matMuscle.clone(); matMuscleSel.emissive = new THREE.Color(COL.emissive); matMuscleSel.emissiveIntensity = 0.42;

    var groups = { skeletal: new THREE.Group(), muscular: new THREE.Group() };
    scene.add(groups.skeletal, groups.muscular);

    var meshes = [];           // все меши обоих слоёв
    var byId = {};             // id -> mesh
    var loaded = { skeletal: false, muscular: false };
    var state = {
      hover: null,             // mesh
      selected: null,          // mesh
      xray: false,
      visible: { skeletal: true, muscular: true }
    };

    var controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.75;
    controls.autoRotateSpeed = 0.7;
    controls.enabled = false;  // до загрузки

    var raycaster = new THREE.Raycaster();
    var pointer = new THREE.Vector2();
    var pointerPx = { x: 0, y: 0, inside: false, moved: false };

    /* ---------- загрузка ---------- */

    var fillBar = stage.querySelector('#bsFill');
    var pct = stage.querySelector('#bsPct');
    var note = stage.querySelector('#bsNote');
    var loaderEl = stage.querySelector('#bsLoader');
    var caption = stage.querySelector('#bsCaption');
    var tip = stage.querySelector('#bsTip');
    var tipRu = tip.querySelector('.bsTipRu');
    var tipEn = tip.querySelector('.bsTipEn');

    var prog = { skeletal: 0, muscular: 0 };
    var weight = { skeletal: 0, muscular: 0 };
    var totalSize = (MODELS.skeletal.size || 1) + (MODELS.muscular.size || 1);
    weight.skeletal = (MODELS.skeletal.size || 1) / totalSize;
    weight.muscular = (MODELS.muscular.size || 1) / totalSize;

    function updateProgress() {
      var p = weight.skeletal * prog.skeletal + weight.muscular * prog.muscular;
      var percent = Math.min(100, Math.round(p * 100));
      if (fillBar) fillBar.style.width = percent + '%';
      if (pct) pct.textContent = String(percent);
    }

    function baseMatFor(sys) { return sys === 'skeletal' ? matBone : matMuscle; }
    function hoverMatFor(sys) { return sys === 'skeletal' ? matBoneHover : matMuscleHover; }
    function selMatFor(sys) { return sys === 'skeletal' ? matBoneSel : matMuscleSel; }

    function partIdOf(obj) {
      var o = obj;
      while (o) {
        if (o.name && PARTS[o.name]) return o.name;
        o = o.parent;
      }
      return null;
    }

    function applyMaterial(mesh) {
      var sys = mesh.userData.sys;
      if (state.selected === mesh) mesh.material = selMatFor(sys);
      else if (state.hover === mesh) mesh.material = hoverMatFor(sys);
      else mesh.material = baseMatFor(sys);
    }

    function refreshMaterials() {
      for (var i = 0; i < meshes.length; i++) applyMaterial(meshes[i]);
    }

    function applyXray() {
      matMuscle.transparent = state.xray;
      matMuscle.opacity = state.xray ? 0.30 : 1.0;
      matMuscle.depthWrite = !state.xray;
      matMuscle.needsUpdate = true;
      matMuscleHover.transparent = state.xray;
      matMuscleHover.opacity = state.xray ? 0.30 : 1.0;
      matMuscleHover.depthWrite = !state.xray;
      matMuscleSel.transparent = state.xray;
      matMuscleSel.opacity = state.xray ? 0.45 : 1.0;
      matMuscleSel.depthWrite = !state.xray;
    }

    function afterLoad(sys, gltf) {
      var sysMeshes = [];
      gltf.scene.traverse(function (o) {
        if (o.isMesh) {
          var id = partIdOf(o);
          if (!id) return;
          o.userData.partId = id;
          o.userData.sys = sys;
          o.material = baseMatFor(sys);
          sysMeshes.push(o);
        }
      });
      for (var i = 0; i < sysMeshes.length; i++) {
        meshes.push(sysMeshes[i]);
        byId[sysMeshes[i].userData.partId] = sysMeshes[i];
      }
      groups[sys].add(gltf.scene);
      loaded[sys] = true;
      if (loaded.skeletal && loaded.muscular) onAllLoaded();
    }

    function onAllLoaded() {
      updateProgress();
      fitHome(true);
      controls.enabled = true;
      if (loaderEl) {
        loaderEl.classList.add('is-hidden');
        setTimeout(function () { if (loaderEl) loaderEl.style.display = 'none'; }, 650);
      }
      renderOnce();
    }

    function loadFail(sys) {
      if (note) note.textContent = 'Не удалось загрузить модель (' + sys + '). Проверьте папку anatomy/models';
      if (loaderEl) loaderEl.classList.add('is-hidden');
    }

    function loadSystem(sys) {
      var loader = new THREE.GLTFLoader();
      if (window.MeshoptDecoder) loader.setMeshoptDecoder(window.MeshoptDecoder);
      loader.load(MODELS[sys].url, function (gltf) { afterLoad(sys, gltf); },
        function (xhr) {
          if (xhr.total > 0) { prog[sys] = xhr.loaded / xhr.total; updateProgress(); }
        },
        function () { loadFail(sys); });
    }

    /* ---------- камера ---------- */

    var home = null;

    function bboxOfScene() {
      var box = new THREE.Box3();
      var tmp = new THREE.Box3();
      ['skeletal', 'muscular'].forEach(function (sys) {
        if (!loaded[sys]) return;
        tmp.setFromObject(groups[sys]);
        box.union(tmp);
      });
      if (box.isEmpty()) {
        tmp.setFromObject(groups.skeletal);
        box.union(tmp);
      }
      return box;
    }

    function distFor(box) {
      var size = box.getSize(new THREE.Vector3());
      var radius = Math.max(size.x, size.y, size.z) * 0.5;
      var aspect = camera.aspect || 1;
      var vFov = (camera.fov * Math.PI) / 180;
      var hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
      var dV = radius / Math.tan(vFov / 2);
      var dH = radius / Math.tan(hFov / 2);
      return Math.max(dV, dH) * 1.22;
    }

    function fitHome(immediate) {
      var box = bboxOfScene();
      var center = box.getCenter(new THREE.Vector3());
      var dist = distFor(box);
      var dir = new THREE.Vector3(0.22, 0.14, 1).normalize();
      home = {
        pos: center.clone().add(dir.multiplyScalar(dist)),
        target: center.clone()
      };
      if (immediate) {
        camera.position.copy(home.pos);
        controls.target.copy(home.target);
        camera.updateProjectionMatrix();
      } else {
        tweenTo(home.pos, home.target, 750);
      }
    }

    /* плавный переход камеры */
    var tween = null;
    function tweenTo(pos, target, dur) {
      tween = {
        t0: performance.now(),
        dur: dur || 700,
        p0: camera.position.clone(), p1: pos.clone(),
        tA: controls.target.clone(), tB: target.clone()
      };
    }
    function stepTween(now) {
      if (!tween) return;
      var k = (now - tween.t0) / tween.dur;
      if (k >= 1) {
        camera.position.copy(tween.p1);
        controls.target.copy(tween.tB);
        tween = null;
        return;
      }
      var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      camera.position.lerpVectors(tween.p0, tween.p1, e);
      controls.target.lerpVectors(tween.tA, tween.tB, e);
    }

    /* ---------- выбор и подсказка ---------- */

    function pick() {
      if (!pointerPx.inside) return null;
      var rect = canvas.getBoundingClientRect();
      pointer.x = ((pointerPx.x - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((pointerPx.y - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      var vis = [];
      for (var i = 0; i < meshes.length; i++) {
        var m = meshes[i];
        if (m.visible && m.parent && state.visible[m.userData.sys] !== false) vis.push(m);
      }
      var hits = raycaster.intersectObjects(vis, false);
      return hits.length ? hits[0].object : null;
    }

    function captionTextFor(mesh) {
      if (!mesh) return '';
      var entry = PARTS[mesh.userData.partId];
      if (!entry) return '';
      return entry.ru || entry.en || '';
    }

    function setHover(mesh) {
      if (state.hover === mesh) return;
      state.hover = mesh;
      refreshMaterials();
      if (caption) caption.textContent = mesh ? captionTextFor(mesh) : '';
      if (!mesh || isCoarse) {
        tip.classList.remove('is-vis');
        return;
      }
      if (mesh) {
        var entry = PARTS[mesh.userData.partId];
        tipRu.textContent = (entry && (entry.ru || entry.en)) || '';
        tipEn.textContent = entry ? entry.en : '';
        tip.classList.add('is-vis');
        moveTip();
      }
    }

    function moveTip() {
      if (!tip.classList.contains('is-vis')) return;
      var rect = stage.getBoundingClientRect();
      var x = pointerPx.x - rect.left + 14;
      var y = pointerPx.y - rect.top + 16;
      var w = tip.offsetWidth, h = tip.offsetHeight;
      if (x + w > rect.width - 8) x = pointerPx.x - rect.left - w - 12;
      if (y + h > rect.height - 8) y = pointerPx.y - rect.top - h - 12;
      tip.style.left = Math.max(6, x) + 'px';
      tip.style.top = Math.max(6, y) + 'px';
    }

    var isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    function select(mesh) {
      state.selected = mesh;
      refreshMaterials();
      showSelection(mesh);
    }

    var selCard = null, selRu = null, selEn = null, selSys = null;
    function showSelection(mesh) {
      if (!selCard) return;
      if (!mesh) { selCard.classList.remove('is-vis'); return; }
      var entry = PARTS[mesh.userData.partId];
      selRu.textContent = (entry && (entry.ru || entry.en)) || '';
      selEn.textContent = entry ? entry.en : '';
      selSys.textContent = sysWord(entry) + ' · ' + SYS_LABEL[mesh.userData.sys].split(':')[0].toLowerCase();
      selCard.classList.add('is-vis');
    }

    function focusPart(id) {
      var mesh = byId[id];
      if (!mesh) return;
      if (!state.visible[mesh.userData.sys]) toggleLayer(mesh.userData.sys, true);
      select(mesh);
      var box = new THREE.Box3().setFromObject(mesh);
      var center = box.getCenter(new THREE.Vector3());
      var dist = Math.max(distFor(box), 1.6);
      var dir = camera.position.clone().sub(controls.target).normalize();
      if (dir.lengthSq() < 0.5) dir.set(0.2, 0.1, 1).normalize();
      tweenTo(center.clone().add(dir.multiplyScalar(dist)), center, 700);
    }

    /* ---------- события ---------- */

    canvas.addEventListener('pointermove', function (e) {
      pointerPx.x = e.clientX; pointerPx.y = e.clientY;
      pointerPx.inside = true; pointerPx.moved = true;
    });
    canvas.addEventListener('pointerleave', function () {
      pointerPx.inside = false;
      setHover(null);
    });
    var downPos = null;
    canvas.addEventListener('pointerdown', function (e) { downPos = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', function (e) {
      if (!downPos) return;
      var dx = e.clientX - downPos.x, dy = e.clientY - downPos.y;
      downPos = null;
      if (dx * dx + dy * dy > 25) return; // это было вращение
      var mesh = pick();
      select(mesh);
    });

    /* поиск */
    var search = document.getElementById('bsSearch');
    var results = document.getElementById('bsResults');
    function norm(v) { return (v || '').toLowerCase().replace(/ё/g, 'е'); }
    function stem(v) {
      // урезаем окончание: «трапециевидная» → «трапециевидн», «пятое» → «пят»
      if (v.length > 6) return v.slice(0, v.length - 2);
      if (v.length > 4) return v.slice(0, v.length - 1);
      return v;
    }
    function runSearch(q) {
      q = norm(q.trim());
      results.innerHTML = '';
      if (q.length < 2) return;
      var st = stem(q);
      var scored = [];
      var keys = Object.keys(PARTS);
      for (var i = 0; i < keys.length; i++) {
        var id = keys[i], entry = PARTS[id];
        var ru = norm(entry.ru), en = norm(entry.en);
        var score = -1;
        if (ru === q || en === q) score = 5;
        else if (ru.indexOf(q) === 0 || en.indexOf(q) === 0) score = 4;
        else if (st.length >= 4 && (ru.indexOf(st) === 0 || en.indexOf(st) === 0)) score = 3;
        else if (ru.indexOf(q) >= 0) score = 2;
        else if (en.indexOf(q) >= 0) score = 2;
        else if (st.length >= 4 && ru.indexOf(st) >= 0) score = 1;
        else if (st.length >= 4 && en.indexOf(st) >= 0) score = 1;
        if (score > 0) scored.push([score, id, entry]);
      }
      scored.sort(function (a, b) { return b[0] - a[0]; });
      var limit = Math.min(scored.length, 14);
      for (var j = 0; j < limit; j++) {
        (function (id, entry) {
          var b = el('button', 'bsResult');
          b.type = 'button';
          b.innerHTML = '<span class="bsResultRu">' + (entry.ru || entry.en) + '</span>' +
            '<span class="bsResultEn">' + entry.en + '</span>';
          b.addEventListener('click', function () { focusPart(id); });
          results.appendChild(b);
        })(scored[j][1], scored[j][2]);
      }
      if (limit < scored.length) {
        results.appendChild(el('div', 'bsEmpty', 'и ещё ' + (scored.length - limit) + ' — уточните запрос'));
      } else if (!scored.length) {
        results.appendChild(el('div', 'bsEmpty', 'Ничего не найдено — попробуйте по-русски или по-латыни'));
      }
    }
    if (search) search.addEventListener('input', function () { runSearch(search.value); });

    /* ---------- панели управления ---------- */

    var xrayBtn = document.getElementById('bsXray');
    var spinBtn = document.getElementById('bsSpin');
    var homeBtn = document.getElementById('bsHome');

    function toggleLayer(sys, forceOn) {
      var on = forceOn === true ? true : !state.visible[sys];
      state.visible[sys] = on;
      groups[sys].visible = on;
      var chip = section.querySelector('.bsChip[data-layer="' + sys + '"]');
      if (chip) chip.classList.toggle('is-on', on);
      if (!on && state.selected && state.selected.userData.sys === sys) select(null);
    }

    section.querySelectorAll('.bsChip').forEach(function (chip) {
      chip.addEventListener('click', function () { toggleLayer(chip.getAttribute('data-layer')); });
    });

    if (xrayBtn) xrayBtn.addEventListener('click', function () {
      state.xray = !state.xray;
      xrayBtn.classList.toggle('ctlBtnActive', state.xray);
      applyXray();
    });
    if (spinBtn) spinBtn.addEventListener('click', function () {
      controls.autoRotate = !controls.autoRotate;
      spinBtn.classList.toggle('ctlBtnActive', controls.autoRotate);
    });
    if (homeBtn) homeBtn.addEventListener('click', function () { fitHome(false); });
    var selX = document.getElementById('bsSelX');
    if (selX) selX.addEventListener('click', function () { select(null); });

    selCard = document.getElementById('bsSel');
    selRu = document.getElementById('bsSelRu');
    selEn = document.getElementById('bsSelEn');
    selSys = document.getElementById('bsSelSys');

    /* ---------- размер и цикл ---------- */

    function resize() {
      var w = stage.clientWidth, h = stage.clientHeight;
      if (!w || !h) return;
      var pr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(pr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(resize);
      ro.observe(stage);
    } else {
      window.addEventListener('resize', resize);
    }
    resize();

    var visibleOnScreen = true;
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        visibleOnScreen = entries[0].isIntersecting;
      }, { rootMargin: '120px' });
      io.observe(stage);
    }

    var hoverTick = 0;
    function loop(now) {
      requestAnimationFrame(loop);
      if (document.hidden || !visibleOnScreen) return;
      stepTween(now);
      if (controls.enabled) controls.update();
      if (pointerPx.moved && !isCoarse) {
        pointerPx.moved = false;
        var nowMs = performance.now();
        if (nowMs - hoverTick > 40) {
          hoverTick = nowMs;
          setHover(pick());
          moveTip();
        }
      }
      renderer.render(scene, camera);
    }
    function renderOnce() { renderer.render(scene, camera); }
    requestAnimationFrame(loop);

    /* ---------- старт ---------- */
    loadSystem('skeletal');
    loadSystem('muscular');

    return {
      focusPart: focusPart,
      fitHome: fitHome
    };
  }

  /* ---------- отложенный старт: грузим модели, когда секция близко ---------- */

  function boot(stage, canvas) {
    var started = false;
    function start() {
      if (started) return;
      started = true;
      initViewer(stage, canvas);
    }
    if (!('IntersectionObserver' in window)) { start(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); start(); }
    }, { rootMargin: '700px' });
    io.observe(stage);
    // страховка: если вкладка открыта сразу на секции и событие не пришло
    setTimeout(start, 4000);
  }

  whenPlaced(function () {
    keepPlaced();
    var stage = section.querySelector('.bsStage');
    var canvas = section.querySelector('.bsCanvas');
    if (stage && canvas) boot(stage, canvas);
  });
})();
