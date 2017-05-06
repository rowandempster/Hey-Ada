var mongoose = require('mongoose');
var GroupMember = require('./GroupMember');
var Group = new mongoose.Schema({
  members: [GroupMember]
});
module.exports = mongoose.model('Group', Group);
