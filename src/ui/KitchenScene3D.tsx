import { useMemo, useRef, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, RoundedBox, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useStore } from '../store'
import { getModule } from '../data/cabinetLibrary'
import { findDoorMaterial, CARCASS_BOARD } from '../data/boardMaterials'
import type { PlacedUnit } from '../engine/rules'
import type { BoardMaterial } from '../data/boardMaterials'

const mm = (v: number) => v / 1000

// Door-material mesh builder — real board texture when a crop exists.
function useBoardMaterial(mat: BoardMaterial | undefined) {
  const url = mat?.renderTexture || null
  // useTexture requires a stable URL — use a 1px fallback when none exists
  const texture = useTexture(url || '/images/cabinet-crops/iceland-gloss-door.png')
  return useMemo(() => {
    const isGloss = mat?.texture === 'gloss'
    const isMatt = mat?.texture === 'matt' || mat?.texture === 'super-matte'
    let map: THREE.Texture | null = null
    if (url && texture?.image) {
      map = texture
      map.colorSpace = THREE.SRGBColorSpace
      map.anisotropy = 8
    }
    const color = map ? new THREE.Color('#ffffff') : new THREE.Color(mat?.hex || '#cccccc')
    if (isGloss) {
      return new THREE.MeshPhysicalMaterial({ color, map, roughness: 0.4, clearcoat: 0.25, clearcoatRoughness: 0.3, envMapIntensity: 0.15 })
    }
    if (isMatt) {
      return new THREE.MeshStandardMaterial({ color, map, roughness: 0.9, metalness: 0.02 })
    }
    return new THREE.MeshStandardMaterial({ color, map, roughness: 0.65, metalness: 0.03 })
  }, [mat, texture, url])
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
  const carcassMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: CARCASS_BOARD.hex, roughness: 0.85 }),
    [],
  )
  const w = mm(unit.widthMm)
  const h = mm(m.heightMm)
  const d = mm(m.depthMm)
  const isWall = unit.mounted === 'wall'
  const legH = 0.15
  const bodyY = isWall ? 1.45 + h / 2 : m.kind === 'tall' ? h / 2 : legH + h / 2
  const frontZ = d / 2 + 0.005

  const highlight = selected ? '#f59e0b' : undefined

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
    <group position={[0, bodyY, 0]} onClick={e => { e.stopPropagation(); onSelect() }}>
      {/* carcass */}
      <RoundedBox args={[w, h, d]} radius={0.008} smoothness={2} material={carcassMat} castShadow receiveShadow />
      {fronts}
      {/* legs for floor units */}
      {!isWall && m.kind !== 'tall' && m.kind !== 'filler' && (
        <mesh position={[0, -h / 2 - legH / 2, 0]}>
          <boxGeometry args={[w - 0.06, legH, d - 0.08]} />
          <meshStandardMaterial color="#111111" roughness={0.9} />
        </mesh>
      )}
      {selected && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[w + 0.02, h + 0.02, d + 0.02]} />
          <meshBasicMaterial color={highlight} wireframe transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  )
}

