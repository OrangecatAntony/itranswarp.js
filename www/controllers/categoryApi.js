'use strict';

/**
 * Category API.
 * 
 * author: Michael Liao
 */
const
    _ = require('lodash'),
    api = require('../api'),
    db = require('../db'),
    cache = require('../cache'),
    logger = require('../logger'),
    constants = require('../constants'),
    CACHE_KEY = constants.cache.CATEGORIES,
    User = db.User,
    Article = db.Article,
    Category = db.Category,
    Text = db.Text,
    nextId = db.nextId;

async function _clearCach() {
    await cache.remove(CACHE_KEY);
}

async function _loadCategories() {
    return await Category.findAll({
        order: 'display_order'
    });
}

async function getCategories(fromCache=true) {
    if (fromCache) {
        return await cache.get(CACHE_KEY, _loadCategories);
    }
    return await _loadCategories();
}
//得到所有的导航大类
async function getNavCategories(fromCache=true) {
    let
    categories = await getCategories(fromCache),
    filtered = categories.filter((cat) => {
        return cat.parent == '';
    });
    return filtered;
}
//得到所有的小导航
async function getSubNavCategories(fromCache=true) {
    let
        categories = await getCategories(fromCache),
        filtered = categories.filter((cat) => {
            return cat.parent != '';
        });
    return filtered;
}

async function getCategory(id, fromCache=true) {
    let
        categories = await getCategories(fromCache),
        filtered = categories.filter((cat) => {
            return cat.id === id;
        });
    if (filtered.length === 0) {
        throw api.notFound('Category');
    }
    return filtered[0];
}
async function getSubCategories(id, fromCache=true) {
    let
        categories = await getCategories(fromCache),
        filtered = categories.filter((cat) => {
            return cat.parent === id;
        });
    if (filtered.length === 0) {
        throw api.notFound('Category');
    }
    return filtered;
}
async function getBigCategories(fromCache=true) {
    let
        categories = await getCategories(fromCache),
        filtered = categories.filter((cat) => {
            return cat.parent == '';
        });
    return filtered;
}

