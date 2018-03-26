'use strict';

// category.js

const dbtypes = require('../dbtypes');

module.exports = {
    name: 'Category',
    table: 'categories',
    fields: {
        name: {
            type: dbtypes.STRING(100)
        },
        parent: {
            type: dbtypes.ID,
            defaultValue: () => ''
        },
        display_order: {
            type: dbtypes.BIGINT,
            defaultValue: () => '-1'
        },
        description: {
            type: dbtypes.STRING(1000),
            defaultValue: () => ''
        }
    }
};
