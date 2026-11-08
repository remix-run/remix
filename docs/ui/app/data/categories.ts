export const categories = [
  {
    id: 'patterns',
    title: 'Patterns',
    description: 'Accessible interactions for accordions, menus, tabs and more.',
  },
  {
    id: 'animation',
    title: 'Animation',
    description: 'Entrance, exit and layout motion, springs and tweens.',
  },
] as const

export type Category = (typeof categories)[number]['id']
