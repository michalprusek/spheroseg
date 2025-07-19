"use strict";
/**
 * Shared image utilities
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SUPPORTED_IMAGE_EXTENSIONS = exports.IMAGE_FORMATS = void 0;
exports.isImageFormatSupported = isImageFormatSupported;
exports.getImageExtension = getImageExtension;
exports.isImage = isImage;
exports.IMAGE_FORMATS = {
    PNG: 'png',
    JPEG: 'jpeg',
    JPG: 'jpg',
    TIFF: 'tiff',
    TIF: 'tif',
    BMP: 'bmp',
};
exports.SUPPORTED_IMAGE_EXTENSIONS = Object.values(exports.IMAGE_FORMATS);
function isImageFormatSupported(extension) {
    return exports.SUPPORTED_IMAGE_EXTENSIONS.includes(extension.toLowerCase());
}
function getImageExtension(filename) {
    const parts = filename.split('.');
    return parts[parts.length - 1]?.toLowerCase() || '';
}
function isImage(filename) {
    const ext = getImageExtension(filename);
    return isImageFormatSupported(ext);
}
const imageUtils = {
    getImagePath: (imagePath) => {
        return imagePath;
    },
    getImageDimensions: (width, height) => {
        return { width, height };
    },
    isImageFormatSupported,
    getImageExtension,
    isImage,
};
exports.default = imageUtils;
//# sourceMappingURL=imageUtils.js.map