import type { Pluralize } from './pluralize.ts'
import type { Assert, IsEqual } from './type-utils.d.ts'

// prettier-ignore
export type Tests = [
  // invariants
  Assert<IsEqual<Pluralize<'sheep'>, 'sheep'>>,
  Assert<IsEqual<Pluralize<'fish'>, 'fish'>>,
  Assert<IsEqual<Pluralize<'series'>, 'series'>>,
  Assert<IsEqual<Pluralize<'species'>, 'species'>>,
  Assert<IsEqual<Pluralize<'equipment'>, 'equipment'>>,
  Assert<IsEqual<Pluralize<'information'>, 'information'>>,
  Assert<IsEqual<Pluralize<'money'>, 'money'>>,
  Assert<IsEqual<Pluralize<'news'>, 'news'>>,

  // irregulars
  Assert<IsEqual<Pluralize<'person'>, 'people'>>,
  Assert<IsEqual<Pluralize<'man'>, 'men'>>,
  Assert<IsEqual<Pluralize<'woman'>, 'women'>>,
  Assert<IsEqual<Pluralize<'child'>, 'children'>>,
  Assert<IsEqual<Pluralize<'mouse'>, 'mice'>>,
  Assert<IsEqual<Pluralize<'goose'>, 'geese'>>,
  Assert<IsEqual<Pluralize<'foot'>, 'feet'>>,
  Assert<IsEqual<Pluralize<'tooth'>, 'teeth'>>,
  Assert<IsEqual<Pluralize<'ox'>, 'oxen'>>,
  Assert<IsEqual<Pluralize<'analysis'>, 'analyses'>>,
  Assert<IsEqual<Pluralize<'axis'>, 'axes'>>,
  Assert<IsEqual<Pluralize<'crisis'>, 'crises'>>,
  Assert<IsEqual<Pluralize<'thesis'>, 'theses'>>,
  Assert<IsEqual<Pluralize<'phenomenon'>, 'phenomena'>>,
  Assert<IsEqual<Pluralize<'criterion'>, 'criteria'>>,
  Assert<IsEqual<Pluralize<'datum'>, 'data'>>,
  Assert<IsEqual<Pluralize<'medium'>, 'media'>>,
  Assert<IsEqual<Pluralize<'index'>, 'indexes'>>,
  Assert<IsEqual<Pluralize<'matrix'>, 'matrices'>>,
  Assert<IsEqual<Pluralize<'quiz'>, 'quizzes'>>,

  // s/x/z/ch/sh → es
  Assert<IsEqual<Pluralize<'class'>, 'classes'>>,
  Assert<IsEqual<Pluralize<'box'>, 'boxes'>>,
  Assert<IsEqual<Pluralize<'buzz'>, 'buzzes'>>,
  Assert<IsEqual<Pluralize<'match'>, 'matches'>>,
  Assert<IsEqual<Pluralize<'bush'>, 'bushes'>>,

  // f/fe → ves
  Assert<IsEqual<Pluralize<'leaf'>, 'leaves'>>,
  Assert<IsEqual<Pluralize<'knife'>, 'knives'>>,

  // selected -o words → es
  Assert<IsEqual<Pluralize<'hero'>, 'heroes'>>,
  Assert<IsEqual<Pluralize<'potato'>, 'potatoes'>>,
  Assert<IsEqual<Pluralize<'tomato'>, 'tomatoes'>>,
  Assert<IsEqual<Pluralize<'echo'>, 'echoes'>>,
  Assert<IsEqual<Pluralize<'mosquito'>, 'mosquitoes'>>,
  Assert<IsEqual<Pluralize<'veto'>, 'vetoes'>>,
  Assert<IsEqual<Pluralize<'torpedo'>, 'torpedoes'>>,

  // consonant + y → ies
  Assert<IsEqual<Pluralize<'category'>, 'categories'>>,
  Assert<IsEqual<Pluralize<'city'>, 'cities'>>,
  Assert<IsEqual<Pluralize<'baby'>, 'babies'>>,

  // vowel + y → s
  Assert<IsEqual<Pluralize<'toy'>, 'toys'>>,
  Assert<IsEqual<Pluralize<'key'>, 'keys'>>,
  Assert<IsEqual<Pluralize<'day'>, 'days'>>,

  // case normalization in checks, original casing in output type
  Assert<IsEqual<Pluralize<'User'>, 'Users'>>,
  Assert<IsEqual<Pluralize<'Category'>, 'Categories'>>,
  Assert<IsEqual<Pluralize<'BOX'>, 'BOXes'>>,
  Assert<IsEqual<Pluralize<'Hero'>, 'Heroes'>>,
]
