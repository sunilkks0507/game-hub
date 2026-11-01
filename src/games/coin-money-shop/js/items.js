// Shop items: plain data. Each item has a price range in whole rupees (lo to hi).
// The pictures are original SVG symbols in index.html with the same ids.

export const ITEMS = [
  { id: 'balloon', name: 'Balloon', lo: 1, hi: 10 },
  { id: 'eraser', name: 'Eraser', lo: 1, hi: 8 },
  { id: 'sweet', name: 'Sweet', lo: 1, hi: 12 },
  { id: 'pencil', name: 'Pencil', lo: 2, hi: 15 },
  { id: 'biscuit', name: 'Biscuit packet', lo: 5, hi: 25 },
  { id: 'lassi', name: 'Lassi', lo: 10, hi: 40 },
  { id: 'kite', name: 'Kite', lo: 10, hi: 60 },
  { id: 'notebook', name: 'Notebook', lo: 15, hi: 80 },
  { id: 'mango', name: 'Mango box', lo: 20, hi: 100 },
  { id: 'car', name: 'Toy car', lo: 30, hi: 100 },
];

export const itemById = (id) => ITEMS.find((i) => i.id === id) || null;
export const itemsForPrice = (price) => ITEMS.filter((i) => price >= i.lo && price <= i.hi);
