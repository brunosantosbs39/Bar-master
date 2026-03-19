// server/seed.js — dados iniciais do BarMaster
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function readAll(entity) {
  const file = join(DATA_DIR, `${entity}.json`);
  if (!existsSync(file)) return [];
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return []; }
}

function writeAll(entity, data) {
  writeFileSync(join(DATA_DIR, `${entity}.json`), JSON.stringify(data, null, 2));
}

function create(entity, data) {
  const items = readAll(entity);
  const now = new Date().toISOString();
  const item = { ...data, id: generateId(), created_at: now, updated_at: now };
  items.push(item);
  writeAll(entity, items);
  return item;
}

export function seed() {
  // Mesas
  [
    { number: 1, type: 'mesa', capacity: 4, status: 'livre', active: true },
    { number: 2, type: 'mesa', capacity: 4, status: 'livre', active: true },
    { number: 3, type: 'mesa', capacity: 6, status: 'livre', active: true },
    { number: 4, type: 'mesa', capacity: 6, status: 'livre', active: true },
    { number: 5, type: 'mesa', capacity: 2, status: 'livre', active: true },
    { number: 6, type: 'mesa', capacity: 8, status: 'livre', active: true },
    { number: 7, type: 'mesa', capacity: 4, status: 'livre', active: true },
    { number: 8, type: 'mesa', capacity: 4, status: 'livre', active: true },
    { number: 1, type: 'balcao', capacity: 6, status: 'livre', active: true },
    { number: 1, type: 'delivery', capacity: 1, status: 'livre', active: true },
  ].forEach(t => create('tables', t));

  // Produtos
  const products = [
    { name: 'Cerveja Lata 350ml',     category: 'cervejas',       price: 8.00,  available: true, print_dept: 'bar',     code: 'CL350' },
    { name: 'Cerveja Long Neck',       category: 'cervejas',       price: 12.00, available: true, print_dept: 'bar',     code: 'CLN'   },
    { name: 'Cerveja Garrafa 600ml',   category: 'cervejas',       price: 18.00, available: true, print_dept: 'bar',     code: 'CG600' },
    { name: 'Whisky Dose',             category: 'destilados',     price: 22.00, available: true, print_dept: 'bar',     code: 'WD'   },
    { name: 'Caipirinha',              category: 'drinks',         price: 20.00, available: true, print_dept: 'bar',     code: 'CAI'  },
    { name: 'Água Mineral',            category: 'nao_alcoolicos', price: 5.00,  available: true, print_dept: 'bar',     code: 'AGM'  },
    { name: 'Refrigerante Lata',       category: 'nao_alcoolicos', price: 7.00,  available: true, print_dept: 'bar',     code: 'REF'  },
    { name: 'Suco Natural',            category: 'nao_alcoolicos', price: 12.00, available: true, print_dept: 'bar',     code: 'SUC'  },
    { name: 'Porção de Batata Frita',  category: 'porcoes',        price: 30.00, available: true, print_dept: 'cozinha', code: 'PBF'  },
    { name: 'Porção de Frango',        category: 'porcoes',        price: 45.00, available: true, print_dept: 'cozinha', code: 'PFG'  },
    { name: 'Bolinho de Bacalhau 6un', category: 'petiscos',       price: 28.00, available: true, print_dept: 'cozinha', code: 'BB6'  },
    { name: 'Tábua de Frios',          category: 'petiscos',       price: 55.00, available: true, print_dept: 'cozinha', code: 'TF'   },
    { name: 'Frango Grelhado',         category: 'pratos',         price: 38.00, available: true, print_dept: 'cozinha', code: 'FGR'  },
    { name: 'Picanha na Chapa',        category: 'pratos',         price: 65.00, available: true, print_dept: 'cozinha', code: 'PIC'  },
    { name: 'Pudim',                   category: 'sobremesas',     price: 15.00, available: true, print_dept: 'cozinha', code: 'PUD'  },
  ];
  products.forEach(p => create('products', p));

  // Garçons
  create('waiters', { name: 'João', nickname: 'João', pin: '1234', active: true });
  create('waiters', { name: 'Maria', nickname: 'Maria', pin: '5678', active: true });

  // Estoque (50 un de cada produto)
  readAll('products').forEach(p => {
    create('stock', { product_id: p.id, product_name: p.name, quantity: 50, unit: 'un', min_quantity: 5 });
  });

  // Caixa de exemplo (ontem — para o histórico)
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  create('cashiers', {
    status: 'fechado', turno: 'noite', operador: 'Admin',
    saldo_inicial: 150.00, aberto_em: yesterday,
    fechado_em: new Date(Date.now() - 3600000).toISOString(),
    movimentacoes: [{ id: '1', tipo: 'sangria', valor: 50, motivo: 'Troco', hora: yesterday, operador: 'Admin' }],
    linked_order_ids: [],
    resumo_pagamentos: { dinheiro: 320, pix: 180, cartao_credito: 95, cartao_debito: 60, misto: 0 },
    total_comandas: 8, total_itens: 34,
    saldo_esperado: 420.00, saldo_real: 415.00, diferenca: -5.00,
  });

  // Configurações padrão
  create('settings', {
    service_fee_percent: 10,
    happy_hour_enabled: false,
    happy_hour_discount: 20,
    happy_hour_start: '17:00',
    happy_hour_end: '19:00',
    cashier_blocks_orders: false,
  });

  console.log('✅ Dados iniciais criados com sucesso!');
}
