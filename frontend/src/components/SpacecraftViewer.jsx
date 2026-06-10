import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// Map spacecraft id → model path under /public/models/
const MODEL_PATHS = {
    iss:            '/models/iss.glb',
    hubble:         '/models/hubble.glb',
    jwst:           '/models/jwst.glb',
    voyager1:       '/models/voyager.glb',
    voyager2:       '/models/voyager.glb',
    'new-horizons': '/models/new_horizons.glb',
};

function buildFallback(group) {
    const metal = new THREE.MeshStandardMaterial({ color: '#b0b8c0', roughness: 0.3, metalness: 0.8 });
    const dark  = new THREE.MeshStandardMaterial({ color: '#1a2a66', roughness: 0.5, metalness: 0.4 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.55, 0.55), metal);

    const panelL = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 0.7), dark);
    panelL.position.set(-2.3, 0, 0);
    const panelR = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 0.7), dark);
    panelR.position.set( 2.3, 0, 0);

    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.05, 0.1, 16), metal);
    dish.rotation.z = Math.PI / 2;
    dish.position.set(0, 0.45, 0);

    group.add(body, panelL, panelR, dish);
}

const SpacecraftViewer = ({ spacecraftId }) => {
    const mountRef = useRef(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;
        let mounted = true;
        let animId;

        const w = mount.clientWidth  || 400;
        const h = mount.clientHeight || 280;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0);
        mount.appendChild(renderer.domElement);

        const scene  = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, w / h, 0.01, 1000);
        camera.position.set(0, 1.8, 8);

        scene.add(new THREE.AmbientLight(0xffffff, 0.55));
        const key = new THREE.DirectionalLight(0xffffff, 1.4);
        key.position.set(5, 6, 5);
        scene.add(key);
        const fill = new THREE.DirectionalLight(0x8899ff, 0.25);
        fill.position.set(-4, -3, -4);
        scene.add(fill);

        const modelGroup = new THREE.Group();
        scene.add(modelGroup);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping   = true;
        controls.dampingFactor   = 0.06;
        controls.enablePan       = false;
        controls.minDistance     = 3;
        controls.maxDistance     = 22;
        controls.autoRotate      = true;
        controls.autoRotateSpeed = 0.7;

        const modelPath = MODEL_PATHS[spacecraftId];
        if (modelPath) {
            new GLTFLoader().load(
                modelPath,
                (gltf) => {
                    if (!mounted) return;
                    const model = gltf.scene;
                    const box   = new THREE.Box3().setFromObject(model);
                    const size  = box.getSize(new THREE.Vector3());
                    const maxDim = Math.max(size.x, size.y, size.z);
                    if (maxDim > 0) {
                        const s = 4 / maxDim;
                        model.scale.setScalar(s);
                        const center = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
                        model.position.sub(center);
                    }
                    modelGroup.add(model);
                },
                undefined,
                () => { if (mounted) buildFallback(modelGroup); },
            );
        } else {
            buildFallback(modelGroup);
        }

        const ro = new ResizeObserver(([entry]) => {
            if (!mounted) return;
            const { width, height } = entry.contentRect;
            if (!width || !height) return;
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
            renderer.dispose();
            ro.disconnect();
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
        };
    }, [spacecraftId]);

    return <div ref={mountRef} style={{ width: '100%', height: '260px' }} />;
};

export default SpacecraftViewer;
