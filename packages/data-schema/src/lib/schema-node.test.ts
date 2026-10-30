import * as assert from '@remix-run/assert'
import { describe, it } from '@remix-run/test'

import { maxLength, minLength } from './checks.ts'
import { coerceBigint, coerceBoolean, coerceDate, coerceNumber, coerceString } from './coerce.ts'
import * as formData from './form-data.ts'
import { lazy, resolveLazySchema } from './lazy.ts'
import {
  any,
  array,
  bigint,
  boolean,
  createSchema,
  defaulted,
  enum_,
  instanceof_,
  literal,
  map,
  null_,
  nullable,
  number,
  object,
  optional,
  parseSafe,
  record,
  set,
  string,
  symbol,
  tuple,
  undefined_,
  union,
  variant,
} from './schema.ts'
import type { Issue, Schema, SchemaNode } from './schema.ts'

function inspect(schema: Schema<any, any>): SchemaNode {
  return schema as SchemaNode
}

// A minimal walker like the ones schema converters use: it follows child schemas and visits each
// lazy schema once, so recursive schemas terminate.
function collectKinds(schema: Schema<any, any>, visited = new Set<SchemaNode>()): string[] {
  let node = inspect(schema)

  if (visited.has(node)) {
    return ['(cycle)']
  }

  visited.add(node)

  switch (node.kind) {
    case 'lazy':
      return ['lazy', ...collectKinds(resolveLazySchema(node), visited)]
    case 'object':
      return [
        'object',
        ...Object.values(node.entries).flatMap((entry) => collectKinds(entry, visited)),
      ]
    case 'array':
      return ['array', ...collectKinds(node.item, visited)]
    default:
      return [node.kind]
  }
}

type TreeNode = { id: string; children: TreeNode[] }

