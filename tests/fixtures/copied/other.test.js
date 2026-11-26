// Fixture for no-copied-helper and no-same-name-helper. The rule tests lint code that claims to sit next to this file.
export function signIn(page) {
    return page.goto('/login');
}

function openCart(page) {
    return page.goto('/cart');
}

const GREETING = 'hello there';
