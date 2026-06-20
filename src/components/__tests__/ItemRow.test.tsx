import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ItemRow from '../ItemRow';
import { Item } from '../../types';

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    barcode: '012345',
    name: 'Widget',
    description: '',
    quantity: 5,
    scannedCount: 0,
    done: false,
    ...overrides,
  };
}

describe('ItemRow', () => {
  it('renders the description when present', async () => {
    await render(<ItemRow item={makeItem({ description: 'A small widget' })} />);

    expect(screen.getByText('A small widget')).toBeTruthy();
  });

  it('omits the description text when empty', async () => {
    await render(<ItemRow item={makeItem({ description: '' })} />);

    expect(screen.queryByText('A small widget')).toBeNull();
  });
});
