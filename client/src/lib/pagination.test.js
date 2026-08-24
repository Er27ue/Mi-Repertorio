import assert from "node:assert/strict";
import test from "node:test";
import { clampPage, getPageCount, paginateItems } from "./pagination.js";

const items = Array.from({ length: 23 }, (_, index) => ({ id: index + 1 }));

test("divide las canciones en paginas de diez", () => {
  assert.equal(getPageCount(items.length), 3);
  assert.deepEqual(paginateItems(items, 1).map((item) => item.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(paginateItems(items, 2).map((item) => item.id), [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.deepEqual(paginateItems(items, 3).map((item) => item.id), [21, 22, 23]);
});

test("mantiene la pagina dentro del rango disponible", () => {
  assert.equal(clampPage(0, 3), 1);
  assert.equal(clampPage(7, 3), 3);
  assert.deepEqual(paginateItems(items, 99).map((item) => item.id), [21, 22, 23]);
});

test("una lista vacia conserva una primera pagina vacia", () => {
  assert.equal(getPageCount(0), 1);
  assert.deepEqual(paginateItems([], 1), []);
});
