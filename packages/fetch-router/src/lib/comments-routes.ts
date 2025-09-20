export default {
  create({ params }: { params: { id: string } }) {
    return new Response(`Created comment ${params.id}`)
  },
}
