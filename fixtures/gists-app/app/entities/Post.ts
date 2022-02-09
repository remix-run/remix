import { Entity, PrimaryKey, Property, Unique } from '@mikro-orm/core'

export interface IPost {
  title: string
  slug: string
  published: boolean
  content: string
  createdAt?: Date
  updatedAt?: Date
}

@Entity({
  collection: 'Post',
})
export class Post implements IPost {
  @PrimaryKey({ type: 'number' })
  id!: number

  @Property({ type: 'string' })
  @Unique()
  title!: string

  @Property({ type: 'string' })
  @Unique()
  slug!: string

  @Property({ type: 'boolean' })
  published!: boolean

  @Property({ type: 'string' })
  content!: string

  @Property({ type: 'date' })
  createdAt?: Date = new Date()

  @Property({
    type: 'date',
    onUpdate: () => {
      return new Date()
    },
  })
  updatedAt?: Date = new Date()

  constructor(title: string, slug: string, published: boolean, content: string) {
    this.title = title
    this.slug = slug
    this.published = published
    this.content = content
  }
}
