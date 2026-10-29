import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet'
import type { Job } from './types'
import 'leaflet/dist/leaflet.css'

type Coordinates = { latitude: number; longitude: number }
type MappedJob = Job & { latitude: number; longitude: number }
type Props = { jobs: Job[]; location: Coordinates | null; onLocate: () => void }
const ZOOM = 14
const TILE_PIXELS = 256
const CITY_CENTER = { latitude: 12.9716, longitude: 77.5946 }

function tileAt(latitude: number, longitude: number, zoom: number) {
  const scale = 2 ** zoom
  const x = (longitude + 180) / 360 * scale
  const lat = latitude * Math.PI / 180
  const y = (1 - Math.asinh(Math.tan(lat)) / Math.PI) / 2 * scale
  return { tileX: Math.floor(x), tileY: Math.floor(y) }
}

function tileCoordinates(x: number, y: number, zoom: number): Coordinates {
  const scale = 2 ** zoom
  const longitude = x / scale * 360 - 180
  const latitude = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / scale))) * 180 / Math.PI
  return { latitude, longitude }
}

function loadTile(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('Map tiles could not be loaded'))
    image.src = url
  })
}

function osmTexture(center: Coordinates) {
  const { tileX, tileY } = tileAt(center.latitude, center.longitude, ZOOM)
  const canvas = document.createElement('canvas')
  canvas.width = TILE_PIXELS * 3
  canvas.height = TILE_PIXELS * 3
  const context = canvas.getContext('2d')
  if (!context) return Promise.reject(new Error('Canvas is unavailable'))
  context.fillStyle = '#d8e6db'
  context.fillRect(0, 0, canvas.width, canvas.height)
  const requests: Promise<void>[] = []
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      requests.push(loadTile(`https://tile.openstreetmap.org/${ZOOM}/${tileX + dx}/${tileY + dy}.png`)
        .then((image) => context.drawImage(image, (dx + 1) * TILE_PIXELS, (dy + 1) * TILE_PIXELS, TILE_PIXELS, TILE_PIXELS)))
    }
  }
  return Promise.all(requests).then(() => new THREE.CanvasTexture(canvas))
}

function clearMarkers(group: THREE.Group) {
  for (const child of [...group.children]) {
    group.remove(child)
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose()
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => material.dispose())
    }
  }
}

function drawMarkers(group: THREE.Group, jobs: Job[], location: Coordinates | null, origin: Coordinates) {
  clearMarkers(group)
  const tileMeters = 40075016.686 * Math.cos(origin.latitude * Math.PI / 180) / (2 ** ZOOM)
  const localPosition = (latitude: number, longitude: number) => ({
    x: ((longitude - origin.longitude) * Math.PI / 180 * 6378137 * Math.cos(origin.latitude * Math.PI / 180)) * 30 / (tileMeters * 3),
    z: -((latitude - origin.latitude) * Math.PI / 180 * 6378137) * 30 / (tileMeters * 3),
  })
  if (location) {
    const point = localPosition(location.latitude, location.longitude)
    const pin = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 24, 16),
      new THREE.MeshStandardMaterial({ color: '#2374e1', emissive: '#164b8e', emissiveIntensity: 0.3 }),
    )
    pin.position.set(point.x, 0.85, point.z)
    pin.castShadow = true
    group.add(pin)
  }
  jobs.filter((job): job is MappedJob => job.latitude != null && job.longitude != null).forEach((job, index) => {
    const point = localPosition(job.latitude, job.longitude)
    const color = new THREE.Color().setHSL((index * 0.13 + 0.11) % 1, 0.72, 0.48)
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.1, 0.85, 10),
      new THREE.MeshStandardMaterial({ color, roughness: 0.6 }),
    )
    stem.position.set(point.x, 0.45, point.z)
    stem.castShadow = true
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshStandardMaterial({ color }))
    head.position.set(point.x, 1, point.z)
    head.castShadow = true
    group.add(stem, head)
  })
}

