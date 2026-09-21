import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { ContactShadows, Edges, OrbitControls, RoundedBox } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { getModule } from '../data/cabinetLibrary'
import { findDoorMaterial } from '../data/boardMaterials'
import SceneErrorBoundary from './SceneErrorBoundary'
import type { PlacedUnit } from '../engine/rules'
import type { BoardMaterial } from '../data/boardMaterials'

const mm = (v: number) => v / 1000
const GOLD = '#FFC400'

// Texture cache — a failed load resolves to null (flat-colour fallback),
// never throws, so the scene can never be taken down by a missing image.
const textureCache = new Map<string, THREE.Texture | null>()

function useSafeTexture(url: string | null): THREE.Texture | null {
  const [tex, setTex] = useState<THREE.Texture | null>(() => (url ? textureCache.get(url) ?? null : null))
  useEffect(() => {
    if (!url) {
      setTex(null)
      return
    }
    const cached = textureCache.get(url)
    if (cached !== undefined) {
      setTex(cached)
      return
    }
    let cancelled = false
    new THREE.TextureLoader().load(
      url,
      t => {
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 8
        textureCache.set(url, t)
        if (!cancelled) setTex(t)
      },
      undefined,
      () => {
        textureCache.set(url, null)
        if (!cancelled) setTex(null)
      },
    )
    return () => {
      cancelled = true
    }
  }, [url])
  return tex
}

// Door-material mesh builder — real board texture when a crop exists.
function useBoardMaterial(mat: BoardMaterial | undefined) {
  const url = mat?.renderTexture || null
  const texture = useSafeTexture(url)
  return useMemo(() => {
    const isGloss = mat?.texture === 'gloss'
    const isMatt = mat?.texture === 'matt' || mat?.texture === 'super-matte'
    const map = url && texture?.image ? texture : null
    const color = map ? new THREE.Color('#ffffff') : new THREE.Color(mat?.hex || '#cccccc')
    if (isGloss) {
      return new THREE.MeshPhysicalMaterial({ color, map, roughness: 0.3, clearcoat: 0.4, clearcoatRoughness: 0.3 })
    }
    if (isMatt) {
      return new THREE.MeshStandardMaterial({ color, map, roughness: 0.9, metalness: 0.02 })
    }
    return new THREE.MeshStandardMaterial({ color, map, roughness: 0.65, metalness: 0.03 })
  }, [mat, texture, url])
}

function usePointerCursor() {
  return {
    onPointerOver: (e: { stopPropagation: () => void }) => {
      e.stopPropagation()
      document.body.style.cursor = 'pointer'
    },
    onPointerOut: () => {
      document.body.style.cursor = 'auto'
    },
  }
}

function Handle({ position, direction = 'horizontal', length = 0.26 }: { position: [number, number, number]; direction?: 'horizontal' | 'vertical'; length?: number }) {
  const isV = direction === 'vertical'
  const rot = isV ? [0, 0, 0] as const : [0, 0, Math.PI / 2] as const
  const half = length / 2
  const posts: [number, number, number][] = isV ? [[0, -half * 0.7, 0], [0, half * 0.7, 0]] : [[-half * 0.7, 0, 0], [half * 0.7, 0, 0]]
  return (
    <group position={position}>
      {posts.map((p, i) => (
        <mesh key={i} position={p} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.006, 0.006, 0.04]} />
          <meshStandardMaterial color="#B9B9B9" metalness={0.95} roughness={0.18} />
        </mesh>
      ))}
      <mesh position={[0, 0, 0.04]} rotation={rot as unknown as [number, number, number]}>
        <cylinderGeometry args={[0.008, 0.008, length, 16]} />
        <meshStandardMaterial color="#D8D8D8" metalness={0.95} roughness={0.1} />
      </mesh>
    </group>
  )
}

interface CabinetMeshProps {
  unit: PlacedUnit
  doorMat: BoardMaterial | undefined
  selected: boolean
  onSelect: () => void
}

