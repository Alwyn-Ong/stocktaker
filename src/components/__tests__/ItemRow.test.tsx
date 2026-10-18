import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ItemRow from '../ItemRow';
import { Item } from '../../types';

function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    barcode: '012345',
    name: 'Widget',
    description: '',
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

  it('shows where the item currently is when it has moved away', async () => {
    await render(
      <ItemRow item={makeItem()} mismatch={{ type: 'currently-in', locationName: 'Warehouse B' }} />
    );

    expect(screen.getByText('⚠ Currently in: Warehouse B')).toBeTruthy();
  });

  it('shows where the item belongs when it is here from another location', async () => {
    await render(
      <ItemRow item={makeItem()} mismatch={{ type: 'belongs-in', locationName: 'Warehouse B' }} />
    );

    expect(screen.getByText('⚠ Belongs in: Warehouse B')).toBeTruthy();
  });

  it('renders no mismatch badge when the item is where it belongs', async () => {
    await render(<ItemRow item={makeItem()} />);

    expect(screen.queryByText(/⚠/)).toBeNull();
  });
});
