/* eslint-disable @typescript-eslint/naming-convention */

exports.shorthands = undefined;

/**
 * @param {import("node-pg-migrate").MigrationBuilder} pgm
 */
exports.up = (pgm) => {
    pgm.addColumn('user_profiles', {
        preferred_theme: {
            type: 'varchar(10)', // e.g., 'light', 'dark', 'system'
            notNull: false,     // Allow null initially or have a default?
            // default: 'system' // Optional: Set a default value
        }
    });
};

/**
 * @param {import("node-pg-migrate").MigrationBuilder} pgm
 */
exports.down = (pgm) => {
    pgm.dropColumn('user_profiles', 'preferred_theme');
}; 