describe('schema nodes', () => {
  describe('primitives', () => {
    it('store their kind', () => {
      assert.deepEqual(
        [any(), bigint(), boolean(), null_(), number(), string(), symbol(), undefined_()].map(
          (schema) => inspect(schema).kind,
        ),
        ['any', 'bigint', 'boolean', 'null', 'number', 'string', 'symbol', 'undefined'],
      )
    })

    it('have no rule data besides their kind', () => {
      assert.deepEqual(Object.keys(string()), ['kind', '~run'])
    })
  })

  describe('array', () => {
    it('keeps its item schema', () => {
      let item = string()
      let node = inspect(array(item))

      assert.ok(node.kind === 'array')
      assert.equal(node.item, item)
    })
  })

  describe('object', () => {
    it('keeps its entries and strips unknown keys by default', () => {
      let entries = { name: string(), tags: array(string()) }
      let node = inspect(object(entries))

      assert.ok(node.kind === 'object')
      assert.equal(node.entries, entries)
      assert.equal(node.unknownKeys, 'strip')
    })

    it('keeps its unknown-key mode', () => {
      let passthrough = inspect(object({}, { unknownKeys: 'passthrough' }))
      let error = inspect(object({}, { unknownKeys: 'error' }))

      assert.ok(passthrough.kind === 'object')
      assert.equal(passthrough.unknownKeys, 'passthrough')
      assert.ok(error.kind === 'object')
      assert.equal(error.unknownKeys, 'error')
    })

    it('can be walked through its nested schemas', () => {
      let node = inspect(object({ address: object({ city: string() }) }))

      assert.ok(node.kind === 'object')
      let address = inspect(node.entries.address)
      assert.ok(address.kind === 'object')
      assert.equal(inspect(address.entries.city).kind, 'string')
    })
  })

  describe('wrappers', () => {
    it('keep the schema they wrap', () => {
      let source = string()
      let optionalNode = inspect(optional(source))
      let nullableNode = inspect(nullable(source))

      assert.ok(optionalNode.kind === 'optional')
      assert.equal(optionalNode.source, source)
      assert.ok(nullableNode.kind === 'nullable')
      assert.equal(nullableNode.source, source)
    })

    it('keep default values and default factories as given', () => {
      let source = array(string())
      let factory = () => ['new']
      let valueNode = inspect(defaulted(string(), 'anonymous'))
      let factoryNode = inspect(defaulted(source, factory))

      assert.ok(valueNode.kind === 'defaulted')
      assert.equal(valueNode.defaultValue, 'anonymous')
      assert.ok(factoryNode.kind === 'defaulted')
      assert.equal(factoryNode.source, source)
      assert.equal(factoryNode.defaultValue, factory)
    })
  })

  describe('union', () => {
    it('keeps its members in order', () => {
      let members = [string(), number(), null_()]
      let node = inspect(union(members))

      assert.ok(node.kind === 'union')
      assert.equal(node.members, members)
    })
  })

  describe('lazy', () => {
    it('does not resolve its schema when it is created', () => {
      let calls = 0
      let node = inspect(
        lazy(() => {
          calls++
          return string()
        }),
      )

      assert.ok(node.kind === 'lazy')
      assert.equal(node.resolved, undefined)
      assert.equal(calls, 0)
    })

    it('can walk a recursive schema without an endless cycle', () => {
      let calls = 0
      let Tree: Schema<unknown, TreeNode> = lazy(() => {
        calls++
        return object({ id: string(), children: array(Tree) })
      })

      assert.deepEqual(collectKinds(Tree), ['lazy', 'object', 'string', 'array', '(cycle)'])
      assert.deepEqual(parseSafe(Tree, { id: 'root', children: [{ id: 'leaf', children: [] }] }), {
        success: true,
        value: { id: 'root', children: [{ id: 'leaf', children: [] }] },
      })
      assert.equal(calls, 1)
    })
  })

  describe('enum_', () => {
    it('keeps its allowed values', () => {
      let values = ['admin', 'member'] as const
      let node = inspect(enum_(values))

      assert.ok(node.kind === 'enum')
      assert.equal(node.values, values)
    })
  })

  describe('instanceof_', () => {
    it('keeps its class', () => {
      let node = inspect(instanceof_(Date))

      assert.ok(node.kind === 'instanceof')
      assert.equal(node.class, Date)
    })
  })

  describe('literal', () => {
    it('keeps its literal value', () => {
      let node = inspect(literal(42))

      assert.ok(node.kind === 'literal')
      assert.equal(node.literal, 42)
    })
  })

  describe('map', () => {
    it('keeps its key and value schemas', () => {
      let key = string()
      let value = number()
      let node = inspect(map(key, value))

      assert.ok(node.kind === 'map')
      assert.equal(node.key, key)
      assert.equal(node.value, value)
    })
  })

  describe('record', () => {
    it('keeps its key and value schemas', () => {
      let key = string()
      let value = number()
      let node = inspect(record(key, value))

      assert.ok(node.kind === 'record')
      assert.equal(node.key, key)
      assert.equal(node.value, value)
    })
  })

  describe('set', () => {
    it('keeps its value schema', () => {
      let value = string()
      let node = inspect(set(value))

      assert.ok(node.kind === 'set')
      assert.equal(node.value, value)
    })
  })

  describe('tuple', () => {
    it('keeps its item schemas in order', () => {
      let items = [string(), number()]
      let node = inspect(tuple(items))

      assert.ok(node.kind === 'tuple')
      assert.equal(node.items, items)
    })
  })

  describe('variant', () => {
    it('keeps its discriminator and variants', () => {
      let variants = {
        created: object({ type: literal('created') }),
        deleted: object({ type: literal('deleted') }),
      }
      let node = inspect(variant('type', variants))

      assert.ok(node.kind === 'variant')
      assert.equal(node.discriminator, 'type')
      assert.equal(node.variants, variants)
    })
  })

  describe('coerce', () => {
    it('stores the type it coerces to', () => {
      assert.deepEqual(
        [coerceBigint(), coerceBoolean(), coerceDate(), coerceNumber(), coerceString()].map(
          (schema) => {
            let node = inspect(schema)
            return node.kind === 'coerce' ? node.target : node.kind
          },
        ),
        ['bigint', 'boolean', 'date', 'number', 'string'],
      )
    })
  })

  describe('form-data object', () => {
    it('keeps its field entries', () => {
      let entries = {
        title: formData.field(string(), { name: 'post-title' }),
        tags: formData.fields(array(string())),
      }
      let node = inspect(formData.object(entries))

      assert.ok(node.kind === 'formData')
      assert.equal(node.entries, entries)
      assert.deepEqual(
        Object.values(node.entries).map((entry) => [entry.kind, entry.name]),
        [
          ['field', 'post-title'],
          ['fields', undefined],
        ],
      )
    })
  })

  describe('pipe', () => {
    it('keeps its source and checks in order', () => {
      let source = string()
      let first = minLength(2)
      let second = maxLength(4)
      let node = inspect(source.pipe(first, second))

      assert.ok(node.kind === 'pipe')
      assert.equal(node.source, source)
      assert.deepEqual(node.checks, [first, second])
      assert.equal(node.checks[0].code, 'string.min_length')
      assert.deepEqual(node.checks[0].values, { min: 2 })
    })

    it('returns the same schema when no checks are given', () => {
      let schema = string()

      assert.equal(schema.pipe(), schema)
    })
  })

  describe('refine', () => {
    it('keeps its source, predicate and message', () => {
      let source = string()
      let predicate = (value: string) => value.length > 0
      let node = inspect(source.refine(predicate, 'Required'))

      assert.ok(node.kind === 'refine')
      assert.equal(node.source, source)
      assert.equal(node.predicate, predicate)
      assert.equal(node.message, 'Required')
    })
  })

  describe('transform', () => {
    it('keeps its source and transformer', () => {
      let source = number()
      let transformer = (value: number) => String(value)
      let node = inspect(source.transform(transformer))

      assert.ok(node.kind === 'transform')
      assert.equal(node.source, source)
      assert.equal(node.transformer, transformer)
    })
  })

  describe('composed operations', () => {
    it('describes each step in the order it was added', () => {
      let schema = number()
        .transform((value) => String(value))
        .refine((value) => value.length === 2)
        .pipe(maxLength(2))
      let node = inspect(schema)

      assert.ok(node.kind === 'pipe')
      let refine = inspect(node.source)
      assert.ok(refine.kind === 'refine')
      let transform = inspect(refine.source)
      assert.ok(transform.kind === 'transform')
      assert.equal(inspect(transform.source).kind, 'number')
    })

    it('runs steps in the order they were added', () => {
      let transformThenRefine = number()
        .transform((value) => String(value))
        .refine((value) => value.length === 2)
      let refineThenTransform = number()
        .refine((value) => value > 9)
        .transform((value) => String(value).length)

      assert.deepEqual(parseSafe(transformThenRefine, 42), { success: true, value: '42' })
      assert.equal(parseSafe(transformThenRefine, 7).success, false)
      assert.deepEqual(parseSafe(refineThenTransform, 123), { success: true, value: 3 })
      assert.equal(parseSafe(refineThenTransform, 7).success, false)
    })
  })

  describe('~standard', () => {
    it('validates frozen schemas', () => {
      let schema = Object.freeze(object({ name: string() }))

      assert.deepEqual(schema['~standard'].validate({ name: 'Ada' }), { value: { name: 'Ada' } })
      assert.deepEqual(schema['~standard'].validate({ name: 'Ada' }), { value: { name: 'Ada' } })
    })
  })

  describe('createSchema', () => {
    it('marks custom validators as opaque', () => {
      let validator = (value: unknown) => ({ value })
      let node = inspect(createSchema(validator))

      assert.ok(node.kind === 'custom')
      assert.equal(node.validator, validator)
    })

    it('gives custom schemas inside steps a stable path', () => {
      let seen: Issue['path'][] = []
      let custom = createSchema<unknown, string>(function validate(value, context) {
        seen.push(context.path)
        return { value: String(value) }
      })
      let schema = object({
        user: object({ name: custom.refine(() => true).transform((value) => value) }),
      })

      assert.equal(parseSafe(schema, { user: { name: 'Ada' } }).success, true)
      assert.deepEqual(seen, [['user', 'name']])
    })
  })
})
