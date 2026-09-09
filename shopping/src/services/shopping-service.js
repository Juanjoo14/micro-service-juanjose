const { OrderRepository } = require('../database');
const { FormateData } = require('../utils');
const { APIError, BadRequestError } = require('../utils/app-errors');
const { GetProductsByIds, TryGetProductsByIds } = require('../clients/products-client');

class ShoppingService {
    constructor() {
        this.repository = new OrderRepository();
    }

    async CreateOrder({ userId, txnId, items }) {
        try {
            if (!userId) {
                throw new BadRequestError('User id is required');
            }

            if (!items || !Array.isArray(items) || items.length === 0) {
                throw new BadRequestError('Order items are required');
            }

            if (items.some((item) => !item?.productId || !Number.isInteger(item.quantity) || item.quantity < 1)) {
                throw new BadRequestError('Each order item needs a productId and a positive integer quantity');
            }

            const catalog = await GetProductsByIds(items.map((item) => item.productId));
            const missing = items.filter((item) => !catalog.has(String(item.productId))).map((item) => item.productId);
            if (missing.length) throw new BadRequestError(`These products are not in the catalogue: ${missing.join(', ')}`);

            const unavailable = items.filter((item) => catalog.get(String(item.productId)).available === false).map((item) => item.productId);
            if (unavailable.length) throw new BadRequestError(`These products are no longer available: ${unavailable.join(', ')}`);

            const orderItems = items.map((item) => {
                const product = catalog.get(String(item.productId));
                return { productId: String(item.productId), name: product.name, price: product.price, quantity: item.quantity };
            });
            const amount = orderItems.reduce((total, item) => total + item.price * item.quantity, 0);
            const order = {
                userId,
                txnId,
                amount,
                status: 'received',
                items: orderItems,
                date: new Date(),
            };

            const createdOrder = await this.repository.CreateOrder(order);
            return FormateData(createdOrder);
        } catch (err) {
            if (err instanceof APIError) throw err;
            throw new APIError('CreateOrderError', 500, err.message);
        }
    }

    async GetOrdersByUser(userId) {
        try {
            const orders = await this.repository.FindByUserId(userId);
            const ids = orders.flatMap((order) => order.items.map((item) => item.productId));
            const catalog = await TryGetProductsByIds(ids);
            const enriched = orders.map((order) => {
                const plain = typeof order.toObject === 'function' ? order.toObject() : order;
                return { ...plain, items: plain.items.map((item) => {
                    const currentProduct = catalog.get(String(item.productId));
                    return {
                        ...item,
                        currentProduct: currentProduct ? { name: currentProduct.name, price: currentProduct.price, available: currentProduct.available, banner: currentProduct.banner } : null,
                        priceChanged: currentProduct ? currentProduct.price !== item.price : null,
                    };
                }) };
            });
            return FormateData(enriched);
        } catch (err) {
            if (err instanceof APIError) throw err;
            throw new APIError('GetOrdersByUserError', 500, err.message);
        }
    }
}

module.exports = ShoppingService;
