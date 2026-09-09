const { CUSTOMERS_URL, SHOPPING_URL } = require('./config');
const { BadGatewayError, UnauthorizedError } = require('./utils/app-errors');

const TIMEOUT_MS = 5000;

async function callService(url, authorization) {
    try {
        const response = await fetch(url, {
            headers: authorization ? { authorization } : {},
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        const data = await response.json().catch(() => null);
        return { ok: response.ok, status: response.status, data };
    } catch (err) {
        return { ok: false, status: 0, data: null, error: err.message };
    }
}

async function composeProfile(req, res, next) {
    const authorization = req.headers.authorization;

    if (!authorization) {
        return next(new UnauthorizedError('Missing authorization token'));
    }

    try {
        const warnings = [];

        const [profile, orders] = await Promise.all([
            callService(`${CUSTOMERS_URL}/customer/profile`, authorization),
            callService(`${SHOPPING_URL}/shopping/orders`, authorization),
        ]);

        if (profile.status === 401) {
            return next(new UnauthorizedError('Invalid or expired token'));
        }

        if (!profile.ok) {
            return next(new BadGatewayError('El microservicio "customers" no esta disponible'));
        }

        let orderList = [];
        if (orders.ok && Array.isArray(orders.data)) {
            orderList = orders.data;
        } else {
            warnings.push('No se pudieron obtener las ordenes: el microservicio "shopping" no respondio');
        }

        const enrichedOrders = orderList;
        const hasOrderItems = enrichedOrders.some((order) => (order.items || []).length);
        const productsAvailable = !hasOrderItems || enrichedOrders.some((order) =>
            order.items.some((item) => item.currentProduct),
        );
        if (!productsAvailable) warnings.push('No se pudieron enriquecer las ordenes con el catalogo actual');

        return res.json({
            customer: {
                _id: profile.data._id,
                email: profile.data.email,
                phone: profile.data.phone,
                address: profile.data.address || [],
                cart: profile.data.cart || [],
                wishlist: profile.data.wishlist || [],
            },
            orders: enrichedOrders,
            totals: {
                orders: enrichedOrders.length,
                spent: enrichedOrders.reduce((sum, order) => sum + (order.amount || 0), 0),
            },
            sources: {
                customers: profile.ok,
                shopping: orders.ok,
                products: productsAvailable,
            },
            ...(warnings.length ? { warnings } : {}),
        });
    } catch (err) {
        return next(err);
    }
}

module.exports = { composeProfile, callService };
