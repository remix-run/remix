export const albumGenres = [
  'art',
  'children',
  'cookbook',
  'fiction',
  'gardening',
  'mystery',
  'nonfiction',
  'self-help',
  'fantasy',
  'travel',
] as const

const labels: Record<(typeof albumGenres)[number], string> = {
  art: 'Arts, Music & Crafts',
  children: 'Children’s Books',
  cookbook: 'Food & Cooking',
  fiction: 'Fiction & Poetry',
  gardening: 'Nature & Gardening',
  mystery: 'Mystery & Suspense',
  nonfiction: 'Nonfiction',
  'self-help': 'Personal Growth',
  fantasy: 'Science Fiction & Fantasy',
  travel: 'Travel & Outdoors',
}

export function getAlbumGenreLabel(genre: string): string {
  let key = albumGenres.find((value) => value === genre)
  return key ? labels[key] : genre
}
