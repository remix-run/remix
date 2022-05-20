import {
  cardinalityUtil,
  ObjectTypeSet,
  TypeSet,
  Expression,
  ExpressionKind,
  TypeKind,
  LinkDesc,
  PropertyDesc,
  Cardinality,
} from "edgedb/dist/reflection";
import type {
  PathParent,
  $expr_PathLeaf,
  $expr_PathNode,
  $pathify,
  ExpressionRoot,
} from "edgedb/dist/reflection/path";
import {literalToTypeSet} from "../castMaps";
import {$arrayLikeIndexify, $tuplePathify} from "./collections";
import {$toEdgeQL} from "./toEdgeQL";
import {$queryFunc, $queryFuncJSON} from "./query";

function PathLeaf<
  Root extends TypeSet,
  Parent extends PathParent,
  Exclusive extends boolean = boolean
>(
  root: Root,
  parent: Parent,
  exclusive: Exclusive,
  scopeRoot: TypeSet | null = null
): $expr_PathLeaf<Root, Parent, Exclusive> {
  return $expressionify({
    __kind__: ExpressionKind.PathLeaf,
    __element__: root.__element__,
    __cardinality__: root.__cardinality__,
    __parent__: parent,
    __exclusive__: exclusive,
    __scopeRoot__: scopeRoot,
  }) as any;
}

function PathNode<
  Root extends ObjectTypeSet,
  Parent extends PathParent | null,
  Exclusive extends boolean = boolean
>(
  root: Root,
  parent: Parent,
  exclusive: Exclusive,
  scopeRoot: TypeSet | null = null
): $expr_PathNode<Root, Parent, Exclusive> {
  const obj = {
    __kind__: ExpressionKind.PathNode,
    __element__: root.__element__,
    __cardinality__: root.__cardinality__,
    __parent__: parent,
    __exclusive__: exclusive,
    __scopeRoot__: scopeRoot,
  };

  const shape: any = {};
  Object.entries(obj.__element__.__pointers__).map(([key, ptr]) => {
    if (ptr.__kind__ === "property") {
      shape[key] = true;
    }
  });
  Object.defineProperty(obj, "*", {
    writable: false,
    value: shape,
  });
  return $expressionify(obj) as any;
}

const _pathCache = Symbol();
const _pointers = Symbol();

const pathifyProxyHandlers: ProxyHandler<any> = {
  get(target: any, prop: string | symbol, proxy: any) {
    const ptr = target[_pointers][prop as any] as LinkDesc | PropertyDesc;
    if (ptr) {
      return (
        target[_pathCache][prop] ??
        (target[_pathCache][prop] = (
          (ptr.__kind__ === "property" ? PathLeaf : PathNode) as any
        )(
          {
            __element__: ptr.target,
            __cardinality__: cardinalityUtil.multiplyCardinalities(
              target.__cardinality__,
              ptr.cardinality
            ),
          },
          {
            linkName: prop,
            type: proxy,
          },
          ptr.exclusive ?? false,
          target.__scopeRoot__ ?? (scopeRoots.has(proxy) ? proxy : null)
        ))
      );
    }
    return target[prop];
  },
};

function _$pathify<Root extends TypeSet, Parent extends PathParent>(
  _root: Root
): $pathify<Root, Parent> {
  if (_root.__element__.__kind__ !== TypeKind.object) {
    return _root as any;
  }

  const root: $expr_PathNode<ObjectTypeSet, Parent> = _root as any;

  let pointers = {
    ...root.__element__.__pointers__,
  };

  if (root.__parent__) {
    const {type, linkName} = root.__parent__;
    const parentPointer = type.__element__.__pointers__[linkName];
    if (parentPointer?.__kind__ === "link") {
      pointers = {...pointers, ...parentPointer.properties};
    }
  }

  for (const [key, val] of Object.entries(
    root.__element__.__shape__ || {id: true}
  )) {
    if ((val as any)?.__element__ && !pointers[key]) {
      pointers[key] = {
        __kind__: "property",
        target: (val as any).__element__,
        cardinality: (val as any).__cardinality__,
        exclusive: false,
        // writable: false,
        computed: true,
        readonly: true,
        hasDefault: false,
      };
    }
  }

  (root as any)[_pointers] = pointers;
  (root as any)[_pathCache] = {};

  return new Proxy(root, pathifyProxyHandlers);
}

