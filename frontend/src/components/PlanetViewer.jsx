import { useRef, useEffect } from 'react';
import * as THREE from 'three';

const TEXTURE_URLS = {
    Sun:       '/textures/sun.jpg',
    Mercury:   '/textures/mercury.jpg',
    Venus:     '/textures/venus.jpg',
    Earth:     '/textures/earth.jpg',
    Mars:      '/textures/mars.jpg',
    Jupiter:   '/textures/jupiter.jpg',
    Saturn:    '/textures/saturn.jpg',
    Uranus:    '/textures/uranus.jpg',
    Neptune:   '/textures/neptune.jpg',
    Luna:      '/textures/moon.jpg',
    Io:        '/textures/io.jpg',
    Europa:    '/textures/europa.jpg',
    Ganymede:  '/textures/ganymede.jpg',
    Titan:     '/textures/titan.jpg',
    Enceladus: '/textures/enceladus.jpg',
    Triton:    '/textures/triton.jpg',
};

const PLANET_COLORS = {
    Sun:      '#fdb813',
    Mercury:  '#b5b5b5',
    Venus:    '#e8cda0',
    Earth:    '#4fa3e0',
    Mars:     '#c1440e',
    Jupiter:  '#c88b3a',
    Saturn:   '#e4d191',
    Uranus:   '#7de8e8',
    Neptune:  '#5b7fdb',
    Pluto:    '#d9c3a8',
    Luna:     '#c8c8c8',
    Ceres:    '#8a8a7a',
    Vesta:    '#7a7060',
    Pallas:   '#6a6a60',
    Haumea:   '#ccc8c0',
    Makemake: '#c8c4b8',
    Eris:     '#d0cece',
    "Halley's Comet": '#3a3a38',
};

