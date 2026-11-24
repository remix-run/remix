export const albumGenres = [
  'boy-band',
  'country',
  'grunge',
  'hip-hop',
  'pop',
  'r-and-b',
  'rock',
  'ska',
] as const

const labels: Record<(typeof albumGenres)[number], string> = {
  'boy-band': 'Boy Bands',
  country: 'Country',
  grunge: 'Grunge',
  'hip-hop': 'Hip-Hop',
  pop: 'Pop',
  'r-and-b': 'R&B',
  rock: 'Rock',
  ska: 'Ska',
}

export function getAlbumGenreLabel(genre: string): string {
  let key = albumGenres.find((value) => value === genre)
  return key ? labels[key] : genre
}
