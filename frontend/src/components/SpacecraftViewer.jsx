import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { buildSpacecraft } from '../utils/spacecraftModels';
import { useReducedMotion } from '../hooks/useMediaQuery';
import { quality, pixelRatioFor } from '../utils/quality';

// Craft we ship a real mesh for; everything else is assembled from primitives.
const STL_MODELS = { iss: '/models/iss.stl' };

const SpacecraftViewer = ({ spacecraftId }) => {
    const mountRef = useRef(null);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;
        let mounted = true;
        let animId;

        const w = mount.clientWidth || 400;
        const h = mount.clientHeight || 280;

        const q = quality();
        const renderer = new THREE.WebGLRenderer({ antialias: q.antialias, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(pixelRatioFor(w, h));
        renderer.setClearColor(0x000000, 0);
        mount.appendChild(renderer.domElement);
        renderer.domElement.setAttribute('role', 'img');
        renderer.domElement.setAttribute('aria-label', 'Interactive 3D model — drag to rotate');

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, w / h, 0.01, 1000);
        camera.position.set(1.9, 1.5, 5.4);

        scene.add(new THREE.AmbientLight(0xffffff, 0.42));
        const key = new THREE.DirectionalLight(0xffffff, 2.0);
        key.position.set(5, 6, 5);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0x93a9ff, 0.45);
        fill.position.set(-5, -2, -4);
        scene.add(fill);
        const rim = new THREE.DirectionalLight(0xffe0b0, 0.5);
        rim.position.set(-3, 3, -6);
        scene.add(rim);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.06;
        controls.enablePan = false;
        controls.minDistance = 3;
        controls.maxDistance = 22;
        controls.autoRotate = !reduceMotion;
        controls.autoRotateSpeed = 0.9;

        // Built model — available immediately, no network round-trip
        const { group, geometries, materials } = buildSpacecraft(spacecraftId);
        scene.add(group);

        // Swap in a real mesh where we have one
        let stlGeo = null;
        let stlMat = null;
        const stlPath = STL_MODELS[spacecraftId];
        if (stlPath) {
            new STLLoader().load(
                stlPath,
                (geo) => {
                    if (!mounted) { geo.dispose(); return; }
                    geo.computeVertexNormals();
                    geo.center();
                    geo.computeBoundingSphere();
                    const s = 2.2 / (geo.boundingSphere?.radius || 1);
                    geo.scale(s, s, s);
                    stlGeo = geo;
                    stlMat = new THREE.MeshStandardMaterial({
                        color: '#c8ccd2', roughness: 0.42, metalness: 0.72,
                    });
                    scene.remove(group);
                    scene.add(new THREE.Mesh(geo, stlMat));
                },
                undefined,
                () => { /* keep the built model */ },
            );
        }

        const ro = new ResizeObserver(([entry]) => {
            if (!mounted) return;
            const { width, height } = entry.contentRect;
            if (!width || !height) return;
            // Re-budget on resize too: rotating a tablet changes the surface
            // area enough to matter.
            renderer.setPixelRatio(pixelRatioFor(width, height));
            renderer.setSize(width, height);
            camera.aspect = width / height;
            camera.updateProjectionMatrix();
        });
        ro.observe(mount);

        const animate = () => {
            if (!mounted) return;
            animId = requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            mounted = false;
            cancelAnimationFrame(animId);
            controls.dispose();
            ro.disconnect();
            geometries.forEach(g => g.dispose());
            materials.forEach(m => m.dispose());
            stlGeo?.dispose();
            stlMat?.dispose();
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
            renderer.dispose();
        };
    }, [spacecraftId, reduceMotion]);

    return <div ref={mountRef} style={{ width: '100%', height: 280 }} />;
};

export default SpacecraftViewer;
