var mongoose = require('mongoose');
var Supporter = new mongoose.Schema({
  name: String,

});
module.exports = mongoose.model('Offering', OfferingSchema);
