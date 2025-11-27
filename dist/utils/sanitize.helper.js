import xss from "xss";
/**
 * Recursively sanitizes all string fields in an object or array.
 * Protects against XSS attacks by cleaning every string value.
 */
export const deepSanitize = (data) => {
    if (typeof data === "string") {
        return xss(data);
    }
    if (Array.isArray(data)) {
        return data.map(deepSanitize);
    }
    if (data && typeof data === "object") {
        return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, deepSanitize(value)]));
    }
    return data;
};
