const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LicenseSchema = new Schema({
    stripe_customer_id: {
        type: String,
        required: false
    },
    discordID: {
        type: String,
        required: false
    },
    email: {
        type: String,
        required: false
    },
    is_active: {
        type: Boolean,
        required: false
    },
    disclaimer_agreed: {
        type: Boolean,
        required: false
    }
});

module.exports = License = mongoose.model('License', LicenseSchema);