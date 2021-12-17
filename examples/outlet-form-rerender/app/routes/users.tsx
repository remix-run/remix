import type { LoaderFunction, MetaFunction } from 'remix'
import type { User } from '@prisma/client'
import { Link, Outlet } from 'remix'
import { useLoaderData } from 'remix'
import prisma from '~/db.server'

interface LoaderData {
  users: User[]
}

export const meta: MetaFunction = () => {
  return { title: 'Users' }
}

export const loader: LoaderFunction = async () => {
  const users = await prisma?.user.findMany()
  return { users } as LoaderData
}

export default function Users() {
  const { users } = useLoaderData<LoaderData>()

  return (
    <div className='flex justify-around'>
      <ul className='mr-auto'>
        {users.map(({ id, name }) => (
          <Link to={id} key={id}>
            <li>{name}</li>
          </Link>
        ))}
      </ul>
      <Outlet />
    </div>
  )
}
