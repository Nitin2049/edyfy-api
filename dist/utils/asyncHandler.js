/**
 * Wraps async route handlers and passes errors to next() automatically
 * So you don’t need try/catch in every controller 🚀
 */
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
