/**
 * Lista doblemente enlazada genérica: el corazón de VillaMusic.
 *
 * Cada playlist es una DoublyLinkedList<Song>. Cada nodo conoce al anterior (prev)
 * y al siguiente (next), así que:
 *   - insertar antes/después de un nodo      → O(1)
 *   - eliminar un nodo que ya tienes          → O(1)
 *   - mover un nodo a otra posición           → O(1)
 *   - siguiente / anterior en la reproducción → O(1)
 *   - invertir la lista                       → O(n)
 *
 * Nota: este archivo usa solo sintaxis "borrable" de TypeScript para poder
 * ejecutarse directo con Node (npm test) sin compilar.
 */

export type Placement = 'before' | 'after';

let nextNodeId = 1;

export class ListNode<T> {
  /** Identificador único del nodo (sirve como key en React: una canción puede repetirse). */
  readonly id: number;
  value: T;
  prev: ListNode<T> | null;
  next: ListNode<T> | null;
  /** Lista a la que pertenece ahora mismo (null si fue eliminado). */
  owner: DoublyLinkedList<T> | null;

  constructor(value: T) {
    this.id = nextNodeId++;
    this.value = value;
    this.prev = null;
    this.next = null;
    this.owner = null;
  }
}

export class DoublyLinkedList<T> implements Iterable<T> {
  head: ListNode<T> | null = null;
  tail: ListNode<T> | null = null;
  private count = 0;

  get size(): number {
    return this.count;
  }

  get isEmpty(): boolean {
    return this.count === 0;
  }

  static from<T>(items: Iterable<T>): DoublyLinkedList<T> {
    const list = new DoublyLinkedList<T>();
    for (const item of items) list.append(item);
    return list;
  }

  // ───────────────────────── inserciones ─────────────────────────

  /** Agrega al final. O(1). */
  append(value: T): ListNode<T> {
    return this.link(new ListNode(value), this.tail, null);
  }

  /** Agrega al inicio. O(1). */
  prepend(value: T): ListNode<T> {
    return this.link(new ListNode(value), null, this.head);
  }

  /** Inserta justo antes de `ref`. O(1). */
  insertBefore(ref: ListNode<T>, value: T): ListNode<T> {
    this.assertOwns(ref);
    return this.link(new ListNode(value), ref.prev, ref);
  }

  /** Inserta justo después de `ref`. O(1). */
  insertAfter(ref: ListNode<T>, value: T): ListNode<T> {
    this.assertOwns(ref);
    return this.link(new ListNode(value), ref, ref.next);
  }

  insertRelative(ref: ListNode<T>, value: T, placement: Placement): ListNode<T> {
    return placement === 'before' ? this.insertBefore(ref, value) : this.insertAfter(ref, value);
  }

  /** Inserta en un índice (0 = inicio, size = final). Recorre desde el extremo más cercano. */
  insertAt(index: number, value: T): ListNode<T> {
    if (index <= 0 || this.count === 0) return this.prepend(value);
    if (index >= this.count) return this.append(value);
    const ref = this.getNodeAt(index) as ListNode<T>;
    return this.insertBefore(ref, value);
  }

  // ───────────────────────── eliminaciones ─────────────────────────

  /** Elimina un nodo concreto. O(1). Devuelve su valor. */
  removeNode(node: ListNode<T>): T {
    this.assertOwns(node);
    this.unlink(node);
    return node.value;
  }

  removeAt(index: number): T | undefined {
    const node = this.getNodeAt(index);
    return node ? this.removeNode(node) : undefined;
  }

  clear(): void {
    let n = this.head;
    while (n) {
      const next = n.next;
      n.prev = null;
      n.next = null;
      n.owner = null;
      n = next;
    }
    this.head = null;
    this.tail = null;
    this.count = 0;
  }

  // ───────────────────────── reordenamiento ─────────────────────────

  /**
   * Mueve un nodo existente antes/después de `ref` SIN crear uno nuevo.
   * Es lo que usa el drag & drop para reordenar. O(1).
   * Devuelve false si no hubo cambio (mismo nodo o ya estaba ahí).
   */
  moveNode(node: ListNode<T>, ref: ListNode<T>, placement: Placement): boolean {
    this.assertOwns(node);
    this.assertOwns(ref);
    if (node === ref) return false;
    if (placement === 'before' && ref.prev === node) return false;
    if (placement === 'after' && ref.next === node) return false;

    this.unlink(node);
    if (placement === 'before') this.link(node, ref.prev, ref);
    else this.link(node, ref, ref.next);
    return true;
  }

