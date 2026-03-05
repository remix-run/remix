export function isCart(value) {
    return (typeof value === 'object' && value !== null && 'items' in value && Array.isArray(value.items));
}
export function getCart(value) {
    return isCart(value) ? value : { items: [] };
}
export function addToCart(cart, bookId, slug, title, price, quantity = 1) {
    let existingItem = cart.items.find((item) => item.bookId === bookId);
    if (existingItem) {
        existingItem.quantity += quantity;
    }
    else {
        cart.items.push({ bookId, slug, title, price, quantity });
    }
    return cart;
}
export function updateCartItem(cart, bookId, quantity) {
    let item = cart.items.find((item) => item.bookId === bookId);
    if (!item)
        return undefined;
    if (quantity <= 0) {
        cart.items = cart.items.filter((item) => item.bookId !== bookId);
    }
    else {
        item.quantity = quantity;
    }
    return cart;
}
export function removeFromCart(cart, bookId) {
    cart.items = cart.items.filter((item) => item.bookId !== bookId);
    return cart;
}
export function clearCart(cart) {
    return { items: [] };
}
export function getCartTotal(cart) {
    return cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}
