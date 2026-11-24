export const bookGenres = [
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

const labels: Record<(typeof bookGenres)[number], string> = {
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

export function getBookGenreLabel(genre: string): string {
  let key = bookGenres.find((value) => value === genre)
  return key ? labels[key] : genre
}
