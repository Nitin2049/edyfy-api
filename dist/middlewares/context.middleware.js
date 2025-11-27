export const contextMiddleware = (req, res, next) => {
    const user = req.user || {};
    req.context = req.context || {};
    req.context.userId = user.id || user._id || req.context.userId;
    req.context.schoolId = user.schoolId || req.context.schoolId;
    req.context.ip = req.ip;
    next();
};
