const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    product:String,
    price: String,  
    category: String,
    userId: String,
    company: String,
    image: String
});

module.exports = mongoose.model("productss", productSchema);