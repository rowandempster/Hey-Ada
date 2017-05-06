var mongoose = require('mongoose');
var Supporter = new mongoose.Schema({
  id: String,
  availability: Boolean
});
module.exports = mongoose.model('Supporter', Supporter);
