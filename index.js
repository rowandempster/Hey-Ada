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
      if (text === testcode) {
        sendTextMessage(sender, "Thank you for offering support, you will receive a notification when you need help.");
        addToSupports(sender);
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
  supporterArray.forEach(function(supporter){
    var model = new GroupMember({
      id: supporter.id,
      is_requester: false
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
    is_requester: true
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
      result[0].members.forEach(function (groupmember) {
        if(senderid != groupmember.id){
          sendTextMessage(groupmember.id, text)
        }
      })
    }
    catch(error){}

  }
  console.log("finding group members");
  Group.find({ "members": { $elemMatch: {"id" : senderid}} }, callbackqueryresult);
}

const token = "EAAWV1QbgKMMBACBKsgZCPgdK9F3tN03SynQrdLybpRz5OrSVZB7Rvxf9frZCxJZBS6X2ViUBtu0jUQWeAE0DPQYYnQX16Xwakyo36hO0MPZBkOuiPCAZCnHJ5hdzlkZAd7PcFDsZBLw0J33NL6d8uQZA0ZBqUVd5OZA5TFyIhiHFEYJqz1gcs2yqRnS"
