import { articleDisplayName } from '../../types';
import type { ClothingArticle } from '../../types';

const article = (over: Partial<ClothingArticle>): ClothingArticle =>
  ({ _id: 'a1', clothingType: 'Shirt', ...over }) as ClothingArticle;

describe('articleDisplayName', () => {
  it('uses the user-entered name whenever there is one', () => {
    expect(articleDisplayName(article({ name: 'Dad\'s Peacoat', color: 'Navy' })))
      .toBe('Dad\'s Peacoat');
  });

  it('qualifies the type with the color when unnamed', () => {
    expect(articleDisplayName(article({ color: 'Sky Blue' }))).toBe('Sky Blue Shirt');
  });

  it('falls back to the bare type when there is no color', () => {
    expect(articleDisplayName(article({}))).toBe('Shirt');
  });

  it('treats a whitespace-only name as unnamed', () => {
    expect(articleDisplayName(article({ name: '   ', color: 'Olive' }))).toBe('Olive Shirt');
  });

  it('does not prefix "Multi" — that is the picker\'s no-single-color option', () => {
    expect(articleDisplayName(article({ color: 'Multi' }))).toBe('Shirt');
  });

  it('returns a safe label for a missing article', () => {
    expect(articleDisplayName(undefined)).toBe('Item');
  });
});
