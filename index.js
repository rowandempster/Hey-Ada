'use strict'

const express = require('express')
const bodyParser = require('body-parser')
const request = require('request')
const app = express()
const util = require('util')
const testcode = "12345678"
// Load mongoose package
var mongoose = require('mongoose');
var Supporter = require('./models/Supporter.js');
var GroupMember = require('./models/GroupMember.js');
var Group = require('./models/Group.js');
// Connect to MongoDB and create/use database called todoAppTest
mongoose.connect('mongodb://admin:admin@ds133221.mlab.com:33221/ada_db');

const names = ["Ali", "Shea", "Kasey", "Jesse"];

app.set('port', (process.env.PORT || 5000))

// Process application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({extended: false}))

// Process application/json
app.use(bodyParser.json())

// Index route
app.get('/', function (req, res) {
  res.send('Hello world, I am a chat bot')
})

// for Facebook verification
app.get('/webhook/', function (req, res) {
  if (req.query['hub.verify_token'] === 'my_voice_is_my_password_verify_me') {
    res.send(req.query['hub.challenge'])
  }
  res.send('Error, wrong token')
})

// Spin up the server
app.listen(app.get('port'), function() {
  console.log('running on port', app.get('port'))
})

app.post('/webhook/', function (req, res) {
  checkPayloads(req);
  let messaging_events = req.body.entry[0].messaging
  for (let i = 0; i < messaging_events.length; i++) {
    let event = req.body.entry[0].messaging[i]
    let sender = event.sender.id
    if (event.message && event.message.text) {
      let text = event.message.text
      console.log("GOT MESSAGE FROM SENDER: " + sender + " WITH TEXT: " + text);
      var formattedLeave = text.trim().toLowerCase();
      if (text === testcode) {
        sendTextMessage(sender, "Thank you for offering support, you will receive a notification when you need help.");
        addToSupports(sender);
        res.sendStatus(200);
        return;
      }
      else if(formattedLeave === "leave"){
        var callbackqueryresult = function (err, result) {
          if(err || result == null || result.length < 1){
          }
          else{
            sendOptionMessage(sender, ["Leave"], "Are you sure you want to leave?");
          }
        }
        Group.find({ "members": { $elemMatch: {"id" : sender}} }, callbackqueryresult);
        res.sendStatus(200);
        return;
      }
      console.log("sending broadcast");
      broadcastTextToGroupIfGroupExists(sender, text);
    }
  }
  res.sendStatus(200)
})

function checkPayloads(req){
  var senderId = getSenderIdFromPayload(req);
  if(senderId == null){
    return;
  }
  if(checkPayload(req, "Get Started")){
    sendOnboarding(senderId);
  }
  else if(checkPayload(req, "Help me!")){
    helpThem(senderId);
  }
  else if(checkPayload(req, "Offer support")){
    registerSupporter(senderId);
  }
  else if(checkPayload(req, "Leave")){
    leaveGroup(senderId);
  }
  else if(checkPayload(req, "No")){
    sendTextMessage(senderId, "Okay! Come back anytime!")
  }
}

function getSenderIdFromPayload(req){
  try{
    return req.body.entry[0].messaging[0].sender.id;
  }
  catch(err){
    return null;
  }
}

function sendOnboarding(senderId){
  var options = [];
  options.push("Help me!");
  options.push("Offer support");
  sendOptionMessage(senderId, options, "What would you like to do?");
}

//called when a user clicks the "help me" onboarding option
function helpThem(senderId){
  sendTextMessage(senderId, "Getting you help!");
  createGroup(senderId);
}

//called when a user clicks the "register for support" onboarding option
function registerSupporter(senderId){
  sendTextMessage(senderId, "To offer support, we would like to ask you to participate in a screening process at www.facebook.com/heyada2017. \nIf you have completed a screening process, please send your ID")
}

function checkPayload(req, payload){
  try{
    return req.body.entry[0].messaging[0].postback.payload === payload;
  }
  catch(err){

  }
}

function sendOptionMessage(sender, options, title){
  console.log("options called");
  var buttons = [];
  options.forEach(function(option){
    buttons.push({
      "type" : "postback",
      "title" : option,
      "payload" : option
    });
  });
  console.log("buttons: " + buttons);
  let messageData = {
    "attachment":{
      "type":"template",
      "payload":{
        "template_type":"button",
        "text":title,
        "buttons":buttons
      }
    }
  }
  console.log("request" + messageData);
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token:token},
    method: 'POST',
    json: {
      recipient: {id:sender},
      message: messageData,
    }
  }, function(error, response, body) {
    if (error) {
      console.log('Error sending messages: ', error)
    } else if (response.body.error) {
      console.log('Error: ', response.body.error)
    }
  })
}

function sendTextMessage(sender, text) {
  let messageData = { text:text }
  request({
    url: 'https://graph.facebook.com/v2.6/me/messages',
    qs: {access_token:token},
    method: 'POST',
    json: {
      recipient: {id:sender},
      message: messageData,
    }
  }, function(error, response, body) {
    if (error) {
      console.log('Error sending messages: ', error)
    } else if (response.body.error) {
      console.log('Error: ', response.body.error)
    }
  })
}

