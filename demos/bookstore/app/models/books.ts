export interface Book {
  id: string // unique identifier
  slug: string
  title: string
  author: string
  description: string
  price: number
  genre: string
  imageUrls: string[]
  coverUrl: string
  isbn: string
  publishedYear: number
  inStock: boolean
}

// Sample book data
const booksData: Book[] = [
  {
    id: '001',
    slug: 'bbq',
    title: 'Ash & Smoke',
    author: 'Rusty Char-Broil',
    description: 'The perfect gift for the BBQ enthusiast in your life!',
    price: 16.99,
    genre: 'cookbook',
    coverUrl: '/images/bbq-1.png',
    imageUrls: ['/images/bbq-1.png', '/images/bbq-2.png', '/images/bbq-3.png'],
    isbn: '978-0525559474',
    publishedYear: 2020,
    inStock: true,
  },
  {
    id: '002',
    slug: 'heavy-metal',
    title: 'Heavy Metal Guitar Riffs',
    author: 'Axe Master Krush',
    description: 'The ultimate guide to heavy metal guitar riffs!',
    price: 27.0,
    genre: 'music',
    coverUrl: '/images/heavy-metal-1.png',
    imageUrls: [
      '/images/heavy-metal-1.png',
      '/images/heavy-metal-2.png',
      '/images/heavy-metal-3.png',
    ],
    isbn: '978-0735211292',
    publishedYear: 2018,
    inStock: true,
  },
  {
    id: '003',
    slug: 'three-ways',
    title: 'Three Ways to Change Your Life',
    author: 'The Great Change Wizard',
    description: 'A practical guide to changing your life for the better.',
    price: 28.99,
    genre: 'science-fiction',
    coverUrl: '/images/three-ways-1.png',
    imageUrls: ['/images/three-ways-1.png', '/images/three-ways-2.png', '/images/three-ways-3.png'],
    isbn: '978-0593135204',
    publishedYear: 2021,
    inStock: true,
  },
]

export function getAllBooks(): Book[] {
  return [...booksData]
}

export function getBookBySlug(slug: string): Book | undefined {
  return booksData.find((book) => book.slug === slug)
}

export function getBookById(id: string): Book | undefined {
  return booksData.find((book) => book.id === id)
}

export function getBooksByGenre(genre: string): Book[] {
  return booksData.filter((book) => book.genre.toLowerCase() === genre.toLowerCase())
}

export function searchBooks(query: string): Book[] {
  let lowerQuery = query.toLowerCase()
  return booksData.filter(
    (book) =>
      book.title.toLowerCase().includes(lowerQuery) ||
      book.author.toLowerCase().includes(lowerQuery) ||
      book.description.toLowerCase().includes(lowerQuery),
  )
}

export function getAvailableGenres(): string[] {
  return Array.from(new Set(booksData.map((book) => book.genre)))
}

export function createBook(data: Omit<Book, 'id'>): Book {
  let newBook: Book = {
    ...data,
    id: String(booksData.length + 1),
  }
  booksData.push(newBook)
  return newBook
}

export function updateBook(id: string, data: Partial<Book>): Book | undefined {
  let index = booksData.findIndex((book) => book.id === id)
  if (index === -1) return undefined

  booksData[index] = { ...booksData[index], ...data }
  return booksData[index]
}

export function deleteBook(id: string): boolean {
  let index = booksData.findIndex((book) => book.id === id)
  if (index === -1) return false

  booksData.splice(index, 1)
  return true
}
