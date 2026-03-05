import { db } from '../data/setup.js';
export function loadDatabase() {
    return async (context, next) => {
        context.db = db;
        return next();
    };
}
