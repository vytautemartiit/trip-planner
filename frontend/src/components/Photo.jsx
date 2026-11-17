import { useState } from 'react'
import { cityName, findCity } from '../destinations'

// Drawn fallback scene, used when a photo is missing or fails to load
const SCENES = [
  { sky: ['#9fb3bf', '#e9d3b6'], far: '#7d8f8c', near: '#3e4e44', mist: '#f3e3cc' },
  { sky: ['#e7a978', '#f6d9b2'], far: '#a5715a', near: '#4b3a33', mist: '#f9dcc0' },
  { sky: ['#6f9a9a', '#cfe0d6'], far: '#4f7469', near: '#26392f', mist: '#e3eee6' },
  { sky: ['#b8a6c4', '#f0d5c2'], far: '#7e6f86', near: '#3a3341', mist: '#f5e1d3' },
]

function Scene({ index }) {
  const s = SCENES[index % SCENES.length]
  const id = `sky-${index % SCENES.length}`
  return (
    <svg className="photo" viewBox="0 0 300 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={s.sky[0]} />
          <stop offset="1" stopColor={s.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="300" height="360" fill={`url(#${id})`} />
      <circle cx="220" cy="90" r="26" fill={s.mist} opacity="0.7" />
      <path d="M0 230 L60 150 L105 195 L165 110 L230 200 L300 140 L300 360 L0 360 Z" fill={s.far} opacity="0.75" />
      <path d="M0 210 Q150 190 300 225 L300 250 Q150 225 0 245 Z" fill={s.mist} opacity="0.55" />
      <path d="M0 290 L50 230 L95 265 L150 200 L215 270 L260 235 L300 260 L300 360 L0 360 Z" fill={s.near} />
    </svg>
  )
}

export default function Photo({ name, index = 0 }) {
  const photo = findCity(name)
  const [failed, setFailed] = useState(false)

  if (!photo || failed) return <Scene index={index} />

  return (
    <img
      className="photo"
      src={photo.src}
      alt={cityName(name)}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}
