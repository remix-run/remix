import { useLoaderData } from "remix"

import { Post } from "~/entities/Post"
import ensureORM from "~/orm.server"

export async function loader() {
  const orm = await ensureORM()

  const result = await orm.em.find(Post, {})

  console.log('orm:loader:result', result)

  return result
}

export default function ORM() {
  const data = useLoaderData()

  return (
    <div>
      <h1>ORMRLY?</h1>
      <pre>{data}</pre>
      <p>
        <strong>ORM</strong> is an acronym for Object Relational Mapping. It
        is a way of mapping the database into a JavaScript object.
      </p>
      <p>
        In this tutorial, we will be using the <strong>Sequelize</strong> ORM
        library.
      </p>
      <p>
        <strong>Sequelize</strong> is a popular ORM)
      </p>
    </div>
  )
}