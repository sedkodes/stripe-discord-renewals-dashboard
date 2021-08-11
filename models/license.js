const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const LicenseSchema = new Schema({
    stripe_customer_id: {
        type: String,
        required: true
    },
    discordID: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true
    },
    is_active: {
        type: Boolean,
        required: true
    },
    disclaimer_agreed: {
        type: Boolean,
        required: true
    }
});

module.exports = License = mongoose.model('License', LicenseSchema);