var mongoose = require('mongoose');
var GroupMember = new mongoose.Schema({
  id: String,
  is_requester: Boolean
});
module.exports = mongoose.model('GroupMember', GroupMember);
