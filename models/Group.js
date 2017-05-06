var mongoose = require('mongoose');
var GroupMember = require('./GroupMember');
var Group = new mongoose.Schema({
  members: Array
});
module.exports = mongoose.model('Group', Group);