/** Parametric cabinet — carcass + front(s) + handles, sized from the module. */
function CabinetMesh({ unit, doorMat, selected, onSelect }: CabinetMeshProps) {
  const m = getModule(unit.moduleId)
  const frontMat = useBoardMaterial(doorMat)
  const cursor = usePointerCursor()
  const carcassMat = useMemo(() => {
    // a shade darker than the door colour so the cabinet edges read
    const c = new THREE.Color(doorMat?.hex || '#F7F7F5').multiplyScalar(0.92)
    return new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })
  }, [doorMat])
  const w = mm(unit.widthMm)
  const h = mm(m.heightMm)
  const d = mm(m.depthMm)
  const isWall = unit.mounted === 'wall'
  const legH = 0.15
  const bodyY = isWall ? 1.45 + h / 2 : m.kind === 'tall' ? h / 2 : legH + h / 2
  const frontZ = d / 2 + 0.005

  const doorCount = unit.widthMm <= 600 ? 1 : 2
  const doorW = doorCount === 1 ? w - 0.004 : (w - 0.012) / 2

  let fronts: ReactNode = null
  if (m.kind === 'drawer') {
    const n = 3
    const dh = (h - 0.004) / n
    fronts = Array.from({ length: n }).map((_, i) => (
      <group key={i} position={[0, -h / 2 + dh / 2 + i * dh, 0]}>
        <mesh position={[0, 0, frontZ]} material={frontMat} castShadow>
          <boxGeometry args={[w - 0.004, dh - 0.004, 0.018]} />
        </mesh>
        <Handle position={[0, dh * 0.2, frontZ + 0.02]} length={Math.min(w * 0.4, 0.28)} />
      </group>
    ))
  } else if (m.kind === 'oven') {
    fronts = (
      <>
        <mesh position={[0, 0.05, frontZ]}>
          <boxGeometry args={[w - 0.02, h * 0.62, 0.02]} />
          <meshStandardMaterial color="#181818" roughness={0.25} metalness={0.4} />
        </mesh>
        <mesh position={[0, -h / 2 + 0.09, frontZ]} material={frontMat} castShadow>
          <boxGeometry args={[w - 0.004, 0.14, 0.018]} />
        </mesh>
        <Handle position={[0, -h / 2 + 0.09, frontZ + 0.02]} length={Math.min(w * 0.4, 0.28)} />
      </>
    )
  } else if (m.kind === 'filler') {
    fronts = (
      <mesh position={[0, 0, d / 2 + 0.002]} material={frontMat}>
        <boxGeometry args={[w, h * 0.96, 0.016]} />
      </mesh>
    )
  } else {
    // base / wall / tall / sink — 1 or 2 doors
    fronts = Array.from({ length: doorCount }).map((_, i) => {
      const x = doorCount === 1 ? 0 : -w / 2 + doorW / 2 + i * (doorW + 0.008)
      const vHandle = m.kind === 'tall'
      return (
        <group key={i} position={[x, 0, 0]}>
          <mesh position={[0, 0, frontZ]} material={frontMat} castShadow>
            <boxGeometry args={[doorW, h * 0.94, 0.018]} />
          </mesh>
          <Handle
            position={[doorCount === 2 ? (i === 0 ? doorW / 2 - 0.05 : -doorW / 2 + 0.05) : doorW / 2 - 0.05, vHandle ? 0 : -h * 0.32, frontZ + 0.02]}
            direction={vHandle ? 'vertical' : 'horizontal'}
            length={vHandle ? Math.min(h * 0.35, 0.5) : Math.min(doorW * 0.4, 0.24)}
          />
        </group>
      )
    })
  }

  return (
    <group position={[0, bodyY, 0]} onClick={e => { e.stopPropagation(); onSelect() }} {...cursor}>
      {/* carcass */}
      <RoundedBox args={[w, h, d]} radius={0.008} smoothness={2} material={carcassMat} castShadow receiveShadow>
        {selected && <Edges color={GOLD} lineWidth={2} />}
      </RoundedBox>
      {fronts}
      {/* recessed plinth for floor units */}
      {!isWall && m.kind !== 'tall' && m.kind !== 'filler' && (
        <mesh position={[0, -h / 2 - legH / 2, -0.025]}>
          <boxGeometry args={[w - 0.02, legH - 0.02, d - 0.1]} />
          <meshStandardMaterial color="#2E2E2E" roughness={0.9} />
        </mesh>
      )}
      {selected && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[w + 0.02, h + 0.02, d + 0.02]} />
          <meshBasicMaterial color={GOLD} transparent opacity={0.08} />
        </mesh>
      )}
    </group>
  )
}