export function Map3D({ jobs, location, onLocate }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const markerGroupRef = useRef<THREE.Group | null>(null)
  const liveData = useRef({ jobs, location })
  const [mode, setMode] = useState<'3d' | '2d'>('3d')
  const [mapError, setMapError] = useState('')
  const show3d = mode === '3d' && !mapError
  const firstJob = jobs.find((job) => job.latitude != null && job.longitude != null)
  const requestedCenter = location ?? (firstJob
    ? { latitude: firstJob.latitude!, longitude: firstJob.longitude! }
    : CITY_CENTER)
  const { tileX, tileY } = tileAt(requestedCenter.latitude, requestedCenter.longitude, ZOOM)
  const mapOrigin = useMemo(() => tileCoordinates(tileX + 0.5, tileY + 0.5, ZOOM), [tileX, tileY])

  useEffect(() => {
    liveData.current = { jobs, location }
    if (show3d && markerGroupRef.current) {
      drawMarkers(markerGroupRef.current, jobs, location, mapOrigin)
    }
  }, [jobs, location, mapOrigin, show3d])

  useEffect(() => {
    if (!show3d || !canvasRef.current) return
    let active = true
    const canvas = canvasRef.current
    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#dce9e4')
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
    camera.position.set(0, 18, 19)
    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false })
    } catch {
      const fallbackTimer = window.setTimeout(() => {
        setMapError('3D is unavailable on this device. Switched to the 2D map.')
      }, 0)
      return () => window.clearTimeout(fallbackTimer)
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.shadowMap.enabled = true
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.maxPolarAngle = Math.PI / 2.08
    controls.minDistance = 11
    controls.maxDistance = 35
    scene.add(new THREE.HemisphereLight('#ffffff', '#82958e', 2))
    const sun = new THREE.DirectionalLight('#ffffff', 2.2)
    sun.position.set(-5, 14, 8)
    sun.castShadow = true
    scene.add(sun)
    const map = new THREE.Group()
    const markers = new THREE.Group()
    map.add(markers)
    scene.add(map)
    markerGroupRef.current = markers
    drawMarkers(markers, liveData.current.jobs, liveData.current.location, mapOrigin)

    const resize = () => {
      const width = canvas.clientWidth || 700
      const height = canvas.clientHeight || 460
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)
    resize()
    let frame = 0
    const draw = () => {
      controls.update()
      renderer.render(scene, camera)
      frame = requestAnimationFrame(draw)
    }
    draw()
    osmTexture(mapOrigin).then((texture) => {
      if (!active) { texture.dispose(); return }
      setMapError('')
      texture.colorSpace = THREE.SRGBColorSpace
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 30),
        new THREE.MeshStandardMaterial({ map: texture, roughness: 1 }),
      )
      ground.rotation.x = -Math.PI / 2
      ground.receiveShadow = true
      map.add(ground)
    }).catch(() => {
      if (active) {
        setMapError('3D map tiles are unavailable. Switched to the 2D map.')
        setMode('2d')
      }
    })

    return () => {
      active = false
      markerGroupRef.current = null
      cancelAnimationFrame(frame)
      observer.disconnect()
      controls.dispose()
      map.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => {
            material.map?.dispose()
            material.dispose()
          })
        }
      })
      renderer.dispose()
    }
  }, [mapError, mapOrigin, show3d, tileX, tileY])

  const center: [number, number] = location
    ? [location.latitude, location.longitude]
    : firstJob
      ? [firstJob.latitude!, firstJob.longitude!]
      : [CITY_CENTER.latitude, CITY_CENTER.longitude]

  return <div className="map-panel">
    <div className="map-toolbar">
      <div className="map-switch" role="group" aria-label="Map style">
        <button className={show3d ? 'selected' : ''} onClick={() => { setMapError(''); setMode('3d') }}>3D view</button>
        <button className={!show3d ? 'selected' : ''} onClick={() => { setMapError(''); setMode('2d') }}>2D map</button>
      </div>
      <span className="map-key">{location && <><i className="you-dot" /> You</>} <i className="job-dot" /> Job location</span>
    </div>
    {show3d
      ? <canvas ref={canvasRef} className="map-canvas" aria-label="Interactive 3D map. Drag to rotate and scroll to zoom." />
      : <MapContainer center={center} zoom={14} scrollWheelZoom className="leaflet-map">
        <Recenter center={center} />
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {location && <CircleMarker center={[location.latitude, location.longitude]} radius={9} pathOptions={{ color: '#fff', fillColor: '#2374e1', fillOpacity: 1 }}><Popup>Your current location</Popup></CircleMarker>}
        {jobs.filter((job): job is MappedJob => job.latitude != null && job.longitude != null).map((job) => <CircleMarker key={job.id} center={[job.latitude, job.longitude]} radius={8} pathOptions={{ color: '#fff', fillColor: '#e5a92f', fillOpacity: 1 }}><Popup><strong>{job.title}</strong><br />{job.place} · ₹{job.pay}/day</Popup></CircleMarker>)}
      </MapContainer>}
    {mapError && <p className="alert error">{mapError}</p>}
    <div className="map-caption"><span>{location ? 'Map centered on your device location.' : 'Showing job area. Enable location to center nearby work.'}</span><button className="text-button" onClick={onLocate}>Center on me</button></div>
    <div className="map-jobs">{jobs.filter((job) => job.latitude != null && job.longitude != null).length} mapped jobs · {jobs.filter((job) => job.latitude == null || job.longitude == null).length} without coordinates</div>
    <p className="map-attribution">Map data &copy; OpenStreetMap contributors. Map tiles are subject to the OpenStreetMap tile usage policy.</p>
  </div>
}

function Recenter({ center }: { center: [number, number] }) {
  const map = useMap()
  useEffect(() => { map.setView(center, 14) }, [center, map])
  return null
}
