import type { FitEnum } from 'sharp'

export interface ImageProps {
  src: string // a path within the assets/images directory, can be a nested path
  width?: number // either width or height is required
  height?: number
  fit?: keyof FitEnum // contain is default
}
export function Image({ src, width, height, fit, ...other }: ImageProps) {
  const query = new URLSearchParams()
  width && query.set('w', width.toString())
  height && query.set('h', height.toString())
  fit && query.set('fit', fit)
  return <img src={`/assets/resize/${src}?${query.toString()}`} {...{ width, height, ...other }} />
}
