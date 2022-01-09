import { Image } from '~/components/image'

export default function Index() {
  return (
    <div className="container">
      <h1 className="mt-12 text-4xl">Cover</h1>
      <div className="flex gap-4 items-center overflow-x-scroll">
        <Image src="dog-1.jpg" width={600} height={600} fit="cover" />
        <Image src="dog-1.jpg" width={300} height={300} fit="cover" />
        <Image src="dog-1.jpg" width={150} height={150} fit="cover" />
        <Image src="dog-1.jpg" width={50} height={50} fit="cover" />
      </div>

      <h1 className="mt-12 text-4xl">Contain</h1>
      <div className="flex gap-4 items-center overflow-x-scroll">
        <Image src="other-dogs/dog-2.jpg" width={600} fit="contain" />
        <Image src="other-dogs/dog-2.jpg" width={300} fit="contain" />
        <Image src="other-dogs/dog-2.jpg" width={150} fit="contain" />
        <Image src="other-dogs/dog-2.jpg" width={50} fit="contain" />
      </div>
    </div>
  )
}
