/**
 * Picker palette lists. These are display-ordered (not just keys of CSS_COLORS)
 * so that color pickers can group neutrals → metallics → blues → greens etc.
 */

export const CATEGORIES = [
    'Casual',
    'Formal',
    'Business Casual',
    'Athletic',
    'Lounge',
    'Outdoor',
];

export const COLORS = [
    'Black', 'White', 'Grey', 'Brown', 'Beige', 'Cream',
    'Silver', 'Gold', 'Bronze', 'Rose Gold', 'Champagne',
    'Navy', 'Indigo', 'Cobalt', 'Blue', 'Electric Blue', 'Sky Blue',
    'Periwinkle', 'Teal', 'Cyan', 'Baby Blue',
    'Green', 'Mint', 'Lime', 'Sage', 'Olive', 'Khaki',
    'Red', 'Scarlet', 'Crimson', 'Burgundy',
    'Orange', 'Coral', 'Peach', 'Rust', 'Yellow',
    'Purple', 'Plum', 'Lilac', 'Lavender',
    'Pink', 'Rose', 'Dusty Rose', 'Blush', 'Magenta', 'Hot Pink', 'Fuchsia',
    'Multi',
];

export const FABRICS = [
    'Cotton', 'Wool', 'Linen', 'Silk', 'Polyester',
    'Denim', 'Leather', 'Synthetic', 'Other',
];

export const GENDERS = ["Men's", "Women's", 'All'] as const;
export const ARTICLE_GENDERS = ["Men's", "Women's", 'Unisex'] as const;
