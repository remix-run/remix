export default {
  title: 'Plot summaries',
  name: 'plotSummaries',
  type: 'object',
  fields: [
    {
      name: 'caption',
      title: 'Caption',
      type: 'string',
    },
    {
      name: 'summaries',
      title: 'Summaries',
      type: 'array',
      of: [{type: 'plotSummary'}],
    },
  ],
}