function ApplianceMesh({ unit, selected, onSelect }: { unit: PlacedUnit; selected: boolean; onSelect: () => void }) {
  const m = getModule(unit.moduleId)
  const w = mm(unit.widthMm)
  const h = mm(m.heightMm)
  const d = mm(m.depthMm)
  const bodyY = h / 2
  const color = unit.kind === 'fridge' ? '#9aa0a6' : '#3a3f44'
  return (
    <group position={[0, bodyY, 0]} onClick={e => { e.stopPropagation(); onSelect() }}>
      <RoundedBox args={[w, h, d]} radius={0.01} smoothness={2} castShadow receiveShadow>
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.35} />
      </RoundedBox>
      {unit.kind === 'fridge' && (
        <mesh position={[0, 0, d / 2 + 0.004]}>
          <boxGeometry args={[w - 0.02, h - 0.02, 0.01]} />
          <meshStandardMaterial color="#b8bdc2" metalness={0.7} roughness={0.3} />
        </mesh>
      )}
      {unit.kind === 'dishwasher' && (
        <mesh position={[0, 0, d / 2 + 0.004]}>
          <boxGeometry args={[w - 0.02, h - 0.02, 0.01]} />
          <meshStandardMaterial color="#565b61" metalness={0.6} roughness={0.4} />
        </mesh>
      )}
      {selected && (
        <mesh>
          <boxGeometry args={[w + 0.02, h + 0.02, d + 0.02]} />
          <meshBasicMaterial color="#f59e0b" wireframe transparent opacity={0.6} />
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
      <meshStandardMaterial color="#d9d5ce" roughness={0.95} />
    </mesh>
  )
}

function ObstructionMesh({ kind, offsetMm, widthMm, wallIndex, wallALenM, sillHeightMm, heightMm }: {
  kind: string; offsetMm: number; widthMm: number; wallIndex: number; wallALenM: number; sillHeightMm?: number; heightMm?: number
}) {
  const w = mm(widthMm)
  const s = mm(offsetMm)
  const wallLen = wallALenM
  // wall-local: x along wall, z=0 at wall face
  let local: [number, number, number] = [0, 0, 0]
  let size: [number, number, number] = [w, 2.2, 0.02]
  let color = '#f97316'
  let opacity = 0.35
  if (kind === 'door') {
    local = [s + w / 2, 1.05, 0.06]
    size = [w, 2.1, 0.02]
    color = '#f97316'
    opacity = 0.4
  } else if (kind === 'window') {
    const sill = mm(sillHeightMm ?? 900)
    const hgt = mm(heightMm ?? 1200)
    local = [s + w / 2, sill + hgt / 2, 0.06]
    size = [w, hgt, 0.02]
    color = '#7dd3fc'
    opacity = 0.5
  } else if (kind === 'block') {
    local = [s + w / 2, 1.2, 0.06]
    size = [w, 2.4, 0.02]
    color = '#ef4444'
    opacity = 0.35
  } else if (kind === 'plumbing') {
    local = [s + w / 2, 0.55, 0.08]
    size = [0.08, 0.06, 0.08]
    color = '#38bdf8'
    opacity = 0.9
  } else {
    return null // fridge/hob/dishwasher render as placed appliance units
  }
  // map local (x along wall) to world per wall index
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

export default function KitchenScene3D() {
  const { room, units, selectedUnitId, selectUnit, doorMaterialId } = useStore()
  const doorMat = findDoorMaterial(doorMaterialId) ?? undefined
  const wallALen = mm(room.walls[0]?.lengthMm ?? 3600)
  const ceilH = mm(room.ceilingHeightMm)
  const groupRef = useRef<THREE.Group>(null)

  // countertop spans: contiguous run of base-mounted units per wall
  const counters = useMemo(() => {
    const perWall: Array<{ wallIndex: number; s: number; e: number }> = []
    room.walls.forEach((_, wi) => {
      const base = units.filter(u => u.wallId === room.walls[wi].id && u.mounted === 'base')
      if (base.length === 0) return
      const s = Math.min(...base.map(u => u.startMm))
      const e = Math.max(...base.map(u => u.startMm + u.widthMm))
      perWall.push({ wallIndex: wi, s, e })
    })
    return perWall
  }, [units, room])

  const roomSizeX = wallALen
  const roomSizeZ = Math.max(mm(room.walls[1]?.lengthMm ?? 2400), mm(room.walls[2]?.lengthMm ?? 2400))
  const camDist = Math.max(roomSizeX, roomSizeZ) * 1.35 + 2.5

  return (
    <Canvas shadows camera={{ position: [roomSizeX / 2 + 1.2, 3.0, camDist], fov: 42 }} onPointerMissed={() => selectUnit(null)}>
      <color attach="background" args={['#101013']} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[roomSizeX / 2, 5, roomSizeZ + 3]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} />
      <pointLight position={[roomSizeX / 2, 2.4, roomSizeZ / 2]} intensity={0.4} color="#fff4e0" />

      <group ref={groupRef}>
        {/* floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[roomSizeX / 2, 0, roomSizeZ / 2]} receiveShadow>
          <planeGeometry args={[roomSizeX + 2, roomSizeZ + 2]} />
          <meshStandardMaterial color="#3d3a35" roughness={0.8} />
        </mesh>

        {/* walls */}
        {room.walls.map((wall, wi) => {
          const lenM = mm(wall.lengthMm)
          if (wi === 0) return <WallMesh key={wall.id} lengthM={lenM} heightM={ceilH} position={[lenM / 2, ceilH / 2, 0]} rotY={0} />
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

        {/* countertops */}
        {counters.map((c, i) => {
          const s = mm(c.s)
          const len = mm(c.e - c.s)
          const depth = 0.62
          const y = 0.15 + 0.72 + 0.02
          if (c.wallIndex === 0) {
            return (
              <mesh key={i} position={[s + len / 2, y, depth / 2 + 0.03]} castShadow receiveShadow>
                <boxGeometry args={[len, 0.04, depth]} />
                <meshStandardMaterial color="#26241f" roughness={0.3} metalness={0.2} />
              </mesh>
            )
          }
          const x = c.wallIndex === 1 ? depth / 2 + 0.03 : roomSizeX - depth / 2 - 0.03
          return (
            <mesh key={i} position={[x, y, s + len / 2]} castShadow receiveShadow>
              <boxGeometry args={[depth, 0.04, len]} />
              <meshStandardMaterial color="#26241f" roughness={0.3} metalness={0.2} />
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
      </group>

      <OrbitControls target={[roomSizeX / 2, 1, roomSizeZ / 2]} maxPolarAngle={Math.PI / 2.05} minDistance={1.5} maxDistance={camDist * 1.6} />
    </Canvas>
  )
}