function addToSupports(id) {
  var newSupporter = new Supporter ({
    id: id,
    availability: true
  });
  console.log("updating Supporter with: " + newSupporter);

  Supporter.update(
    {id: id},
    {$setOnInsert: newSupporter},
    {upsert: true},
    function(err, numAffected) {}
  );
}

function createGroup(senderId) {
  var callback = function (err, data) {
    if (err) { }
    else {
      saveGroup(data, senderId);
    }
  }
  var callbackqueryresult = function (err, result) {
    console.log("Got result group" + result);
    console.log("Got error" + err);
    if(err || result == null || result.length < 1){
      console.log("DIDNT GET RESULT");
      Supporter.find({"availability" : true}, callback).limit(2);
    }
    else{
      console.log("GOT RESULT");
    }
  }
  Group.find({ "members": { $elemMatch: {"id" : senderId}} }, callbackqueryresult);
}

function saveGroup(supporterArray, requesterId){
  var memberModelsArray = [];
  supporterArray.forEach(function(supporter, index, array){
    var model = new GroupMember({
      id: supporter.id,
      is_requester: false,
      name: names[index]
    });
    Supporter.update({id: supporter.id}, {
      "availability": false,
    }, function(err, affected, resp) {
      console.log(resp);
    });
    console.log("Sending new group notif to :" + supporter.id);
    sendTextMessage(supporter.id, "You've been matched with somebody who needs help. \nSend them a nice message!");
    memberModelsArray.push(model);
  });
  var requesterModel = new GroupMember({
    id: requesterId,
    is_requester: true,
    name: "The Warrior"
  });
  memberModelsArray.push(requesterModel);
  var groupCreated = new Group({
    members: memberModelsArray
  });
  groupCreated.save(function(err){});
}

function broadcastTextToGroupIfGroupExists(senderid, text) {
  var callbackqueryresult = function (err, result) {
    try{
      console.log("found members, they are" + result);
      console.log("found error, they are" + err);
      console.log("found members, length is" + result.length);
      if(result == null || result.length < 1){
        var options = [];
        options.push("Help me!");
        options.push("Offer support");
        sendOptionMessage(senderid, options, "What would you like to do?");
      }
      var senderName;
      result[0].members.forEach(function (groupmember) {
        if(senderid == groupmember.id){
          senderName = groupmember.name;
        }
      })
      result[0].members.forEach(function (groupmember) {
        if(senderid != groupmember.id){
          sendTextMessage(groupmember.id,  senderName+": " +text);
        }
      })
    }
    catch(error){}

  }
  console.log("finding group members");
  Group.find({ "members": { $elemMatch: {"id" : senderid}} }, callbackqueryresult);
}

function leaveGroup(senderId){
  var callback = function (err, result) {
    console.log("LEAVING: Got group");
    result[0].members.forEach(function (groupmember, index, array) {
      if(senderId == groupmember.id){
        console.log("LEAVING: Found leaving member");
        if(groupmember.is_requester){
          console.log("LEAVING: Leaving members is requester");
          Group.remove({ _id: result[0]._id }, function(err) {});
          markArrayAsAvailable(result[0].members);
        }
        else{
          console.log("LEAVING: Leaving members is NOT requester");
          markAsAvailable(result[0].members[index]);
          result[0].members.splice(index, 1);
          updateGroupMembers(result[0]._id, result[0].members);
        }
      }
    })
  }
  Group.find({ "members": { $elemMatch: {"id" : senderId}} }, callback);
}

function updateGroupMembers(groupId, newMembers){
  Group.findById(groupId, function (err, group) {
    group.members = newMembers;
    group.save(function (err, updatedTank) {});
  });
}

function markArrayAsAvailable(listOfGroupMembers){
  listOfGroupMembers.forEach(function(groupMember){
    markAsAvailable(groupMember);
  })
}

function markAsAvailable(groupMember){
  console.log("LEAVING: Marking id " + groupMember.id + " as available");
  var conditions = { id: groupMember.id }
  , update = { availability: true}
  , options = { multi: true };
  var callback = function(err, numAffected) {
    if(groupMember.is_requester){
      sendTextMessage(groupMember.id, "You have left the group");
      sendOptionMessage(groupMember.id, ["Help me!", "No"], "Would you like more help?");
    }
    else{
      sendTextMessage(groupMember.id, "You left the group/ the group has disbanded, please wait until you receive another notification for help. Thank you!");
    }
  };
  Supporter.update(conditions, update, options, callback);
}

const token = "EAAWV1QbgKMMBACBKsgZCPgdK9F3tN03SynQrdLybpRz5OrSVZB7Rvxf9frZCxJZBS6X2ViUBtu0jUQWeAE0DPQYYnQX16Xwakyo36hO0MPZBkOuiPCAZCnHJ5hdzlkZAd7PcFDsZBLw0J33NL6d8uQZA0ZBqUVd5OZA5TFyIhiHFEYJqz1gcs2yqRnS"
