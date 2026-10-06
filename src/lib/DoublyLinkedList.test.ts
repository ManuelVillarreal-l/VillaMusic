// Ejecutar con:  npm test   (Node 22+, sin instalar nada extra)
import assert from 'node:assert/strict';
import { DoublyLinkedList } from './DoublyLinkedList.ts';
import type { ListNode } from './DoublyLinkedList.ts';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

const make = (...items: string[]) => DoublyLinkedList.from(items);
const ok = (l: DoublyLinkedList<string>) => assert.ok(l.checkIntegrity(), 'integridad rota');

console.log('DoublyLinkedList');

test('lista vacía', () => {
  const l = new DoublyLinkedList<string>();
  assert.equal(l.size, 0);
  assert.equal(l.head, null);
  assert.equal(l.tail, null);
  ok(l);
});

test('append / prepend mantienen head y tail', () => {
  const l = new DoublyLinkedList<string>();
  l.append('b');
  l.append('c');
  l.prepend('a');
  assert.deepEqual(l.toArray(), ['a', 'b', 'c']);
  assert.equal(l.head?.value, 'a');
  assert.equal(l.tail?.value, 'c');
  ok(l);
});

test('insertBefore / insertAfter en cualquier posición', () => {
  const l = make('a', 'c', 'e');
  const c = l.findNode((v) => v === 'c') as ListNode<string>;
  l.insertBefore(c, 'b');
  l.insertAfter(c, 'd');
  assert.deepEqual(l.toArray(), ['a', 'b', 'c', 'd', 'e']);
  l.insertBefore(l.head as ListNode<string>, '0');
  l.insertAfter(l.tail as ListNode<string>, 'f');
  assert.deepEqual(l.toArray(), ['0', 'a', 'b', 'c', 'd', 'e', 'f']);
  ok(l);
});

test('insertAt con índices en los bordes', () => {
  const l = make('b', 'c');
  l.insertAt(0, 'a');
  l.insertAt(99, 'd');
  l.insertAt(2, 'x');
  assert.deepEqual(l.toArray(), ['a', 'b', 'x', 'c', 'd']);
  ok(l);
});

test('removeNode: cabeza, cola, medio y único', () => {
  const l = make('a', 'b', 'c', 'd');
  l.removeNode(l.getNodeAt(1) as ListNode<string>);
  assert.deepEqual(l.toArray(), ['a', 'c', 'd']);
  l.removeNode(l.head as ListNode<string>);
  assert.deepEqual(l.toArray(), ['c', 'd']);
  l.removeNode(l.tail as ListNode<string>);
  assert.deepEqual(l.toArray(), ['c']);
  l.removeNode(l.head as ListNode<string>);
  assert.equal(l.size, 0);
  assert.equal(l.head, null);
  assert.equal(l.tail, null);
  ok(l);
});

test('un nodo eliminado ya no pertenece a la lista', () => {
  const l = make('a', 'b');
  const a = l.head as ListNode<string>;
  l.removeNode(a);
  assert.equal(a.owner, null);
  assert.equal(l.indexOf(a), -1);
  assert.throws(() => l.removeNode(a));
});

test('getNodeAt recorre desde el extremo más cercano', () => {
  const l = make('a', 'b', 'c', 'd', 'e');
  assert.equal(l.getNodeAt(0)?.value, 'a');
  assert.equal(l.getNodeAt(4)?.value, 'e');
  assert.equal(l.getNodeAt(3)?.value, 'd');
  assert.equal(l.getNodeAt(5), null);
  assert.equal(l.getNodeAt(-1), null);
});

test('prev / next navegan en ambos sentidos', () => {
  const l = make('a', 'b', 'c');
  const b = l.getNodeAt(1) as ListNode<string>;
  assert.equal(b.prev?.value, 'a');
  assert.equal(b.next?.value, 'c');
  assert.equal(b.prev?.prev, null);
  assert.equal(b.next?.next, null);
  assert.deepEqual(Array.from(l.reverseNodes(), (n) => n.value), ['c', 'b', 'a']);
});

