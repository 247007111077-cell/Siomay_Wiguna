import fs from 'fs';
import path from 'path';
import type { AppState } from '../src/types/inventory.ts';
import {
  createDefaultIngredients,
  generateDummySales,
  generateInitialSupplierDeliveries,
} from './engine.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'state.json');

export function createInitialState(): AppState {
  const initialDate = '2026-11-22';
  const ingredients = createDefaultIngredients(initialDate);
  return {
    config: {
      zScore: 1.65,
      orderingCost: 15000,
      holdingCostRate: 0.2,
      scenario: 'normal',
      currentDate: initialDate,
      dayCounter: 1,
    },
    ingredients,
    sales: generateDummySales(initialDate, 120, 202611),
    drafts: [],
    incomingOrders: [],
    riskFlags: [],
    agentRuns: [],
    wasteLogs: [],
    supplierDeliveries: generateInitialSupplierDeliveries(initialDate, ingredients),
  };
}

export function loadState(): AppState {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, 'utf8');
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.config && Array.isArray(parsed.ingredients)) {
        if (!Array.isArray(parsed.supplierDeliveries) || parsed.supplierDeliveries.length === 0) {
          parsed.supplierDeliveries = generateInitialSupplierDeliveries(
            parsed.config.currentDate,
            parsed.ingredients
          );
          saveState(parsed);
        }
        return parsed;
      }
    }
  } catch (err) {
    console.error('Gagal membaca state.json, menggunakan state awal:', err);
  }

  const initial = createInitialState();
  saveState(initial);
  return initial;
}

export function saveState(state: AppState): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  const tmpFile = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf8');
  fs.renameSync(tmpFile, STATE_FILE);
}

export function resetStateToDefault(): AppState {
  const fresh = createInitialState();
  saveState(fresh);
  return fresh;
}