const PlanetViewer = ({ planetName }) => {
    const mountRef = useRef(null);

    useEffect(() => {
        const mount = mountRef.current;
        if (!mount) return;

        const w = mount.clientWidth || 400;

        // No scene.background — canvas alpha channel handles transparency
        const scene = new THREE.Scene();

        const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        camera.position.z = planetName === 'Saturn' ? 9 : 4;
        if (planetName === 'Saturn') {
            camera.position.y = -2;   // lower viewpoint
            camera.lookAt(0, 0, 0);   // keep pointed at the planet
        }

        // alpha:true enables per-pixel transparency; premultipliedAlpha:false avoids
        // dark fringing on the sphere silhouette against the starfield
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, premultipliedAlpha: false });
        renderer.setSize(w, w);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x000000, 0); // fully transparent clear
        mount.appendChild(renderer.domElement);

        // Key light from upper-right (sun side), dim fill from the opposite
        const keyLight = new THREE.DirectionalLight(0xffffff, 1.4);
        keyLight.position.set(5, 3, 4);
        scene.add(keyLight);
        scene.add(new THREE.AmbientLight(0xffffff, 0.18));

        const geometry = new THREE.SphereGeometry(1.5, 64, 64);

        const color = PLANET_COLORS[planetName] ?? '#ffffff';
        const colorMaterial = new THREE.MeshPhongMaterial({ color });
        const mesh = new THREE.Mesh(geometry, colorMaterial);

        // Saturn: place sphere + ring in a group tilted toward the camera so the
        // ring plane appears as a wide flat ellipse (classic overhead-angle view).
        // Other planets: add sphere directly to scene.
        const saturnGroup = planetName === 'Saturn' ? new THREE.Group() : null;
        if (saturnGroup) {
            saturnGroup.rotation.x = 0.4; // ~23° overhead tilt
            saturnGroup.add(mesh);
            scene.add(saturnGroup);
        } else {
            scene.add(mesh);
        }

        // Saturn rings — loaded asynchronously, tracked for cleanup
        const ringResources = { geo: null, mat: null, texture: null };
        if (planetName === 'Saturn') {
            const ringGeo = new THREE.RingGeometry(2.0, 3.5, 64);
            // RingGeometry UV mapping is broken by default; remap so the texture
            // spreads radially from inner edge (u=0) to outer edge (u=1)
            const pos = ringGeo.attributes.position;
            const uv  = ringGeo.attributes.uv;
            for (let i = 0; i < pos.count; i++) {
                const vertex = new THREE.Vector3().fromBufferAttribute(pos, i);
                uv.setXY(i, (vertex.length() - 2.0) / (3.5 - 2.0), 0);
            }
            const ringMat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.85, alphaTest: 0.05 });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2; // flat in the group's local xz-plane
            saturnGroup.add(ring);
            ringResources.geo = ringGeo;
            ringResources.mat = ringMat;
            new THREE.TextureLoader().load(
                '/textures/saturn_ring.png',
                (tex) => {
                    ringResources.texture = tex;
                    ringMat.map = tex;
                    ringMat.needsUpdate = true;
                },
                undefined,
                (err) => console.error('[PlanetViewer] Ring texture failed:', err)
            );
        }

        const resources = { material: colorMaterial, texture: null, nightTex: null, cloudsTex: null };

        if (planetName === 'Earth') {
            // Earth: three-texture day/night/clouds shader
            let dayTex = null, nightTex = null, cloudsTex = null;
            const tl = new THREE.TextureLoader();
            const tryApply = () => {
                if (!dayTex || !nightTex || !cloudsTex) return;
                const shaderMat = new THREE.ShaderMaterial({
                    uniforms: {
                        dayMap:       { value: dayTex },
                        nightMap:     { value: nightTex },
                        cloudsMap:    { value: cloudsTex },
                        // Static sun direction: right side lit, gives a clean terminator on the spinning globe
                        sunDirection: { value: new THREE.Vector3(1, 0, 0) },
                    },
                    vertexShader: `
                        varying vec2 vUv;
                        varying vec3 vWorldNormal;
                        void main() {
                            vUv = uv;
                            vWorldNormal = normalize(mat3(modelMatrix) * normal);
                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                        }
                    `,
                    fragmentShader: `
                        uniform sampler2D dayMap;
                        uniform sampler2D nightMap;
                        uniform sampler2D cloudsMap;
                        uniform vec3 sunDirection;
                        varying vec2 vUv;
                        varying vec3 vWorldNormal;
                        void main() {
                            vec3 normal = normalize(vWorldNormal);
                            float cosAngle = dot(normal, sunDirection);
                            float dayBlend = smoothstep(-0.12, 0.12, cosAngle);
                            vec4 day    = texture2D(dayMap,    vUv);
                            vec4 night  = texture2D(nightMap,  vUv);
                            vec4 clouds = texture2D(cloudsMap, vUv);
                            vec3 surface = mix(night.rgb, day.rgb, dayBlend);
                            float cloudDensity = clouds.r;
                            vec3 cloudColor = mix(clouds.rgb * 0.05, clouds.rgb, dayBlend);
                            surface = mix(surface, cloudColor, cloudDensity * 0.85);
                            gl_FragColor = vec4(surface, 1.0);
                        }
                    `,
                });
                mesh.material = shaderMat;
                colorMaterial.dispose();
                resources.material  = shaderMat;
                resources.texture   = dayTex;
                resources.nightTex  = nightTex;
                resources.cloudsTex = cloudsTex;
            };
            tl.load('/textures/earth.jpg',        (t) => { dayTex    = t; tryApply(); }, undefined, (e) => console.error('[PlanetViewer] earth day failed:', e));
            tl.load('/textures/earth_night.jpg',  (t) => { nightTex  = t; tryApply(); }, undefined, (e) => console.error('[PlanetViewer] earth night failed:', e));
            tl.load('/textures/earth_clouds.jpg', (t) => { cloudsTex = t; tryApply(); }, undefined, (e) => console.error('[PlanetViewer] earth clouds failed:', e));
        } else {
            const textureUrl = TEXTURE_URLS[planetName];
            if (textureUrl) {
                const isMoon = ['Luna','Io','Europa','Ganymede','Titan','Enceladus','Triton'].includes(planetName);
                new THREE.TextureLoader().load(
                    textureUrl,
                    (tex) => {
                        const texMaterial = new THREE.MeshStandardMaterial({
                            map:       tex,
                            roughness: isMoon ? 0.95 : 0.8,
                            metalness: 0.0,
                        });
                        mesh.material = texMaterial;
                        colorMaterial.dispose();
                        resources.material = texMaterial;
                        resources.texture  = tex;
                    },
                    undefined,
                    (err) => console.error(`[PlanetViewer] Texture failed for ${planetName}:`, err)
                );
            }
        }

        // Resize: keep canvas square and matching container width
        const ro = new ResizeObserver(entries => {
            const size = entries[0]?.contentRect.width;
            if (size && size > 0) {
                renderer.setSize(size, size);
                camera.updateProjectionMatrix();
            }
        });
        ro.observe(mount);

        let animId;
        const animate = () => {
            animId = requestAnimationFrame(animate);
            mesh.rotation.y += 0.003;
            renderer.render(scene, camera);
        };
        animate();

        return () => {
            cancelAnimationFrame(animId);
            ro.disconnect();
            if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
            renderer.dispose();
            geometry.dispose();
            resources.material.dispose();
            if (resources.texture)   resources.texture.dispose();
            if (resources.nightTex)  resources.nightTex.dispose();
            if (resources.cloudsTex) resources.cloudsTex.dispose();
            if (ringResources.geo) ringResources.geo.dispose();
            if (ringResources.mat) ringResources.mat.dispose();
            if (ringResources.texture) ringResources.texture.dispose();
        };
    }, [planetName]);

    // No background, no border — the canvas floats transparently over the starfield
    return <div ref={mountRef} style={{ width: '100%', aspectRatio: '1 / 1' }} />;
};

export default PlanetViewer;
