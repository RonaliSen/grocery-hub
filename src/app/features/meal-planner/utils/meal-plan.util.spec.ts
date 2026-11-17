import { describe, expect, it } from 'vitest';

import { plannedMeal } from '../../../../testing/in-memory-meal-plan-repository';
import { MEAL_NAME_MAX_LENGTH } from '../models/planned-meal.model';
import {
  EMPTY_DAY_PLAN,
  groupMealsByDate,
  isMealIngredient,
  normalizeIngredientName,
  normalizeMealName,
  parseIngredientAmount,
  summarizeDayPlan,
  toPlannedMeal
} from './meal-plan.util';

describe('meal plan utils', () => {
  describe('normalizeMealName', () => {
    it('trims and collapses whitespace', () => {
      expect(normalizeMealName('  Black \t  coffee \n')).toBe('Black coffee');
    });

    it('returns an empty string for blank input', () => {
      expect(normalizeMealName('   ')).toBe('');
    });

    it('caps the length', () => {
      expect(normalizeMealName('a'.repeat(MEAL_NAME_MAX_LENGTH + 20))).toHaveLength(MEAL_NAME_MAX_LENGTH);
    });
  });

  describe('toPlannedMeal', () => {
    const flour = { id: 'i-1', name: 'Flour', quantity: 500, unit: 'g' };
    const valid = plannedMeal({ date: '2026-11-16', slot: 'lunch', name: 'Soup', ingredients: [flour as never] });

    it('accepts a well-formed meal', () => {
      expect(toPlannedMeal(valid)).toEqual(valid);
    });

    it('gives meals saved before ingredients existed an empty list', () => {
      const { ingredients: _ingredients, ...legacy } = valid;

      expect(toPlannedMeal(legacy)).toEqual({ ...legacy, ingredients: [] });
    });

    it('treats a non-list ingredients value as none', () => {
      expect(toPlannedMeal({ ...valid, ingredients: 'flour' })?.ingredients).toEqual([]);
    });

    it('drops malformed ingredients but keeps the meal and the good ones', () => {
      const meal = toPlannedMeal({
        ...valid,
        ingredients: [flour, { ...flour, id: 'i-2', quantity: 0 }, null, { ...flour, id: 'i-3', unit: 'tbsp' }]
      });

      expect(meal?.ingredients).toEqual([flour]);
    });

    it.each([
      ['null', null],
      ['a string', 'Soup'],
      ['a missing id', { ...valid, id: '' }],
      ['an invalid date', { ...valid, date: '2026-02-30' }],
      ['an unknown slot', { ...valid, slot: 'brunch' }],
      ['a blank name', { ...valid, name: '  ' }],
      ['a missing name', { ...valid, name: undefined }],
      ['a missing createdAt', { ...valid, createdAt: undefined }]
    ])('rejects %s', (_label, value) => {
      expect(toPlannedMeal(value)).toBeNull();
    });
  });

  describe('isMealIngredient', () => {
    const flour = { id: 'i-1', name: 'Flour', quantity: 0.5, unit: 'kg' };

    it('accepts a well-formed ingredient', () => {
      expect(isMealIngredient(flour)).toBe(true);
    });

    it.each([
      ['null', null],
      ['a missing id', { ...flour, id: '' }],
      ['a blank name', { ...flour, name: ' ' }],
      ['a zero amount', { ...flour, quantity: 0 }],
      ['a negative amount', { ...flour, quantity: -1 }],
      ['a non-number amount', { ...flour, quantity: '2' }],
      ['an infinite amount', { ...flour, quantity: Infinity }],
      ['an unknown unit', { ...flour, unit: 'cup' }]
    ])('rejects %s', (_label, value) => {
      expect(isMealIngredient(value)).toBe(false);
    });
  });

  describe('normalizeIngredientName', () => {
    it('trims, collapses whitespace and caps at 60 characters', () => {
      expect(normalizeIngredientName('  Red   onion ')).toBe('Red onion');
      expect(normalizeIngredientName('x'.repeat(100))).toHaveLength(60);
    });
  });

  describe('parseIngredientAmount', () => {
    it.each([
      ['2', 2],
      ['1.5', 1.5],
      ['1,5', 1.5],
      ['.5', 0.5],
      [' 250 ', 250],
      ['0.1234', 0.123],
      ['100000', 100000]
    ])('reads "%s" as %d', (raw, value) => {
      expect(parseIngredientAmount(raw)).toEqual({ status: 'valid', value });
    });

    it.each(['', '   ', null, undefined])('treats %j as empty', (raw) => {
      expect(parseIngredientAmount(raw)).toEqual({ status: 'empty' });
    });

    it.each([
      ['0', 'Enter an amount above 0.'],
      ['0.0001', 'Enter an amount above 0.'],
      ['-2', 'Enter a number, like 2 or 1.5.'],
      ['abc', 'Enter a number, like 2 or 1.5.'],
      ['2kg', 'Enter a number, like 2 or 1.5.'],
      ['1e3', 'Enter a number, like 2 or 1.5.'],
      ['100001', 'That amount is too large.']
    ])('rejects "%s"', (raw, message) => {
      expect(parseIngredientAmount(raw)).toEqual({ status: 'invalid', message });
    });
  });

  describe('groupMealsByDate', () => {
    it('groups by day and slot, keeping order within a slot', () => {
      const grouped = groupMealsByDate([
        plannedMeal({ date: '2026-11-16', slot: 'breakfast', name: 'Porridge' }),
        plannedMeal({ date: '2026-11-17', slot: 'dinner', name: 'Curry' }),
        plannedMeal({ date: '2026-11-16', slot: 'breakfast', name: 'Coffee' }),
        plannedMeal({ date: '2026-11-16', slot: 'dinner', name: 'Pasta' })
      ]);

      const monday = grouped.get('2026-11-16')!;
      expect(monday.breakfast.map((meal) => meal.name)).toEqual(['Porridge', 'Coffee']);
      expect(monday.lunch).toEqual([]);
      expect(monday.dinner.map((meal) => meal.name)).toEqual(['Pasta']);
      expect(grouped.get('2026-11-17')!.dinner.map((meal) => meal.name)).toEqual(['Curry']);
      expect(grouped.has('2026-11-18')).toBe(false);
    });
  });

  describe('summarizeDayPlan', () => {
    it('summarises an empty day', () => {
      expect(summarizeDayPlan(EMPTY_DAY_PLAN)).toEqual({
        mealCount: 0,
        plannedSlots: [],
        mealNames: [],
        mealNamesBySlot: { breakfast: [], lunch: [], dinner: [] }
      });
    });

    it('lists planned slots and names in breakfast, lunch, dinner order', () => {
      const plan = groupMealsByDate([
        plannedMeal({ date: '2026-11-16', slot: 'dinner', name: 'Curry' }),
        plannedMeal({ date: '2026-11-16', slot: 'breakfast', name: 'Porridge' }),
        plannedMeal({ date: '2026-11-16', slot: 'breakfast', name: 'Coffee' })
      ]).get('2026-11-16')!;

      expect(summarizeDayPlan(plan)).toEqual({
        mealCount: 3,
        plannedSlots: ['breakfast', 'dinner'],
        mealNames: ['Porridge', 'Coffee', 'Curry'],
        mealNamesBySlot: { breakfast: ['Porridge', 'Coffee'], lunch: [], dinner: ['Curry'] }
      });
    });
  });
});