function ApplianceMesh({ unit, selected, onSelect }: { unit: PlacedUnit; selected: boolean; onSelect: () => void }) {
  const m = getModule(unit.moduleId)
  const cursor = usePointerCursor()
  const w = mm(unit.widthMm)
  const h = mm(m.heightMm)
  const d = mm(m.depthMm)
  const bodyY = h / 2
  const color = unit.kind === 'fridge' ? '#B9BDC1' : '#4A4F55'
  return (
    <group position={[0, bodyY, 0]} onClick={e => { e.stopPropagation(); onSelect() }} {...cursor}>
      <RoundedBox args={[w, h, d]} radius={0.01} smoothness={2} castShadow receiveShadow>
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.35} />
        {selected && <Edges color={GOLD} lineWidth={2} />}
      </RoundedBox>
      {unit.kind === 'fridge' && (
        <>
          {/* freezer-door seam ~1/3 from the top */}
          <mesh position={[0, h / 2 - h / 3, d / 2 + 0.004]}>
            <boxGeometry args={[w - 0.02, 0.008, 0.01]} />
            <meshStandardMaterial color="#7A7E83" metalness={0.6} roughness={0.4} />
          </mesh>
          {/* two short vertical handles */}
          {[-w * 0.28, w * 0.28].map((x, i) => (
            <mesh key={i} position={[x, h * 0.08, d / 2 + 0.02]}>
              <cylinderGeometry args={[0.008, 0.008, h * 0.3, 12]} />
              <meshStandardMaterial color="#8A8E93" metalness={0.9} roughness={0.2} />
            </mesh>
          ))}
        </>
      )}
      {unit.kind === 'dishwasher' && (
        <mesh position={[0, 0, d / 2 + 0.004]}>
          <boxGeometry args={[w - 0.02, h - 0.02, 0.01]} />
          <meshStandardMaterial color="#B9BDC1" metalness={0.6} roughness={0.35} />
        </mesh>
      )}
    </group>
  )
}

/** Translate a unit's wall offset into a world position, per wall index. */
function unitTransform(unit: PlacedUnit, wallIndex: number, wallALenM: number): { pos: [number, number, number]; rotY: number } {
  const m = getModule(unit.moduleId)
  const w = mm(unit.widthMm)
  const d = mm(m.depthMm)
  const s = mm(unit.startMm)
  if (wallIndex === 0) return { pos: [s + w / 2, 0, d / 2 + 0.05], rotY: 0 }
  if (wallIndex === 1) return { pos: [d / 2 + 0.05, 0, s + w / 2], rotY: Math.PI / 2 }
  return { pos: [wallALenM - d / 2 - 0.05, 0, s + w / 2], rotY: -Math.PI / 2 }
}

function WallMesh({ lengthM, heightM, position, rotY }: { lengthM: number; heightM: number; position: [number, number, number]; rotY: number }) {
  return (
    <mesh position={position} rotation={[0, rotY, 0]} receiveShadow>
      <boxGeometry args={[lengthM, heightM, 0.1]} />
      <meshStandardMaterial color="#E3DDD3" roughness={0.95} />
    </mesh>
  )
}

function ObstructionMesh({ kind, offsetMm, widthMm, wallIndex, wallALenM, sillHeightMm, heightMm }: {
  kind: string; offsetMm: number; widthMm: number; wallIndex: number; wallALenM: number; sillHeightMm?: number; heightMm?: number
}) {
  const w = mm(widthMm)
  const s = mm(offsetMm)
  const wallLen = wallALenM
  let local: [number, number, number] = [0, 0, 0]
  let size: [number, number, number] = [w, 2.2, 0.02]
  let color = '#C9B08A'
  let opacity = 0.45
  if (kind === 'door') {
    local = [s + w / 2, 1.05, 0.06]
    size = [w, 2.1, 0.02]
    color = '#B9A98C'
    opacity = 0.5
  } else if (kind === 'window') {
    const sill = mm(sillHeightMm ?? 900)
    const hgt = mm(heightMm ?? 1200)
    local = [s + w / 2, sill + hgt / 2, 0.06]
    size = [w, hgt, 0.02]
    color = '#BEE3F8'
    opacity = 0.65
  } else if (kind === 'block') {
    local = [s + w / 2, 1.2, 0.06]
    size = [w, 2.4, 0.02]
    color = '#D9C9A8'
    opacity = 0.5
  } else if (kind === 'plumbing') {
    local = [s + w / 2, 0.55, 0.08]
    size = [0.08, 0.06, 0.08]
    color = '#7FB5D5'
    opacity = 0.9
  } else {
    return null // fridge/hob/dishwasher render as placed appliance units
  }
  let pos: [number, number, number]
  let rotY = 0
  if (wallIndex === 0) { pos = [local[0], local[1], local[2]]; rotY = 0 }
  else if (wallIndex === 1) { pos = [local[2], local[1], local[0]]; rotY = Math.PI / 2 }
  else { pos = [wallLen - local[2], local[1], local[0]]; rotY = -Math.PI / 2 }
  return (
    <mesh position={pos} rotation={[0, rotY, 0]}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} transparent opacity={opacity} />
    </mesh>
  )
}