module.exports = {

    getNavigationMenus: async () => {
        let categories = await getCategories();
        return categories.map((cat) => {
            return {
                name: cat.name,
                url: '/category/' + cat.id
            };
        });
    },

    getCategories: getCategories,

    getCategory: getCategory,
    //api是数据的意思
    'GET /api/navlist': async (ctx, next) => {//GET后有空格
        /** 
         * get all navagations
         * @cats get big categories
         * @subcat get small categories
        */
        let categories = await getNavCategories();
        let subcategories = await getSubNavCategories();
        let listobj = [];
        

        for(let i = 0;i < categories.length; i++){
            let cat_obj = {};
            cat_obj.catname = categories[i].name;
            let subcat_list = [];
            let subcat_obj = {};
            for(let j = 0;j < subcategories.length; j++){
                if(subcategories[j].parent == categories[i].id){
                    subcat_obj.subname = subcategories[j].name;
                    subcat_obj.subid = subcategories[j].id;
                    subcat_list.push(subcat_obj);
                }
            }
           
            cat_obj.subcats = subcat_list;
        
            listobj.push(cat_obj);
            
        }
        
        ctx.rest(
            listobj        
        );
    },
    'GET /api/subcategories/:id': async (ctx, next) => {
        /**
         * Get subcategories by id.
         * 
         */
        let id = ctx.params.id;
        let subcategories = await getSubCategories(id);
        ctx.rest(
            subcategories
        );
    },

    'GET /api/categories': async (ctx, next) => {
        /**
         * Get all big categories.
         * 
         * @name Get Categories
         * @return {object} Result as {"categories": [{category1}, {category2}...]}
         */
        ctx.rest({
            categories: await getBigCategories()
        });
    },

    'GET /api/categories/:id': async (ctx, next) => {
        /**
         * Get categories by id.
         * 
         * @name Get Category
         * @param {string} id: The id of the category.
         * @return {object} Category object.
         */
        let id = ctx.params.id;
        //ctx.rest({await getCategory(id)});
        let category = await getCategory(id);
        let subcategories = await getSubCategories(id);
        let  subname = '';
        for(let i = 0; i < subcategories.length;i++){
             subname += subcategories[i].name + ';';
        }
        if(subname != ''){
         subname = subname.slice(0,subname.length-1);
        }

        ctx.rest({
            big_category: category.name,
            small_category: subname,
            description: category.description
        });
    },

    'POST /api/categories': async (ctx, next) => { //处理前端save请求
        /**
         * Create a new category.
         * 
         * @name Create Category
         * @param {string} name - The name of the category.
         * @param {string,optional} description - The description of the category.
         * @return {object} Category object that was created.
         */
        ctx.checkPermission(constants.role.ADMIN);
        ctx.validate('createCategory');
        let
            data = ctx.request.body,
            num = await Category.max('display_order'),
            cat = await Category.create({
                name: data.big_category.trim(),
                description: data.description.trim(),
                display_order: isNaN(num) ? 0 : num + 1
            });
        let small_category = data.small_category.split(";");    
        for(let i = 0; i < small_category.length;i++){
            let subcat = await Category.create({
                name: small_category[i].trim(),
                parent:cat.id
            });
        }
        
        await _clearCach();
        ctx.rest(cat);

    },

    'POST /api/categories/all/sort': async (ctx, next) => {
        /**
         * Sort categories.
         * 
         * @name Sort Categories
         * @param {array} id: The ids of categories.
         * @return {object} The sort result like { "sort": true }.
         */
        ctx.checkPermission(constants.role.ADMIN);
        ctx.validate('sortCategories');
        let
            cat,
            data = ctx.request.body,
            ids = data.ids,
            categories = await getCategories(false);
        if (ids.length !== categories.length) {
            throw api.invalidParam('ids', 'invalid id list');
        }
        categories.forEach((cat) => {
            let newIndex = ids.indexOf(cat.id);
            if (newIndex === (-1)) {
                throw api.invalidParam('ids', 'invalid id list');
            }
            cat.display_order = newIndex;
        });
        for (cat of categories) {
            await cat.save();
        }
        await _clearCach();
        ctx.rest({
            ids: ids
        });
    },

    'POST /api/categories/:id': async (ctx, next) => {
        /**
         * Update a category.
         * 
         * @name Update Category
         * @param {string} id - The id of the category.
         * @param {string} [name] - The new name of the category.
         * @param {string} [description] - The new description of the category.
         * @return {object} Category object that was updated.
         */
        ctx.checkPermission(constants.role.ADMIN);
        ctx.validate('updateCategory');
        let
            id = ctx.params.id,
            cat = await getCategory(id, false),
            subcat = await getSubCategories(id, false),
            data = ctx.request.body;
        if (data.big_category) {
            cat.name = data.big_category.trim();
            cat.description = data.description.trim();
        }
        let small_category = data.small_category.split(";");
        console.log("small_category"+small_category );
        console.log("subcat"+subcat );
        //添加新的字标签
        for(let i = 0; i < small_category.length; i++){
            let tempsub = "";
            if (small_category[i]) {
                for(let j = 0; j < subcat.length; j++){
                     if(small_category[i] == subcat[j].name){
                        tempsub = small_category[i];
                     }
                }
                if(tempsub == ''){
                    let newsub = await Category.create({
                        name: small_category[i].trim(),
                        parent:cat.id
                    });
                }
            }
        }
        //删除原来的按钮
        for(let i = 0; i < subcat.length; i++){
            let tempsub = "";
            for(let j = 0; j < small_category.length; j++){
                    if(small_category[j] == subcat[i].name){
                     tempsub = small_category[j];
                    }
            }
            if(tempsub == ''){
                 await Category.destroy({
                     where: {
                       id: subcat[i].id
                     }
                });
             }
            
        }
         
        await cat.save();
        await _clearCach();
        ctx.rest(cat);
    },

    'POST /api/categories/:id/delete': async (ctx, next) => {
        /**
         * Delete a category by its id.
         * 
         * @name Delete Category
         * @param {string} id - The id of the category.
         * @return {object} Results contains deleted id. e.g. {"id": "12345"}
         */
        ctx.checkPermission(constants.role.ADMIN);
        let
            id = ctx.params.id,
            cat = await getCategory(id),
            num = await Article.count({
                where: {
                    category_id: id
                }
            });
        if (num > 0) {
           // throw api.conflictError('Category', 'Cannot delete category for there are some articles reference it.');
        }
        await Category.destroy({
            where: {
                id: id
            }
        });
        await _clearCach();
        ctx.rest({ 'id': id });
    }
};