  /** Invierte la lista intercambiando prev/next de cada nodo. O(n). */
  reverse(): void {
    let cur = this.head;
    while (cur) {
      const next = cur.next;
      cur.next = cur.prev;
      cur.prev = next;
      cur = next;
    }
    const oldHead = this.head;
    this.head = this.tail;
    this.tail = oldHead;
  }

  /** Ordena re-enlazando los mismos nodos (estable). O(n log n). */
  sort(compare: (a: T, b: T) => number): void {
    const nodes = this.nodeArray();
    nodes.sort((a, b) => compare(a.value, b.value));
    let prev: ListNode<T> | null = null;
    for (const node of nodes) {
      node.prev = prev;
      node.next = null;
      if (prev) prev.next = node;
      prev = node;
    }
    this.head = nodes.length ? nodes[0] : null;
    this.tail = prev;
  }

  // ───────────────────────── consulta ─────────────────────────

  /** Nodo en una posición. Camina desde head o tail, lo que quede más cerca. */
  getNodeAt(index: number): ListNode<T> | null {
    if (index < 0 || index >= this.count) return null;
    if (index <= this.count / 2) {
      let n = this.head as ListNode<T>;
      for (let i = 0; i < index; i++) n = n.next as ListNode<T>;
      return n;
    }
    let n = this.tail as ListNode<T>;
    for (let i = this.count - 1; i > index; i--) n = n.prev as ListNode<T>;
    return n;
  }

  indexOf(node: ListNode<T>): number {
    if (node.owner !== this) return -1;
    let i = 0;
    for (let n = this.head; n; n = n.next) {
      if (n === node) return i;
      i++;
    }
    return -1;
  }

  findNode(predicate: (value: T) => boolean): ListNode<T> | null {
    for (let n = this.head; n; n = n.next) if (predicate(n.value)) return n;
    return null;
  }

  contains(node: ListNode<T>): boolean {
    return node.owner === this;
  }

  toArray(): T[] {
    return Array.from(this);
  }

  nodeArray(): ListNode<T>[] {
    return Array.from(this.nodes());
  }

  *[Symbol.iterator](): Iterator<T> {
    for (let n = this.head; n; n = n.next) yield n.value;
  }

  *nodes(): Generator<ListNode<T>> {
    for (let n = this.head; n; n = n.next) yield n;
  }

  *reverseNodes(): Generator<ListNode<T>> {
    for (let n = this.tail; n; n = n.prev) yield n;
  }

  /** Verifica que los enlaces son coherentes en ambos sentidos (útil en pruebas). */
  checkIntegrity(): boolean {
    let forward = 0;
    let last: ListNode<T> | null = null;
    for (let n = this.head; n; n = n.next) {
      if (n.prev !== last || n.owner !== this) return false;
      last = n;
      forward++;
      if (forward > this.count) return false;
    }
    if (last !== this.tail || forward !== this.count) return false;
    let backward = 0;
    for (let n = this.tail; n; n = n.prev) backward++;
    if (backward !== this.count) return false;
    if (this.count === 0) return this.head === null && this.tail === null;
    return (this.head as ListNode<T>).prev === null && (this.tail as ListNode<T>).next === null;
  }

  // ───────────────────────── internos ─────────────────────────

  /** Enlaza `node` entre `prev` y `next` (cualquiera puede ser null en los extremos). */
  private link(node: ListNode<T>, prev: ListNode<T> | null, next: ListNode<T> | null): ListNode<T> {
    node.prev = prev;
    node.next = next;
    if (prev) prev.next = node;
    else this.head = node;
    if (next) next.prev = node;
    else this.tail = node;
    node.owner = this;
    this.count++;
    return node;
  }

  /** Desenlaza `node` conectando a sus vecinos entre sí. */
  private unlink(node: ListNode<T>): void {
    const { prev, next } = node;
    if (prev) prev.next = next;
    else this.head = next;
    if (next) next.prev = prev;
    else this.tail = prev;
    node.prev = null;
    node.next = null;
    node.owner = null;
    this.count--;
  }

  private assertOwns(node: ListNode<T>): void {
    if (node.owner !== this) throw new Error('El nodo no pertenece a esta lista');
  }
}
