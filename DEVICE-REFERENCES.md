# Original handset assets and provenance

Active hardware is exported from the original IPhone / Galaxy components of
[area-is/react-3d-mockups](https://github.com/area-is/react-3d-mockups), npm
react-3d-mockups@0.2.0, MIT, copyright 2026 Ye Joo Park. The lockfile pins package
integrity; assets/devices/LICENSE.txt retains the complete source license.

| Model | Source variant | H × W × D (mm) | Meshopt GLB bytes |
|---|---|---|---|
| iPhone 18 Pro Max | IPhone 18promax | 163.4 × 78 × 8.75 | 658,068 |
| Galaxy S26 Ultra | Galaxy s26ultra | 163.6 × 78.1 × 7.9 | 375,440 |
| iPhone 18 Pro | IPhone 18pro | 150 × 71.9 × 8.75 | 629,652 |
| Galaxy S26 | Galaxy s26 | 149.6 × 71.7 × 7.2 | 313,096 |

These are upstream visual mockups, not manufacturer CAD. Published body sizes
normalize the exported geometry to one scale of 5.4 world units/mm. Fine details
and display rectangles follow upstream measurements. Cameras, lens layers,
ports, logos, cutouts, buttons and PBR material properties come from the actual
components, rather than a new reconstruction based only on their size tables.
The native screen uses a 390 CSS-pixel width with a model-specific height.

Requested Xiaomi 17 Ultra and Huawei models are absent from this upstream
catalog and are not currently offered. An unrelated handset must not be
relabeled as one of them. Adding these requires suitable assets and provenance,
followed by the same visual and performance checks.

## Reproducible export

qa-original-models.jsx renders the original hardware components. Only upstream
DeviceScreen is stubbed during offline authoring because the site already owns
its live HTML screen. The exporter preserves material render traits and records
finish-sensitive materials by comparing two source colors. Runtime tinting uses
the source railColor helper while preserving original physical properties.

qa-build-original.cjs exports GLTF, deduplicates, flattens, joins, welds and
meshopt-compresses geometry. It writes content-hashed GLBs, a full manifest and
the small generated js/device-profiles.js. The source studio Lightformers are
baked to a HalfFloat CubeUV atlas: 68,257 bytes gzipped, preserving HDR intensity
without runtime PMREM convolution.

qa-build-runtime.cjs vendors one shared Three.js 0.186.1 engine, GLTFLoader,
the Meshopt decoder and the small finish helper. React, ReactDOM, R3F, Drei and
the source package are offline authoring dependencies; the website never loads
them. Three.js and Meshoptimizer notices remain under vendor/.

With existing dependencies and the shared PLAYWRIGHT_MODULE / CHROME_PATH
runtime, run node qa-build-original.cjs. EXPORT_FIRST_ONLY=1 bounds an initial
trial to one model. qa-generated/ is reproducible authoring output excluded from
Git and deployment. The pipeline performs no Vercel operation.

## Other reviewed sources

- [phone-mockup-studio](https://github.com/quentin-pla/phone-mockup-studio):
  screenshot export application, different catalog, separate model attribution.
  Do not relabel older assets as newer handsets. Legacy repository assets are
  inactive and excluded from deployment.
- [react-mockframe](https://github.com/mbdev3/react-mockframe): CSS device frames,
  suitable for flat presentation rather than the selected 3D material approach.