function isFunc(this: any, expr: ObjectTypeSet) {
  return $expressionify({
    __kind__: ExpressionKind.TypeIntersection,
    __cardinality__: this.__cardinality__,
    __element__: {
      ...expr.__element__,
      __shape__: {id: true},
    } as any,
    __expr__: this,
  });
}

function assert_single(expr: Expression) {
  return $expressionify({
    __kind__: ExpressionKind.Function,
    __element__: expr.__element__,
    __cardinality__: cardinalityUtil.overrideUpperBound(
      expr.__cardinality__,
      "One"
    ),
    __name__: "std::assert_single",
    __args__: [expr],
    __namedargs__: {},
  }) as any;
}

const jsonDestructureProxyHandlers: ProxyHandler<ExpressionRoot> = {
  get(target: ExpressionRoot, prop: string | symbol, proxy: any) {
    if (typeof prop === "string" && !(prop in target)) {
      const parsedProp = Number.isInteger(Number(prop)) ? Number(prop) : prop;
      return jsonDestructure.call(proxy, parsedProp);
    }
    return (target as any)[prop];
  },
};

function jsonDestructure(this: ExpressionRoot, path: any) {
  const pathTypeSet = literalToTypeSet(path);
  return $expressionify({
    __kind__: ExpressionKind.Operator,
    __element__: this.__element__,
    __cardinality__: cardinalityUtil.multiplyCardinalities(
      this.__cardinality__,
      pathTypeSet.__cardinality__
    ),
    __name__: "[]",
    __opkind__: "Infix",
    __args__: [this, pathTypeSet],
  }) as any;
}

export function $jsonDestructure(_expr: ExpressionRoot) {
  if (
    _expr.__element__.__kind__ === TypeKind.scalar &&
    _expr.__element__.__name__ === "std::json"
  ) {
    const expr = new Proxy(_expr, jsonDestructureProxyHandlers) as any;

    expr.destructure = jsonDestructure.bind(expr);

    return expr;
  }

  return _expr;
}

export function $expressionify<T extends ExpressionRoot>(
  _expr: T
): Expression<T> {
  const expr: Expression = _$pathify(
    $jsonDestructure($arrayLikeIndexify($tuplePathify(_expr)))
  ) as any;

  expr.run = $queryFunc.bind(expr) as any;
  expr.runJSON = $queryFuncJSON.bind(expr) as any;
  expr.is = isFunc.bind(expr) as any;
  expr.toEdgeQL = $toEdgeQL.bind(expr);
  expr.assert_single = () => assert_single(expr) as any;

  return Object.freeze(expr) as any;
}

const scopedExprCache = new WeakMap<ExpressionRoot, Expression>();
const scopeRoots = new WeakSet<Expression>();

export function $getScopedExpr<T extends ExpressionRoot>(
  expr: T,
  existingScopes?: Set<Expression>
): Expression<T> {
  let scopedExpr = scopedExprCache.get(expr);
  if (!scopedExpr || existingScopes?.has(scopedExpr)) {
    const uncached = !scopedExpr;
    scopedExpr = $expressionify({
      ...expr,
      __cardinality__: Cardinality.One,
      __scopedFrom__: expr,
    });
    scopeRoots.add(scopedExpr);
    if (uncached) {
      scopedExprCache.set(expr, scopedExpr);
    }
  }
  existingScopes?.add(scopedExpr);
  return scopedExpr as any;
}

export {_$pathify as $pathify, PathLeaf as $PathLeaf, PathNode as $PathNode};
