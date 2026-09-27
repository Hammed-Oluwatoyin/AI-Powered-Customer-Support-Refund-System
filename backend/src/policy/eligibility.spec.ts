import { refundableItems } from './eligibility.js';

describe('refundableItems', () => {
  it('excludes refunded and final-sale items (P4, P2)', () => {
    const items = [
      { id: 'a', refunded: false, isFinalSale: false },
      { id: 'b', refunded: true, isFinalSale: false },
      { id: 'c', refunded: false, isFinalSale: true },
      { id: 'd', refunded: true, isFinalSale: true },
    ];

    expect(refundableItems(items).map((i) => i.id)).toEqual(['a']);
  });
});
