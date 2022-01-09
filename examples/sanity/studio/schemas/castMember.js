export default {
  name: 'castMember',
  title: 'Cast Member',
  type: 'object',
  fields: [
    {
      name: 'characterName',
      title: 'Character Name',
      type: 'string',
    },
    {
      name: 'person',
      title: 'Actor',
      type: 'reference',
      to: [{type: 'person'}],
    },
    {
      name: 'externalId',
      title: 'External ID',
      type: 'number',
    },
    {
      name: 'externalCreditId',
      title: 'External Credit ID',
      type: 'string',
    },
  ],
  preview: {
    select: {
      subtitle: 'characterName',
      title: 'person.name',
      media: 'person.image',
    },
  },
}
