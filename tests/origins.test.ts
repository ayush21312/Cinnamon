import { expect, it } from 'vitest';
import { gameOrigins } from '../server/origins';

it('allows the deployed website even when dashboard configuration is stale', () => {
  expect(gameOrigins('https://old-example.vercel.app')).toContain(
    'https://cinnamon-five.vercel.app',
  );
  expect(gameOrigins()).toContain('http://localhost:3000');
  expect(gameOrigins()).not.toContain('https://unrelated.example');
  expect(gameOrigins()).not.toContain('*');
});

it('normalizes trailing slashes, whitespace, and duplicates without widening origins', () => {
  expect(gameOrigins(' https://cinnamon-five.vercel.app/ , https://second.example/ ')).toEqual([
    'https://cinnamon-five.vercel.app',
    'https://second.example',
  ]);
});
