export interface Book {
  id: string
  slug: string
  title: string
  author: string
  description: string
  price: number
  genre: string
  coverUrl: string
  isbn: string
  publishedYear: number
  inStock: boolean
}

// Sample book data
const booksData: Book[] = [
  {
    id: '1',
    slug: 'the-midnight-library',
    title: 'The Midnight Library',
    author: 'Matt Haig',
    description:
      'Between life and death there is a library, and within that library, the shelves go on forever. Every book provides a chance to try another life you could have lived.',
    price: 16.99,
    genre: 'fiction',
    coverUrl: '/images/midnight-library.jpg',
    isbn: '978-0525559474',
    publishedYear: 2020,
    inStock: true,
  },
  {
    id: '2',
    slug: 'atomic-habits',
    title: 'Atomic Habits',
    author: 'James Clear',
    description:
      'An Easy & Proven Way to Build Good Habits & Break Bad Ones. Tiny changes, remarkable results.',
    price: 27.0,
    genre: 'self-help',
    coverUrl: '/images/atomic-habits.jpg',
    isbn: '978-0735211292',
    publishedYear: 2018,
    inStock: true,
  },
  {
    id: '3',
    slug: 'project-hail-mary',
    title: 'Project Hail Mary',
    author: 'Andy Weir',
    description:
      'A lone astronaut must save the earth from disaster in this incredible new science-based thriller from the author of The Martian.',
    price: 28.99,
    genre: 'science-fiction',
    coverUrl: '/images/project-hail-mary.jpg',
    isbn: '978-0593135204',
    publishedYear: 2021,
    inStock: true,
  },
  {
    id: '4',
    slug: 'educated',
    title: 'Educated',
    author: 'Tara Westover',
    description:
      'A memoir about a young girl who, kept out of school, leaves her survivalist family and goes on to earn a PhD from Cambridge University.',
    price: 18.0,
    genre: 'biography',
    coverUrl: '/images/educated.jpg',
    isbn: '978-0399590504',
    publishedYear: 2018,
    inStock: true,
  },
  {
    id: '5',
    slug: 'dune',
    title: 'Dune',
    author: 'Frank Herbert',
    description:
      'Set on the desert planet Arrakis, Dune is the story of the boy Paul Atreides, heir to a noble family tasked with ruling an inhospitable world.',
    price: 19.99,
    genre: 'science-fiction',
    coverUrl: '/images/dune.jpg',
    isbn: '978-0441172719',
    publishedYear: 1965,
    inStock: true,
  },
  {
    id: '6',
    slug: 'the-psychology-of-money',
    title: 'The Psychology of Money',
    author: 'Morgan Housel',
    description:
      'Timeless lessons on wealth, greed, and happiness doing well with money has little to do with how smart you are and a lot to do with how you behave.',
    price: 24.99,
    genre: 'finance',
    coverUrl: '/images/psychology-money.jpg',
    isbn: '978-0857197689',
    publishedYear: 2020,
    inStock: false,
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