function Floor({ sizeX, sizeZ }: { sizeX: number; sizeZ: number }) {
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#B39A73', roughness: 0.85 }),
    [],
  )
  // showroom sweep — floor extends far past the camera and fades into the fog
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[sizeX / 2, 0, sizeZ / 2]} receiveShadow material={mat}>
      <planeGeometry args={[80, 80]} />
    </mesh>
  )
}

export default function KitchenScene3D() {
  const { room, units, selectedUnitId, selectUnit, doorMaterialId } = useStore()
  const doorMat = findDoorMaterial(doorMaterialId) ?? undefined
  const wallALen = mm(room.walls[0]?.lengthMm ?? 3600)
  const ceilH = mm(room.ceilingHeightMm)
  const controlsRef = useRef<any>(null)

  // countertop spans: contiguous runs of base-mounted units per wall —
  // a gap wider than 60mm breaks the slab instead of floating over air
  const counters = useMemo(() => {
    const perWall: Array<{ wallIndex: number; s: number; e: number }> = []
    room.walls.forEach((_, wi) => {
      const base = units
        .filter(u => u.wallId === room.walls[wi].id && (u.mounted === 'base' || u.kind === 'dishwasher'))
        .sort((a, b) => a.startMm - b.startMm)
      let cur: { s: number; e: number } | null = null
      for (const u of base) {
        if (cur && u.startMm - cur.e > 60) {
          perWall.push({ wallIndex: wi, ...cur })
          cur = null
        }
        if (!cur) cur = { s: u.startMm, e: u.startMm + u.widthMm }
        else cur.e = Math.max(cur.e, u.startMm + u.widthMm)
      }
      if (cur) perWall.push({ wallIndex: wi, ...cur })
    })
    return perWall
  }, [units, room])

  const roomSizeX = wallALen
  const roomSizeZ = Math.max(mm(room.walls[1]?.lengthMm ?? 2400), mm(room.walls[2]?.lengthMm ?? 2400))
  const isDesktop = typeof window === 'undefined' || window.matchMedia('(min-width: 1024px)').matches
  // hero framing — fill the frame with the run, near eye level, slight angle.
  // target sits left of centre on desktop so the kitchen lands in the area
  // clear of the floating step panel.
  const camDist = (Math.max(roomSizeX * 1.15, roomSizeZ * 1.5) + 0.5) * (isDesktop ? 1 : 1.18)
  const targetX = roomSizeX / 2 - (isDesktop ? 0.55 : 0)
  const camPos: [number, number, number] = [targetX + 0.9, 1.85, camDist]
  const target: [number, number, number] = [targetX, 1.05, 0.4]

  return (
    <div className="relative h-full w-full">
      <SceneErrorBoundary>
      <Canvas shadows camera={{ position: camPos, fov: 42 }} onPointerMissed={() => selectUnit(null)}>
        <color attach="background" args={['#D8D1C6']} />
        <fog attach="fog" args={['#D8D1C6', 9, 30]} />
        <hemisphereLight args={['#ffffff', '#c8bfae', 0.55]} />
        <ambientLight intensity={0.35} />
        <directionalLight
          position={[roomSizeX / 2 + 4, 6, roomSizeZ + 5]}
          intensity={1.4}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004}
        />
        <directionalLight position={[-4, 3, -2]} intensity={0.4} />

        <Floor sizeX={roomSizeX} sizeZ={roomSizeZ} />

        {/* walls */}
        {room.walls.map((wall, wi) => {
          const lenM = mm(wall.lengthMm)
          if (wi === 0)
            return (
              <WallMesh
                key={wall.id}
                lengthM={lenM + 1.2}
                heightM={ceilH + 0.3}
                position={[lenM / 2, (ceilH + 0.3) / 2, 0]}
                rotY={0}
              />
            )
          if (wi === 1) return <WallMesh key={wall.id} lengthM={lenM} heightM={ceilH} position={[0, ceilH / 2, lenM / 2]} rotY={Math.PI / 2} />
          return <WallMesh key={wall.id} lengthM={lenM} heightM={ceilH} position={[roomSizeX, ceilH / 2, lenM / 2]} rotY={-Math.PI / 2} />
        })}

        {/* obstructions */}
        {room.walls.map((wall, wi) =>
          wall.obstructions.map(o => (
            <ObstructionMesh
              key={o.id}
              kind={o.kind}
              offsetMm={o.offsetMm}
              widthMm={o.widthMm}
              wallIndex={wi}
              wallALenM={roomSizeX}
              sillHeightMm={o.sillHeightMm}
              heightMm={o.heightMm}
            />
          )),
        )}

        {/* worktops — 40mm dark stone slab over each run of base units */}
        {counters.map((c, i) => {
          const s = mm(c.s)
          const len = mm(c.e - c.s)
          const depth = 0.62
          const y = 0.15 + 0.72 + 0.02
          const mat = <meshStandardMaterial color="#3A3A3A" roughness={0.4} />
          if (c.wallIndex === 0) {
            return (
              <mesh key={i} position={[s + len / 2, y, depth / 2 + 0.03]} castShadow receiveShadow>
                <boxGeometry args={[len, 0.04, depth]} />
                {mat}
              </mesh>
            )
          }
          const x = c.wallIndex === 1 ? depth / 2 + 0.03 : roomSizeX - depth / 2 - 0.03
          return (
            <mesh key={i} position={[x, y, s + len / 2]} castShadow receiveShadow>
              <boxGeometry args={[depth, 0.04, len]} />
              {mat}
            </mesh>
          )
        })}

        {/* units */}
        {units.map(u => {
          const wi = room.walls.findIndex(w => w.id === u.wallId)
          if (wi < 0) return null
          const { pos, rotY } = unitTransform(u, wi, roomSizeX)
          const isAppliance = u.kind === 'fridge' || u.kind === 'dishwasher'
          return (
            <group key={u.instanceId} position={pos} rotation={[0, rotY, 0]}>
              {isAppliance ? (
                <ApplianceMesh unit={u} selected={selectedUnitId === u.instanceId} onSelect={() => selectUnit(u.instanceId)} />
              ) : (
                <CabinetMesh unit={u} doorMat={doorMat} selected={selectedUnitId === u.instanceId} onSelect={() => selectUnit(u.instanceId)} />
              )}
            </group>
          )
        })}

        <ContactShadows position={[roomSizeX / 2, 0.001, roomSizeZ / 2]} scale={Math.max(roomSizeX, roomSizeZ) + 2} blur={2.4} far={2.5} opacity={0.35} />

        <OrbitControls
          ref={controlsRef}
          target={target}
          maxPolarAngle={Math.PI / 2.05}
          minDistance={1.2}
          maxDistance={camDist * 2}
          enablePan={isDesktop}
        />
      </Canvas>
      </SceneErrorBoundary>

      {units.length === 0 && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
          <p className="whitespace-nowrap rounded-full bg-white/90 px-4 py-2 text-xs text-hds-muted shadow-card lg:text-sm">
            <span className="hidden lg:inline">Fill in your room on the left to see your kitchen</span>
            <span className="lg:hidden">Fill in your room below to see your kitchen</span>
          </p>
        </div>
      )}

      <button
        onClick={() => controlsRef.current?.reset()}
        className="absolute bottom-16 left-4 rounded-full border border-hds-border bg-white/90 px-4 py-2 text-xs font-medium text-hds-black shadow-card transition-colors hover:bg-white lg:bottom-6 lg:left-[440px]"
      >
        Reset view
      </button>
    </div>
  )
}