test('moveNode reordena sin crear nodos nuevos', () => {
  const l = make('a', 'b', 'c', 'd');
  const a = l.getNodeAt(0) as ListNode<string>;
  const d = l.getNodeAt(3) as ListNode<string>;
  const id = a.id;
  assert.equal(l.moveNode(a, d, 'after'), true);
  assert.deepEqual(l.toArray(), ['b', 'c', 'd', 'a']);
  assert.equal(a.id, id);
  l.moveNode(a, l.head as ListNode<string>, 'before');
  assert.deepEqual(l.toArray(), ['a', 'b', 'c', 'd']);
  l.moveNode(l.getNodeAt(1) as ListNode<string>, l.getNodeAt(2) as ListNode<string>, 'after');
  assert.deepEqual(l.toArray(), ['a', 'c', 'b', 'd']);
  assert.equal(l.size, 4);
  ok(l);
});

test('moveNode sin cambios devuelve false', () => {
  const l = make('a', 'b', 'c');
  const [a, b] = [l.getNodeAt(0) as ListNode<string>, l.getNodeAt(1) as ListNode<string>];
  assert.equal(l.moveNode(a, a, 'after'), false);
  assert.equal(l.moveNode(a, b, 'before'), false);
  assert.equal(l.moveNode(b, a, 'after'), false);
  assert.deepEqual(l.toArray(), ['a', 'b', 'c']);
  ok(l);
});

test('reverse invierte y mantiene la integridad', () => {
  const l = make('a', 'b', 'c', 'd');
  l.reverse();
  assert.deepEqual(l.toArray(), ['d', 'c', 'b', 'a']);
  assert.equal(l.head?.value, 'd');
  assert.equal(l.tail?.value, 'a');
  ok(l);
  const one = make('x');
  one.reverse();
  assert.deepEqual(one.toArray(), ['x']);
  ok(one);
});

test('sort es estable y conserva los nodos', () => {
  const l = DoublyLinkedList.from([
    { n: 'b', k: 2 },
    { n: 'a', k: 1 },
    { n: 'c', k: 2 },
    { n: 'd', k: 1 },
  ]);
  const idsBefore = new Set(l.nodeArray().map((n) => n.id));
  l.sort((x, y) => x.k - y.k);
  assert.deepEqual(l.toArray().map((x) => x.n), ['a', 'd', 'b', 'c']);
  assert.deepEqual(new Set(l.nodeArray().map((n) => n.id)), idsBefore);
  assert.ok(l.checkIntegrity());
});

test('clear desvincula todos los nodos', () => {
  const l = make('a', 'b', 'c');
  const a = l.head as ListNode<string>;
  l.clear();
  assert.equal(l.size, 0);
  assert.equal(a.owner, null);
  ok(l);
});

test('estrés: 2000 operaciones aleatorias mantienen la integridad', () => {
  const l = new DoublyLinkedList<number>();
  const model: number[] = [];
  let seed = 12345;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 2000; i++) {
    const r = rand();
    if (r < 0.45 || model.length === 0) {
      const idx = Math.floor(rand() * (model.length + 1));
      l.insertAt(idx, i);
      model.splice(idx, 0, i);
    } else if (r < 0.75) {
      const idx = Math.floor(rand() * model.length);
      l.removeAt(idx);
      model.splice(idx, 1);
    } else {
      const from = Math.floor(rand() * model.length);
      const to = Math.floor(rand() * model.length);
      const placement = rand() < 0.5 ? 'before' : 'after';
      const node = l.getNodeAt(from) as ListNode<number>;
      const ref = l.getNodeAt(to) as ListNode<number>;
      l.moveNode(node, ref, placement);
      if (from !== to) {
        const [v] = model.splice(from, 1);
        const target = model.indexOf(ref.value);
        model.splice(placement === 'before' ? target : target + 1, 0, v);
      }
    }
    if (i % 100 === 0) assert.ok(l.checkIntegrity());
  }
  assert.deepEqual(l.toArray(), model);
  assert.ok(l.checkIntegrity());
});

console.log(`\n${passed} pruebas OK`);
