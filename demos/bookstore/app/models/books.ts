import { getAssets } from '../utils/context.ts'

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
    coverUrl: 'app/images/books/bbq-1.png',
    imageUrls: [
      'app/images/books/bbq-1.png',
      'app/images/books/bbq-2.png',
      'app/images/books/bbq-3.png',
    ],
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
    coverUrl: 'app/images/books/heavy-metal-1.png',
    imageUrls: [
      'app/images/books/heavy-metal-1.png',
      'app/images/books/heavy-metal-2.png',
      'app/images/books/heavy-metal-3.png',
    ],
    isbn: '978-0735211292',
    publishedYear: 2018,
    inStock: true,
  },
  {
    id: '003',
    slug: 'three-ways',
    title: 'Three Ways to Change Your Life',
    author: 'Britney Spears',
    description: 'A practical guide to changing your life for the better.',
    price: 28.99,
    genre: 'self-help',
    coverUrl: 'app/images/books/three-ways-1.png',
    imageUrls: [
      'app/images/books/three-ways-1.png',
      'app/images/books/three-ways-2.png',
      'app/images/books/three-ways-3.png',
    ],
    isbn: '978-0593135204',
    publishedYear: 2021,
    inStock: true,
  },
]

let assetsResolved = false
function getBooksData(): Book[] {
  if (!assetsResolved) {
    let assets = getAssets()
    for (let book of booksData) {
      book.coverUrl = assets.get(book.coverUrl)?.href ?? book.coverUrl
      book.imageUrls = book.imageUrls.map(
        (sourcePath) => assets.get(sourcePath)?.href ?? sourcePath,
      )
    }
    assetsResolved = true
  }

  return booksData
}

export function getAllBooks(): Book[] {
  return [...getBooksData()]
}

export function getBookBySlug(slug: string): Book | undefined {
  return getBooksData().find((book) => book.slug === slug)
}

export function getBookById(id: string): Book | undefined {
  return getBooksData().find((book) => book.id === id)
}

export function getBooksByGenre(genre: string): Book[] {
  return getBooksData().filter((book) => book.genre.toLowerCase() === genre.toLowerCase())
}

export function searchBooks(query: string): Book[] {
  let lowerQuery = query.toLowerCase()
  return getBooksData().filter(
    (book) =>
      book.title.toLowerCase().includes(lowerQuery) ||
      book.author.toLowerCase().includes(lowerQuery) ||
      book.description.toLowerCase().includes(lowerQuery),
  )
}

export function getAvailableGenres(): string[] {
  return Array.from(new Set(getBooksData().map((book) => book.genre)))
}

export function createBook(data: Omit<Book, 'id'>): Book {
  let books = getBooksData()
  let assets = getAssets()

  let newBook: Book = {
    ...data,
    id: String(books.length + 1),
  }

  newBook.coverUrl = assets.get(newBook.coverUrl)?.href ?? newBook.coverUrl
  newBook.imageUrls = newBook.imageUrls.map(
    (sourcePath) => assets.get(sourcePath)?.href ?? sourcePath,
  )

  books.push(newBook)
  return newBook
}

export function updateBook(id: string, data: Partial<Book>): Book | undefined {
  let books = getBooksData()
  let index = books.findIndex((book) => book.id === id)
  if (index === -1) return undefined

  books[index] = { ...books[index], ...data }

  let assets = getAssets()
  books[index].coverUrl = assets.get(books[index].coverUrl)?.href ?? books[index].coverUrl
  books[index].imageUrls = books[index].imageUrls.map(
    (sourcePath) => assets.get(sourcePath)?.href ?? sourcePath,
  )

  return books[index]
}

export function deleteBook(id: string): boolean {
  let books = getBooksData()
  let index = books.findIndex((book) => book.id === id)
  if (index === -1) return false

  books.splice(index, 1)
  return true
}
