const config = require('../config');
const { ServiceUnavailableError } = require('../utils/app-errors');

const GetProduct = async (id) => {
    try {
        const response = await fetch(`${config.PRODUCTS_URL}/products/${encodeURIComponent(id)}`, {
            signal: AbortSignal.timeout(5000),
        });

        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Products responded with ${response.status}`);

        const body = await response.json();
        return body.data;
    } catch (error) {
        if (error instanceof ServiceUnavailableError) throw error;
        throw new ServiceUnavailableError('Products service is unavailable');
    }
};

const GetProductsByIds = async (ids) => {
    const uniqueIds = [...new Set(ids)];
    const products = await Promise.all(uniqueIds.map((id) => GetProduct(id)));
    return new Map(products.filter(Boolean).map((product) => [String(product._id), product]));
};

const TryGetProductsByIds = async (ids) => {
    try {
        return await GetProductsByIds(ids);
    } catch (error) {
        console.warn('Products enrichment unavailable:', error.message);
        return new Map();
    }
};

module.exports = { GetProduct, GetProductsByIds, TryGetProductsByIds };
