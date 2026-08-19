"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GardenSectionData } from "./GardenScene";

function makeLabelTexture(name: string, dates: string, isNew: boolean, maxAnisotropy = 4): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 160;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.clearRect(0, 0, 256, 160);
  ctx.textAlign = "center";
  ctx.fillStyle = "#1c1917";
  ctx.font = "bold 44px serif";
  const short = name.length > 7 ? name.slice(0, 7) : name;
  ctx.fillText(short, 128, 66);
  ctx.font = "22px serif";
  ctx.fillStyle = "#44403c";
  ctx.fillText(dates, 128, 104);
  if (isNew) {
    ctx.fillStyle = "#b45309";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("NEW", 216, 28);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = Math.min(4, maxAnisotropy);
  return texture;
}

function makeSectionTexture(label: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(231,229,228,0.85)";
  ctx.font = "42px serif";
  ctx.fillText(`— ${label} —`, 256, 60);
  return new THREE.CanvasTexture(canvas);
}

export default function Garden3D({
  sections,
  lang,
  hint,
}: {
  sections: GardenSectionData[];
  lang: string;
  hint: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = Math.max(480, Math.min(640, Math.round(width * 0.55)));
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1126);
    scene.fog = new THREE.Fog(0x0b1126, 26, 78);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 200);
    camera.position.set(0, 5.2, 10.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    mount.appendChild(renderer.domElement);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2.05;
    controls.minDistance = 5;
    // 大墓园放宽拉远距离，保证能看全
    const totalMemorials = sections.reduce((n, s) => n + s.rows.length, 0);
    controls.maxDistance = totalMemorials > 20 ? 60 : 46;

    // lighting: cool ambient + warm moonlight
    scene.add(new THREE.AmbientLight(0x4a5580, 1.9));
    scene.add(new THREE.HemisphereLight(0x93a5cf, 0x141c10, 0.5));
    const moon = new THREE.DirectionalLight(0xfde68a, 2.2);
    moon.position.set(18, 24, 10);
    scene.add(moon);
    const fill = new THREE.PointLight(0x8aa2ff, 44, 46);
    fill.position.set(-6, 5, 4);
    scene.add(fill);

    // ground
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(220, 220),
      new THREE.MeshStandardMaterial({ color: 0x1c2415, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);

    // moon disc
    const moonMesh = new THREE.Mesh(
      new THREE.SphereGeometry(2.2, 24, 24),
      new THREE.MeshBasicMaterial({ color: 0xfef3c7 })
    );
    moonMesh.position.set(30, 26, -40);
    scene.add(moonMesh);

    // star dome
    const starCount = 500;
    const starPos = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.42;
      const r = 90;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi) * 0.7 + 4;
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta) - 20;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    const stars = new THREE.Points(
      starGeo,
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.28, sizeAttenuation: true, transparent: true, opacity: 0.85 })
    );
    scene.add(stars);

    // shared tombstone geometries/materials
    const slabGeo = new THREE.BoxGeometry(1.05, 1.15, 0.2);
    const topGeo = new THREE.CylinderGeometry(0.525, 0.525, 0.2, 20, 1, false, 0, Math.PI);
    topGeo.rotateX(Math.PI / 2);
    topGeo.rotateY(Math.PI / 2);
    const baseGeo = new THREE.BoxGeometry(1.3, 0.16, 0.62);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xbfbfc8, roughness: 0.8 });
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x6b6b73, roughness: 0.95 });

    const clickTargets: THREE.Object3D[] = [];
    const labelTextures: THREE.CanvasTexture[] = [];
    let sectionZ = 0;

    for (const section of sections) {
      const rows = section.rows;
      const cols = Math.max(2, Math.ceil(Math.sqrt(rows.length * 1.7)));
      const spacingX = 2.3;
      const spacingZ = 2.9;
      const rowsCount = Math.ceil(rows.length / cols);
      const depth = rowsCount * spacingZ + 5;

      // section label sprite
      const secTex = makeSectionTexture(section.label);
      labelTextures.push(secTex);
      const secSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: secTex, transparent: true }));
      secSprite.scale.set(7, 1.3, 1);
      secSprite.position.set(0, 2.4, sectionZ - 2.4);
      scene.add(secSprite);

      rows.forEach((memorial, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = (col - (cols - 1) / 2) * spacingX;
        const z = sectionZ + row * spacingZ;

        const group = new THREE.Group();
        group.position.set(x, 0, z);

        const slab = new THREE.Mesh(slabGeo, stoneMat);
        slab.position.y = 0.16 + 0.575;
        const top = new THREE.Mesh(topGeo, stoneMat);
        top.position.y = 0.16 + 1.15;
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.y = 0.08;
        group.add(slab, top, base);

        const dates = `${memorial.birth_date || "?"} ~ ${memorial.death_date || "?"}`;
        const tex = makeLabelTexture(memorial.name, dates, memorial.is_new === 1, maxAniso);
        labelTextures.push(tex);
        const label = new THREE.Mesh(
          new THREE.PlaneGeometry(0.98, 0.62),
          new THREE.MeshBasicMaterial({ map: tex, transparent: true })
        );
        label.position.set(0, 0.85, 0.105);
        group.add(label);

        group.userData.memorialId = memorial.id;
        group.traverse((obj) => (obj.userData.memorialId = memorial.id));
        scene.add(group);
        clickTargets.push(group);
      });

      sectionZ += depth;
    }

    const center = Math.max(0, sectionZ / 2 - 2);
    fill.position.set(-6, 5, center + 4);
    controls.target.set(0, 0.9, center);
    camera.position.set(0, 5.2, center + 10.5);

    // fireflies
    const flyCount = 42;
    const flyPos = new Float32Array(flyCount * 3);
    const flySeed: number[] = [];
    for (let i = 0; i < flyCount; i++) {
      flyPos[i * 3] = (Math.random() - 0.5) * 26;
      flyPos[i * 3 + 1] = 0.6 + Math.random() * 2.4;
      flyPos[i * 3 + 2] = Math.random() * Math.max(6, sectionZ);
      flySeed.push(Math.random() * Math.PI * 2);
    }
    const flyGeo = new THREE.BufferGeometry();
    flyGeo.setAttribute("position", new THREE.BufferAttribute(flyPos, 3));
    const fireflies = new THREE.Points(
      flyGeo,
      new THREE.PointsMaterial({ color: 0xfde68a, size: 0.16, transparent: true, opacity: 0.9 })
    );
    scene.add(fireflies);

    // click → enter memorial (with drag threshold so orbiting does not navigate)
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickTargets, true);
      const id = hits[0]?.object?.userData?.memorialId;
      if (id) router.push(`/${lang}/memorial/${id}`);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const onResize = () => {
      const w = mount.clientWidth;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener("resize", onResize);

    let raf = 0;
    const clock = new THREE.Clock();
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const pos = flyGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < flyCount; i++) {
        pos.setX(i, pos.getX(i) + Math.sin(t * 0.7 + flySeed[i]) * 0.006);
        pos.setY(i, 1.4 + Math.sin(t * 0.9 + flySeed[i] * 2) * 0.8);
      }
      pos.needsUpdate = true;
      stars.rotation.y = t * 0.004;
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      for (const tex of labelTextures) tex.dispose();
      slabGeo.dispose();
      topGeo.dispose();
      baseGeo.dispose();
      stoneMat.dispose();
      baseMat.dispose();
      starGeo.dispose();
      flyGeo.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [sections, lang, router]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-stone-800">
      <div ref={mountRef} className="w-full" />
      <p className="absolute bottom-3 left-0 right-0 text-center text-xs text-stone-400/80 pointer-events-none">
        {hint}
      </p>
    </div>
  );
}